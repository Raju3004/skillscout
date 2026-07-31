from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.github_profile import GithubProfile
from app.models.job_description import JobDescription
from app.models.match_result import MatchResult
from app.models.resume import Resume
from app.models.user import User
from app.schemas.candidates import CandidateDetail
from app.services.explain import build_written_summary
from app.services.scoring import (
    compute_code_verified_score,
    compute_offer_acceptance,
    compute_overall_rank,
    compute_quality_score,
)

router = APIRouter(prefix="/candidates", tags=["candidates"])


def _owned_match(candidate_id: int, job_id: int, db: Session, user: User) -> tuple[MatchResult, JobDescription]:
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job description not found")
    match = (
        db.query(MatchResult)
        .filter(MatchResult.job_description_id == job_id, MatchResult.candidate_id == candidate_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="No match result for this candidate on this job")
    return match, job


@router.get("/{candidate_id}", response_model=CandidateDetail)
def get_candidate(
    candidate_id: int,
    job_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match, _job = _owned_match(candidate_id, job_id, db, current_user)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    github_profile = db.query(GithubProfile).filter(GithubProfile.candidate_id == candidate_id).first()
    resume = (
        db.query(Resume)
        .filter(Resume.candidate_id == candidate_id, Resume.job_description_id == match.job_description_id)
        .first()
    )

    return CandidateDetail(
        candidate_id=candidate.id,
        name=candidate.name,
        created_at=candidate.created_at,
        github=github_profile,
        resume_filename=resume.filename if resume else None,
        match=match,
    )


@router.post("/{candidate_id}/score", response_model=CandidateDetail)
def recompute_score(
    candidate_id: int,
    job_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match, job = _owned_match(candidate_id, job_id, db, current_user)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    github_profile = db.query(GithubProfile).filter(GithubProfile.candidate_id == candidate_id).first()

    notes = []
    quality_score = match.quality_score
    code_verified_score = match.code_verified_score
    offer_acceptance_probability = match.offer_acceptance_probability
    quality_breakdown = (match.explanation or {}).get("quality_breakdown", {})
    acceptance_breakdown = (match.explanation or {}).get("acceptance_breakdown", {})
    semantic_method = (match.explanation or {}).get("semantic_method", "none")

    if github_profile:
        quality_score, quality_breakdown = compute_quality_score(github_profile)
        code_verified_score, semantic_method = compute_code_verified_score(job.raw_text, github_profile)
        offer_acceptance_probability, acceptance_breakdown = compute_offer_acceptance(
            code_verified_score, github_profile
        )
        if github_profile.data_limited:
            notes.append(
                "Limited GitHub data: few or no public repositories found. "
                "Score reflects only what's publicly available."
            )

    match.quality_score = quality_score
    match.code_verified_score = code_verified_score
    match.offer_acceptance_probability = offer_acceptance_probability
    match.overall_rank_score = compute_overall_rank(
        code_verified_score, quality_score, offer_acceptance_probability, match.resume_match_score
    )
    match.explanation = {
        "summary": build_written_summary(
            candidate_name=candidate.name,
            code_verified_score=code_verified_score,
            quality_score=quality_score,
            offer_acceptance_probability=offer_acceptance_probability,
            quality_breakdown=quality_breakdown,
            acceptance_breakdown=acceptance_breakdown,
            profile=github_profile,
            data_limited=github_profile.data_limited if github_profile else False,
        ),
        "quality_breakdown": quality_breakdown,
        "acceptance_breakdown": acceptance_breakdown,
        "semantic_method": semantic_method,
        "notes": notes,
    }
    db.commit()
    db.refresh(match)

    resume = (
        db.query(Resume)
        .filter(Resume.candidate_id == candidate_id, Resume.job_description_id == job.id)
        .first()
    )

    return CandidateDetail(
        candidate_id=candidate.id,
        name=candidate.name,
        created_at=candidate.created_at,
        github=github_profile,
        resume_filename=resume.filename if resume else None,
        match=match,
    )
