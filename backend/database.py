from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./vocabulary.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# Lightweight additive migrations: (table, column, column definition with default).
# Each is applied only if the column is missing, so existing rows/data are kept.
_COLUMN_MIGRATIONS = [
    ("courses", "level", "VARCHAR(20) NOT NULL DEFAULT 'beginner'"),
    # Defensive: ensure course wiring exists on older databases too.
    ("users", "active_course_id", "INTEGER"),
    ("words", "course_id", "INTEGER"),
]


def _run_column_migrations(sync_conn) -> None:
    """Add any missing columns via ALTER TABLE without touching existing data."""
    from sqlalchemy import text, inspect
    inspector = inspect(sync_conn)
    existing_tables = set(inspector.get_table_names())
    for table, column, ddl in _COLUMN_MIGRATIONS:
        if table not in existing_tables:
            continue  # create_all already built it with the column
        cols = {c["name"] for c in inspector.get_columns(table)}
        if column not in cols:
            sync_conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))


async def init_db():
    # Ensure every model is registered on Base.metadata before create_all,
    # regardless of import order at the call site.
    import backend.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_column_migrations)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
