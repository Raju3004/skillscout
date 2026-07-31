from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MatchResult(Base):
    __tablename__ = "match_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_description_id: Mapped[int] = mapped_column(ForeignKey("job_descriptions.id"), nullable=False)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"), nullable=True)

    source: Mapped[str] = mapped_column(String(20), default="github")  # github | resume | both

    resume_match_score: Mapped[float] = mapped_column(Float, nullable=True)
    code_verified_score: Mapped[float] = mapped_column(Float, nullable=True)
    quality_score: Mapped[float] = mapped_column(Float, nullable=True)
    offer_acceptance_probability: Mapped[float] = mapped_column(Float, nullable=True)
    overall_rank_score: Mapped[float] = mapped_column(Float, default=0.0)

    explanation: Mapped[dict] = mapped_column(JSON, default=dict)
    data_limited: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
