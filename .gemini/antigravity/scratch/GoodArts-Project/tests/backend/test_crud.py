"""Test new CRUD operations for enrichment, exhibitions, visits, photos, annotations, probes, settings."""
import pytest
from src.backend.database import crud


@pytest.mark.asyncio
async def test_upsert_and_get_enrichment(db):
    await db.execute("INSERT INTO artworks (title) VALUES ('Test')")
    await db.commit()
    await crud.upsert_enrichment(db, 1, {"fun_facts": '["fact1"]', "provenance": "Royal Collection"})
    result = await crud.get_enrichment(db, 1)
    assert result is not None
    assert result["fun_facts"] == '["fact1"]'
    assert result["provenance"] == "Royal Collection"


@pytest.mark.asyncio
async def test_create_and_list_exhibitions(db):
    eid = await crud.create_exhibition(db, {
        "title": "Monet in Light",
        "venue_name": "MASP",
        "city": "São Paulo",
        "country": "Brazil",
        "source": "manual",
    })
    assert eid > 0
    exhs = await crud.get_exhibitions(db, city="São Paulo")
    assert len(exhs) == 1
    assert exhs[0]["title"] == "Monet in Light"


@pytest.mark.asyncio
async def test_set_exhibition_status(db):
    eid = await crud.create_exhibition(db, {"title": "Show", "source": "manual"})
    await crud.set_exhibition_status(db, eid, "attending")
    async with db.execute("SELECT status FROM user_exhibitions WHERE exhibition_id=?", (eid,)) as cur:
        row = await cur.fetchone()
    assert row[0] == "attending"


@pytest.mark.asyncio
async def test_create_and_get_visit(db):
    vid = await crud.create_visit(db, {
        "venue_name": "Louvre",
        "city": "Paris",
        "visit_date": "2026-04-15",
    })
    assert vid > 0
    visit = await crud.get_visit(db, vid)
    assert visit["venue_name"] == "Louvre"


@pytest.mark.asyncio
async def test_create_photo(db):
    vid = await crud.create_visit(db, {"venue_name": "Louvre"})
    pid = await crud.create_photo(db, {
        "visit_id": vid,
        "file_path": "/data/uploads/abc.jpg",
        "thumbnail_path": "/data/uploads/abc_thumb.jpg",
    })
    assert pid > 0
    photos = await crud.get_photos_for_visit(db, vid)
    assert len(photos) == 1


@pytest.mark.asyncio
async def test_create_and_list_annotations(db):
    await db.execute("INSERT INTO artworks (title) VALUES ('Test')")
    await db.commit()
    aid = await crud.create_annotation(db, 1, note_text="Beautiful brushwork")
    assert aid > 0
    anns = await crud.get_annotations(db, 1)
    assert len(anns) == 1
    assert anns[0]["note_text"] == "Beautiful brushwork"


@pytest.mark.asyncio
async def test_log_and_get_probes(db):
    await db.execute("INSERT INTO artworks (title) VALUES ('Test')")
    await db.commit()
    await crud.log_probe(db, 1, "confirmation", "positive", "negative", False)
    probes = await crud.get_recent_probes(db, days=30)
    assert len(probes) == 1
    assert probes[0]["agreed"] == 0


@pytest.mark.asyncio
async def test_get_and_update_settings(db):
    await db.execute("INSERT INTO user_settings DEFAULT VALUES")
    await db.commit()
    s = await crud.get_settings(db)
    assert s["home_city"] == "São Paulo"
    await crud.update_settings(db, {"home_city": "Munich", "temp_city": "London"})
    s2 = await crud.get_settings(db)
    assert s2["home_city"] == "Munich"
    assert s2["temp_city"] == "London"
