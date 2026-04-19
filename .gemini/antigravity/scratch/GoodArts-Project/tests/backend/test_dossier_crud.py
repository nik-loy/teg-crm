import pytest
import pytest_asyncio
import aiosqlite
from src.backend.database.migrations import SCHEMA


@pytest_asyncio.fixture
async def db():
    async with aiosqlite.connect(":memory:") as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.executescript(SCHEMA)
        await conn.commit()
        yield conn


@pytest.mark.asyncio
async def test_artwork_dossier_table_exists(db):
    async with db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='artwork_dossier'"
    ) as cur:
        row = await cur.fetchone()
    assert row is not None, "artwork_dossier table must exist"


@pytest.mark.asyncio
async def test_dossier_queue_table_exists(db):
    async with db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='dossier_queue'"
    ) as cur:
        row = await cur.fetchone()
    assert row is not None, "dossier_queue table must exist"


@pytest.mark.asyncio
async def test_dossier_queue_index_exists(db):
    async with db.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_dossier_queue_priority'"
    ) as cur:
        row = await cur.fetchone()
    assert row is not None, "priority index must exist"
