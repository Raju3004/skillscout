from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JobDescriptionOut(BaseModel):
    id: int
    title: str
    raw_text: str
    tech_stack: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DiscoverRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    query_type: Literal["username", "org", "search"] = "username"
    limit: int = Field(default=8, ge=1, le=20)


class DiscoverError(BaseModel):
    identifier: str
    reason: str


class DiscoverResponse(BaseModel):
    discovered: int
    updated: int
    errors: list[DiscoverError]
    rate_limited: bool
    rate_limit_reset_at: datetime | None = None


class ResumeUploadResult(BaseModel):
    filename: str
    candidate_id: int | None = None
    candidate_name: str | None = None
    resume_match_score: float | None = None
    linked_to_github: bool = False
    error: str | None = None


class ResumeUploadResponse(BaseModel):
    results: list[ResumeUploadResult]


class DiversityStats(BaseModel):
    total_candidates: int
    source_breakdown: dict[str, int]
    limited_data_count: int
    limited_data_pct: float
    quality_band_distribution: dict[str, int]
    top_languages: list[dict]
    disclaimer: str
