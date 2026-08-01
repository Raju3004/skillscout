from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# create_all() only creates tables that don't exist yet -- it never alters an
# existing table to add a new column. Without Alembic, this is the lightest
# way to keep an already-deployed table (Neon) in sync with new model fields:
# try the ALTER, swallow the error if the column is already there.
_PENDING_COLUMN_ADDITIONS = [
    ("match_results", "status", "VARCHAR(20) DEFAULT 'pending'"),
]


def run_lightweight_migrations() -> None:
    with engine.connect() as conn:
        for table, column, coltype in _PENDING_COLUMN_ADDITIONS:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"))
                conn.commit()
            except Exception:
                conn.rollback()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
