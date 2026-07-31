from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.github_profile import GithubProfile
from app.models.job_description import JobDescription
from app.models.match_result import MatchResult
from app.models.resume import Resume
from app.models.user import User
from app.schemas.candidates import CandidateListItem
from app.schemas.jobs import (
    DiscoverError,
    DiscoverRequest,
    DiscoverResponse,
    DiversityStats,
    JobDescriptionOut,
    ResumeUploadResponse,
    ResumeUploadResult,
)
from app.services.diversity import compute_diversity_stats
from app.services.document_parser import DocumentParseError, extract_text
from app.services.explain import build_written_summary
from app.services.github_client import GithubNotFoundError, GithubRateLimitError, get_github_client
from app.services.resume_parser import extract_candidate_name, extract_github_username
from app.services.scoring import (
    compute_code_verified_score,
    compute_offer_acceptance,
    compute_overall_rank,
    compute_quality_score,
    compute_text_match_score,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _get_owned_job(job_id: int, db: Session, user: User) -> JobDescription:
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
    if job.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your job description")
    return job


@router.post("", response_model=JobDescriptionOut, status_code=201)
def create_job(
    title: str = Form(...),
    raw_text: str | None = Form(None),
    tech_stack: str = Form(""),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    text = (raw_text or "").strip()

    if file is not None:
        content = file.file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        try:
            text = extract_text(file.filename or "upload", content)
        except DocumentParseError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not text:
        raise HTTPException(
            status_code=422, detail="Provide a job description as pasted text or a PDF/DOCX upload"
        )

    job = JobDescription(user_id=current_user.id, title=title.strip() or "Untitled role", raw_text=text, tech_stack=tech_stack)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=list[JobDescriptionOut])
def list_jobs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(JobDescription)
        .filter(JobDescription.user_id == current_user.id)
        .order_by(JobDescription.created_at.desc())
        .all()
    )


@router.get("/{job_id}", response_model=JobDescriptionOut)
def get_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_owned_job(job_id, db, current_user)


@router.post("/{job_id}/discover", response_model=DiscoverResponse)
def discover_candidates(
    job_id: int,
    payload: DiscoverRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = _get_owned_job(job_id, db, current_user)

    client = get_github_client()
    usernames: list[str] = []
    errors: list[DiscoverError] = []

    try:
        if payload.query_type == "username":
            usernames = [payload.query.strip()]
        elif payload.query_type == "org":
            usernames = client.list_org_members(payload.query.strip(), limit=payload.limit)
        else:
            usernames = client.search_users(payload.query.strip(), limit=payload.limit)
    except GithubRateLimitError as exc:
        client.close()
        return DiscoverResponse(
            discovered=0, updated=0, errors=[], rate_limited=True, rate_limit_reset_at=exc.reset_at
        )
    except GithubNotFoundError as exc:
        client.close()
        errors.append(DiscoverError(identifier=exc.identifier, reason="GitHub org/user not found"))
        usernames = []

    discovered = 0
    updated = 0
    rate_limited = False
    rate_limit_reset_at = None

    for username in usernames:
        try:
            profile_data = client.fetch_profile(username)
        except GithubNotFoundError:
            errors.append(DiscoverError(identifier=username, reason="GitHub username not found"))
            continue
        except GithubRateLimitError as exc:
            rate_limited = True
            rate_limit_reset_at = exc.reset_at
            break

        existing_profile = (
            db.query(GithubProfile).filter(GithubProfile.username == profile_data.username).first()
        )

        if existing_profile:
            candidate = db.query(Candidate).filter(Candidate.id == existing_profile.candidate_id).first()
            existing_profile.profile_url = profile_data.profile_url
            existing_profile.avatar_url = profile_data.avatar_url
            existing_profile.bio = profile_data.bio
            existing_profile.public_repos = profile_data.public_repos
            existing_profile.followers = profile_data.followers
            existing_profile.account_created_at = profile_data.account_created_at
            existing_profile.languages = profile_data.languages
            existing_profile.top_repos = profile_data.top_repos
            existing_profile.activity_features = profile_data.activity_features
            existing_profile.data_limited = profile_data.data_limited
            profile_row = existing_profile
            updated += 1
        else:
            candidate = Candidate(name=profile_data.username)
            db.add(candidate)
            db.flush()
            profile_row = GithubProfile(
                candidate_id=candidate.id,
                username=profile_data.username,
                profile_url=profile_data.profile_url,
                avatar_url=profile_data.avatar_url,
                bio=profile_data.bio,
                public_repos=profile_data.public_repos,
                followers=profile_data.followers,
                account_created_at=profile_data.account_created_at,
                languages=profile_data.languages,
                top_repos=profile_data.top_repos,
                activity_features=profile_data.activity_features,
                data_limited=profile_data.data_limited,
            )
            db.add(profile_row)
            discovered += 1

        db.flush()

        match = (
            db.query(MatchResult)
            .filter(MatchResult.job_description_id == job.id, MatchResult.candidate_id == candidate.id)
            .first()
        )

        quality_score, quality_breakdown = compute_quality_score(profile_row)
        code_verified_score, semantic_method = compute_code_verified_score(job.raw_text, profile_row)
        offer_acceptance_probability, acceptance_breakdown = compute_offer_acceptance(
            code_verified_score, profile_row
        )
        resume_match_score = match.resume_match_score if match else None
        overall = compute_overall_rank(
            code_verified_score, quality_score, offer_acceptance_probability, resume_match_score
        )

        notes = []
        if profile_data.data_limited:
            notes.append(
                "Limited GitHub data: few or no public repositories found. "
                "Score reflects only what's publicly available."
            )

        summary = build_written_summary(
            candidate_name=candidate.name,
            code_verified_score=code_verified_score,
            quality_score=quality_score,
            offer_acceptance_probability=offer_acceptance_probability,
            quality_breakdown=quality_breakdown,
            acceptance_breakdown=acceptance_breakdown,
            profile=profile_row,
            data_limited=profile_data.data_limited,
        )

        explanation = {
            "summary": summary,
            "quality_breakdown": quality_breakdown,
            "acceptance_breakdown": acceptance_breakdown,
            "semantic_method": semantic_method,
            "notes": notes,
        }

        if not match:
            match = MatchResult(job_description_id=job.id, candidate_id=candidate.id, source="github")
            db.add(match)
        elif match.source == "resume":
            match.source = "both"

        match.quality_score = quality_score
        match.code_verified_score = code_verified_score
        match.offer_acceptance_probability = offer_acceptance_probability
        match.overall_rank_score = overall
        match.explanation = explanation
        match.data_limited = profile_data.data_limited

    client.close()
    db.commit()

    return DiscoverResponse(
        discovered=discovered,
        updated=updated,
        errors=errors,
        rate_limited=rate_limited,
        rate_limit_reset_at=rate_limit_reset_at,
    )


@router.post("/{job_id}/resumes", response_model=ResumeUploadResponse)
def upload_resumes(
    job_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = _get_owned_job(job_id, db, current_user)
    results: list[ResumeUploadResult] = []

    for file in files:
        filename = file.filename or "resume"
        content = file.file.read()

        if not content:
            results.append(ResumeUploadResult(filename=filename, error="File is empty"))
            continue

        try:
            text = extract_text(filename, content)
        except DocumentParseError as exc:
            results.append(ResumeUploadResult(filename=filename, error=str(exc)))
            continue

        github_username = extract_github_username(text)
        candidate: Candidate | None = None
        linked_to_github = False

        if github_username:
            profile = db.query(GithubProfile).filter(GithubProfile.username == github_username).first()
            if profile:
                candidate = db.query(Candidate).filter(Candidate.id == profile.candidate_id).first()
                linked_to_github = True

        if candidate is None:
            fallback_name = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip() or "Candidate"
            name = extract_candidate_name(text, fallback_name)
            candidate = Candidate(name=name)
            db.add(candidate)
            db.flush()

        resume = Resume(job_description_id=job.id, candidate_id=candidate.id, filename=filename, raw_text=text)
        db.add(resume)
        db.flush()

        resume_match_score, _method = compute_text_match_score(job.raw_text, text)

        match = (
            db.query(MatchResult)
            .filter(MatchResult.job_description_id == job.id, MatchResult.candidate_id == candidate.id)
            .first()
        )
        if not match:
            match = MatchResult(job_description_id=job.id, candidate_id=candidate.id, source="resume")
            db.add(match)
        elif match.source == "github":
            match.source = "both"

        match.resume_id = resume.id
        match.resume_match_score = resume_match_score
        match.overall_rank_score = compute_overall_rank(
            match.code_verified_score, match.quality_score, match.offer_acceptance_probability, resume_match_score
        )

        explanation = dict(match.explanation or {})
        resume_note = f"Resume text matches this JD at {resume_match_score:.0f}/100."
        explanation["summary"] = (
            f"{explanation['summary']} {resume_note}" if explanation.get("summary") else resume_note
        )
        match.explanation = explanation

        db.flush()

        results.append(
            ResumeUploadResult(
                filename=filename,
                candidate_id=candidate.id,
                candidate_name=candidate.name,
                resume_match_score=resume_match_score,
                linked_to_github=linked_to_github,
            )
        )

    db.commit()
    return ResumeUploadResponse(results=results)


@router.get("/{job_id}/candidates", response_model=list[CandidateListItem])
def list_candidates(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = _get_owned_job(job_id, db, current_user)

    matches = db.query(MatchResult).filter(MatchResult.job_description_id == job.id).all()
    items: list[CandidateListItem] = []
    for match in matches:
        candidate = db.query(Candidate).filter(Candidate.id == match.candidate_id).first()
        if not candidate:
            continue
        github_profile = (
            db.query(GithubProfile).filter(GithubProfile.candidate_id == candidate.id).first()
        )
        resume = (
            db.query(Resume)
            .filter(Resume.candidate_id == candidate.id, Resume.job_description_id == job.id)
            .first()
        )
        items.append(
            CandidateListItem(
                candidate_id=candidate.id,
                name=candidate.name,
                created_at=candidate.created_at,
                github=github_profile,
                resume_filename=resume.filename if resume else None,
                match=match,
            )
        )

    items.sort(key=lambda c: c.match.overall_rank_score if c.match else 0, reverse=True)
    return items


@router.get("/{job_id}/diversity", response_model=DiversityStats)
def get_diversity_stats(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = _get_owned_job(job_id, db, current_user)

    matches = db.query(MatchResult).filter(MatchResult.job_description_id == job.id).all()
    candidate_ids = [m.candidate_id for m in matches]
    candidates = db.query(Candidate).filter(Candidate.id.in_(candidate_ids)).all() if candidate_ids else []
    profiles = (
        db.query(GithubProfile).filter(GithubProfile.candidate_id.in_(candidate_ids)).all()
        if candidate_ids
        else []
    )

    return compute_diversity_stats(candidates, matches, profiles)
