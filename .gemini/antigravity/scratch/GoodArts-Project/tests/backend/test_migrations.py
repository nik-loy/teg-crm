"""Test that all tables and columns are created correctly."""
import pytest


@pytest.mark.asyncio
async def test_all_tables_exist(db):
    expected = [
        "artworks", "user_artworks", "taste_profile", "api_cache",
        "artwork_enrichment", "exhibitions", "user_exhibitions",
        "visits", "photos", "artwork_annotations", "probe_log",
        "user_settings",
    ]
    async with db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ) as cur:
        tables = [row[0] for row in await cur.fetchall()]
    for table in expected:
        assert table in tables, f"Missing table: {table}"


@pytest.mark.asyncio
async def test_taste_profile_has_new_columns(db):
    async with db.execute("PRAGMA table_info(taste_profile)") as cur:
        cols = [row[1] for row in await cur.fetchall()]
    assert "last_rating_at" in cols
    assert "sentiment_sum" in cols


@pytest.mark.asyncio
async def test_artworks_has_new_columns(db):
    async with db.execute("PRAGMA table_info(artworks)") as cur:
        cols = [row[1] for row in await cur.fetchall()]
    assert "thumbnail_path" in cols
    assert "dominant_color" in cols
    assert "source_id" in cols


@pytest.mark.asyncio
async def test_user_settings_has_defaults(db):
    await db.execute("INSERT INTO user_settings DEFAULT VALUES")
    await db.commit()
    async with db.execute("SELECT home_city FROM user_settings WHERE id=1") as cur:
        row = await cur.fetchone()
    assert row[0] == "São Paulo"


@pytest.mark.asyncio
async def test_artwork_enrichment_unique_constraint(db):
    await db.execute(
        "INSERT INTO artworks (title, source) VALUES ('Test', 'manual')"
    )
    await db.commit()
    await db.execute(
        "INSERT INTO artwork_enrichment (artwork_id, fun_facts) VALUES (1, '[]')"
    )
    await db.commit()
    # Second insert for same artwork_id should fail
    with pytest.raises(Exception):
        await db.execute(
            "INSERT INTO artwork_enrichment (artwork_id, fun_facts) VALUES (1, '[]')"
        )
