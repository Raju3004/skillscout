from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class GithubProfile(Base):
    __tablename__ = "github_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False)
    username: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    profile_url: Mapped[str] = mapped_column(String(500), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    bio: Mapped[str] = mapped_column(String(1000), default="")
    public_repos: Mapped[int] = mapped_column(Integer, default=0)
    followers: Mapped[int] = mapped_column(Integer, default=0)
    account_created_at: Mapped[str] = mapped_column(String(64), default="")

    languages: Mapped[dict] = mapped_column(JSON, default=dict)
    top_repos: Mapped[list] = mapped_column(JSON, default=list)
    activity_features: Mapped[dict] = mapped_column(JSON, default=dict)
    data_limited: Mapped[bool] = mapped_column(default=False)

    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
