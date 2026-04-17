"""
ArtLog Database — SQLite connection manager.
Provides an async context manager for aiosqlite connections.
"""
import aiosqlite
from src.backend.config import settings


async def get_db() -> aiosqlite.Connection:
    """FastAPI dependency: yields a database connection."""
    async with aiosqlite.connect(str(settings.DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        yield db
