"""Test feed composition engine."""
import pytest
from src.backend.engine.recommender import _score_artwork, compose_feed_batch


def test_score_artwork_positive_for_matching_profile():
    artwork = {"movement": "Impressionism", "artist": "Monet"}
    profile = {
        "movement": {"Impressionism": {"score": 0.9, "confidence": 1.0, "count": 20}},
        "artist": {"Monet": {"score": 0.8, "confidence": 0.9, "count": 15}},
    }
    score = _score_artwork(artwork, profile)
    assert score > 0


def test_score_artwork_zero_for_unknown():
    artwork = {"movement": "Unknown", "artist": "Nobody"}
    profile = {
        "movement": {"Impressionism": {"score": 0.9, "confidence": 1.0, "count": 20}},
    }
    score = _score_artwork(artwork, profile)
    assert score == 0.0


@pytest.mark.asyncio
async def test_compose_feed_batch_returns_items(db):
    # Seed artworks and taste profile
    for i in range(1, 25):
        await db.execute(
            "INSERT INTO artworks (id, title, movement, image_url) VALUES (?, ?, ?, ?)",
            (i, f"Art{i}", "Impressionism" if i % 2 == 0 else "Cubism", "http://img"),
        )
    await db.execute(
        "INSERT INTO taste_profile (dimension, value, affinity_score, artwork_count) "
        "VALUES ('movement', 'Impressionism', 0.8, 10)"
    )
    await db.commit()
    batch = await compose_feed_batch(db, offset=0, limit=20)
    assert len(batch) > 0
    assert all("artwork" in item for item in batch)
