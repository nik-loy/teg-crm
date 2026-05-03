import json
import pytest
import pytest_asyncio
import aiosqlite
from src.backend.database.migrations import SCHEMA
from src.backend.database import crud


@pytest_asyncio.fixture
async def db():
    async with aiosqlite.connect(":memory:") as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.executescript(SCHEMA)
        await conn.commit()
        yield conn


@pytest.mark.asyncio
async def test_new_artwork_gets_pending_dossier(db):
    artwork_id = await crud.upsert_artwork(db, {
        "title": "Test Artwork",
        "artist": "Test Artist",
        "wikidata_id": "Q99999",
        "source": "wikidata",
    })

    dossier = await crud.get_dossier(db, artwork_id)
    assert dossier is not None
    assert dossier["status"] == "pending"
    assert dossier["artwork_id"] == artwork_id


@pytest.mark.asyncio
async def test_dossier_complete_data_readable(db):
    artwork_id = await crud.upsert_artwork(db, {
        "title": "Complete Work",
        "artist": "Full Artist",
        "wikidata_id": "Q88888",
        "source": "wikidata",
    })
    await crud.upsert_dossier(db, artwork_id, {
        "medium_display": "Oil on canvas",
        "status": "complete",
        "data_sources": json.dumps(["artic", "getty"]),
    })

    dossier = await crud.get_dossier(db, artwork_id)
    assert dossier["status"] == "complete"
    assert dossier["medium_display"] == "Oil on canvas"
    assert "artic" in dossier["data_sources"]


@pytest.mark.asyncio
async def test_dossier_unavailable_status(db):
    artwork_id = await crud.upsert_artwork(db, {
        "title": "Obscure Work",
        "artist": "Obscure Artist",
        "wikidata_id": "Q77777",
        "source": "wikidata",
    })
    await crud.upsert_dossier(db, artwork_id, {"status": "unavailable"})
    await crud.mark_queue_failed(db, artwork_id, "no data from any source")

    dossier = await crud.get_dossier(db, artwork_id)
    # mark_queue_failed writes "failed" to the DB; the API route maps this to "unavailable"
    assert dossier["status"] == "failed"
