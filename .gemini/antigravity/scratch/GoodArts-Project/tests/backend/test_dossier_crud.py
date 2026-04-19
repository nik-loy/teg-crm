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


from src.backend.database import crud


@pytest.mark.asyncio
async def test_enqueue_dossier_creates_rows(db):
    await db.execute(
        "INSERT INTO artworks (title, source) VALUES ('Test', 'manual')"
    )
    await db.commit()
    async with db.execute("SELECT id FROM artworks WHERE title='Test'") as cur:
        artwork_id = (await cur.fetchone())["id"]

    await crud.enqueue_dossier(db, artwork_id, priority=5)

    async with db.execute(
        "SELECT status, priority FROM dossier_queue WHERE artwork_id=?", (artwork_id,)
    ) as cur:
        q = await cur.fetchone()
    assert q is not None
    assert q["status"] == "pending"
    assert q["priority"] == 5

    async with db.execute(
        "SELECT status FROM artwork_dossier WHERE artwork_id=?", (artwork_id,)
    ) as cur:
        d = await cur.fetchone()
    assert d is not None
    assert d["status"] == "pending"


@pytest.mark.asyncio
async def test_enqueue_dossier_is_idempotent(db):
    await db.execute("INSERT INTO artworks (title, source) VALUES ('Test2', 'manual')")
    await db.commit()
    async with db.execute("SELECT id FROM artworks WHERE title='Test2'") as cur:
        artwork_id = (await cur.fetchone())["id"]

    await crud.enqueue_dossier(db, artwork_id, priority=1)
    await crud.enqueue_dossier(db, artwork_id, priority=1)

    async with db.execute(
        "SELECT COUNT(*) AS cnt FROM dossier_queue WHERE artwork_id=?", (artwork_id,)
    ) as cur:
        row = await cur.fetchone()
    assert row["cnt"] == 1


@pytest.mark.asyncio
async def test_get_dossier_returns_none_for_unknown(db):
    result = await crud.get_dossier(db, 999999)
    assert result is None


@pytest.mark.asyncio
async def test_upsert_dossier_updates_fields(db):
    await db.execute("INSERT INTO artworks (title, source) VALUES ('Test3', 'manual')")
    await db.commit()
    async with db.execute("SELECT id FROM artworks WHERE title='Test3'") as cur:
        artwork_id = (await cur.fetchone())["id"]

    await crud.enqueue_dossier(db, artwork_id)
    await crud.upsert_dossier(db, artwork_id, {
        "medium_display": "Oil on canvas",
        "status": "complete",
        "data_sources": '["artic"]',
    })

    result = await crud.get_dossier(db, artwork_id)
    assert result["medium_display"] == "Oil on canvas"
    assert result["status"] == "complete"


@pytest.mark.asyncio
async def test_get_pending_queue_items_respects_priority(db):
    for title, priority in [("A", 1), ("B", 10), ("C", 5)]:
        await db.execute(
            "INSERT INTO artworks (title, source) VALUES (?, 'manual')", (title,)
        )
        await db.commit()
        async with db.execute(
            "SELECT id FROM artworks WHERE title=?", (title,)
        ) as cur:
            artwork_id = (await cur.fetchone())["id"]
        await crud.enqueue_dossier(db, artwork_id, priority=priority)

    items = await crud.get_pending_queue_items(db, limit=3)
    assert len(items) == 3
    assert items[0]["priority"] == 10
    assert items[1]["priority"] == 5


@pytest.mark.asyncio
async def test_mark_queue_complete(db):
    await db.execute("INSERT INTO artworks (title, source) VALUES ('Done', 'manual')")
    await db.commit()
    async with db.execute("SELECT id FROM artworks WHERE title='Done'") as cur:
        artwork_id = (await cur.fetchone())["id"]

    await crud.enqueue_dossier(db, artwork_id)
    await crud.mark_queue_processing(db, artwork_id)
    await crud.mark_queue_complete(db, artwork_id)

    async with db.execute(
        "SELECT status FROM dossier_queue WHERE artwork_id=?", (artwork_id,)
    ) as cur:
        row = await cur.fetchone()
    assert row["status"] == "complete"


@pytest.mark.asyncio
async def test_boost_dossier_priority(db):
    await db.execute("INSERT INTO artworks (title, source) VALUES ('Boost', 'manual')")
    await db.commit()
    async with db.execute("SELECT id FROM artworks WHERE title='Boost'") as cur:
        artwork_id = (await cur.fetchone())["id"]

    await crud.enqueue_dossier(db, artwork_id, priority=1)
    await crud.boost_dossier_priority(db, artwork_id, priority=10)

    async with db.execute(
        "SELECT priority FROM dossier_queue WHERE artwork_id=?", (artwork_id,)
    ) as cur:
        row = await cur.fetchone()
    assert row["priority"] == 10
