import json
import pytest
import pytest_asyncio
import aiosqlite
from unittest.mock import AsyncMock, patch
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
async def test_enrich_single_artwork_stores_artic_data(db):
    artwork_id = await crud.upsert_artwork(db, {
        "title": "A Sunday on La Grande Jatte",
        "artist": "Georges Seurat",
        "wikidata_id": "Q215571",
        "movement": "Post-Impressionism",
        "source": "wikidata",
    })

    artic_fields = {
        "artic_id": "111628",
        "medium_display": "Oil on canvas",
        "technique_titles": json.dumps(["painting"]),
        "style_titles": json.dumps(["Post-Impressionism"]),
        "subject_titles": None,
        "classification_titles": json.dumps(["painting"]),
        "physical_dimensions": "207.5 × 308.1 cm",
        "inscriptions": None,
        "color_palette": json.dumps([{"hue": 48}]),
    }
    ulan_data = {
        "ulan_id": "500021166",
        "bio": "French Neo-Impressionist painter.",
        "nationality": "French",
        "birth_year": 1859,
        "death_year": 1891,
    }

    with patch("src.backend.engine.dossier_worker.find_artic_artwork", new_callable=AsyncMock,
               return_value={"id": 111628, "title": "A Sunday on La Grande Jatte"}), \
         patch("src.backend.engine.dossier_worker.extract_dossier_fields", return_value=artic_fields), \
         patch("src.backend.engine.dossier_worker.enrich_techniques", new_callable=AsyncMock,
               return_value=json.dumps({"painting": {"definition": "...", "broader": "techniques"}})), \
         patch("src.backend.engine.dossier_worker.get_movement_hierarchy", new_callable=AsyncMock,
               return_value=json.dumps({"broader": ["Modern art"], "description": "Late 19th century"})), \
         patch("src.backend.engine.dossier_worker.get_artist_influences", new_callable=AsyncMock,
               return_value={"influenced_by": ["Millet"], "influenced": ["Signac"]}), \
         patch("src.backend.engine.dossier_worker.fetch_artist_dossier", new_callable=AsyncMock,
               return_value=ulan_data):

        from src.backend.engine.dossier_worker import enrich_single_artwork
        await enrich_single_artwork(db, artwork_id)

    dossier = await crud.get_dossier(db, artwork_id)
    assert dossier is not None
    assert dossier["status"] == "complete"
    assert dossier["medium_display"] == "Oil on canvas"
    assert dossier["artist_nationality"] == "French"
    assert dossier["movement_hierarchy"] is not None
    assert "artic" in dossier["data_sources"]


@pytest.mark.asyncio
async def test_enrich_single_artwork_marks_unavailable_when_no_data(db):
    artwork_id = await crud.upsert_artwork(db, {
        "title": "Unknown Work",
        "artist": "Unknown Artist",
        "wikidata_id": "Q999999",
        "source": "wikidata",
    })

    with patch("src.backend.engine.dossier_worker.find_artic_artwork", new_callable=AsyncMock,
               return_value=None), \
         patch("src.backend.engine.dossier_worker.get_movement_hierarchy", new_callable=AsyncMock,
               return_value=None), \
         patch("src.backend.engine.dossier_worker.get_artist_influences", new_callable=AsyncMock,
               return_value=None), \
         patch("src.backend.engine.dossier_worker.fetch_artist_dossier", new_callable=AsyncMock,
               return_value=None):

        from src.backend.engine.dossier_worker import enrich_single_artwork
        await enrich_single_artwork(db, artwork_id)

    dossier = await crud.get_dossier(db, artwork_id)
    # mark_queue_failed writes "failed" to artwork_dossier; the API route maps this to "unavailable"
    assert dossier["status"] == "failed"
