from datetime import datetime

from pydantic import BaseModel


class GithubProfileOut(BaseModel):
    username: str
    profile_url: str
    avatar_url: str
    bio: str
    public_repos: int
    followers: int
    account_created_at: str
    languages: dict
    top_repos: list
    activity_features: dict
    data_limited: bool

    model_config = {"from_attributes": True}


class MatchResultOut(BaseModel):
    source: str
    status: str = "pending"
    resume_match_score: float | None
    code_verified_score: float | None
    quality_score: float | None
    offer_acceptance_probability: float | None
    overall_rank_score: float
    explanation: dict
    data_limited: bool

    model_config = {"from_attributes": True}


class CandidateListItem(BaseModel):
    candidate_id: int
    name: str
    created_at: datetime
    github: GithubProfileOut | None = None
    resume_filename: str | None = None
    match: MatchResultOut | None = None
    is_shortlisted: bool = False

    model_config = {"from_attributes": True}


class CandidateDetail(BaseModel):
    candidate_id: int
    name: str
    created_at: datetime
    github: GithubProfileOut | None = None
    resume_filename: str | None = None
    match: MatchResultOut | None = None
    is_shortlisted: bool = False

    model_config = {"from_attributes": True}
