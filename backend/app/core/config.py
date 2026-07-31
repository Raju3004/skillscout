import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "SkillScout API"
    ENV: str = "development"

    DATABASE_URL: str = "sqlite:///./skillscout.db"

    JWT_SECRET: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    GITHUB_TOKEN: str = ""

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # sentence-transformers + torch need more RAM than a free-tier host
    # typically gives a web service. Set to false there to fall back to the
    # lighter TF-IDF matcher instead of crashing the whole process.
    USE_EMBEDDING_MODEL: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
