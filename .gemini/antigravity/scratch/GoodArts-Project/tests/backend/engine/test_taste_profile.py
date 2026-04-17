"""Test adaptive half-life taste profile engine."""
import pytest
from src.backend.engine.taste_profile import (
    compute_effective_half_life,
    compute_decayed_score,
    compute_confidence,
    record_taste_signal,
    recompute_taste_profile,
    get_taste_profile_full,
)


def test_half_life_grows_with_ratings():
    hl_1 = compute_effective_half_life(1, 1.0)
    hl_50 = compute_effective_half_life(50, 1.0)
    assert hl_50 > hl_1
    # 1 rating: base * (1 + log2(1)) = base * 1 = 90
    assert hl_1 == 90.0


def test_half_life_sentiment_multiplier():
    hl_mixed = compute_effective_half_life(10, 1.0)
    hl_positive = compute_effective_half_life(10, 1.5)
    hl_negative = compute_effective_half_life(10, 0.7)
    assert hl_positive > hl_mixed > hl_negative


def test_decayed_score_halves_at_half_life():
    score = compute_decayed_score(1.0, 90, 90.0)
    assert abs(score - 0.5) < 0.01


def test_decayed_score_no_decay_at_zero_days():
    score = compute_decayed_score(0.8, 0, 90.0)
    assert score == 0.8


def test_confidence_grows_with_count():
    c5 = compute_confidence(5, 0)
    c20 = compute_confidence(20, 0)
    assert c20 > c5
    assert c20 == 1.0  # At threshold


def test_confidence_decays_with_age():
    c_recent = compute_confidence(10, 0)
    c_old = compute_confidence(10, 90)
    assert c_recent > c_old


@pytest.mark.asyncio
async def test_record_taste_signal(db):
    # Insert an artwork with movement and artist
    await db.execute(
        "INSERT INTO artworks (id, title, artist, movement, era, museum_city, medium) "
        "VALUES (1, 'Water Lilies', 'Monet', 'Impressionism', '19th Century', 'Paris', 'Oil on canvas')"
    )
    await db.commit()
    await record_taste_signal(db, 1, weight=3)
    async with db.execute("SELECT * FROM taste_profile WHERE dimension='movement'") as cur:
        rows = [dict(r) for r in await cur.fetchall()]
    assert len(rows) == 1
    assert rows[0]["value"] == "Impressionism"
    assert rows[0]["artwork_count"] == 1


@pytest.mark.asyncio
async def test_recompute_taste_profile(db):
    await db.execute(
        "INSERT INTO artworks (id, title, movement) VALUES (1, 'Art1', 'Impressionism')"
    )
    await db.execute(
        "INSERT INTO artworks (id, title, movement) VALUES (2, 'Art2', 'Impressionism')"
    )
    await db.execute(
        "INSERT INTO user_artworks (artwork_id, list_type, rating) VALUES (1, 'seen', 5)"
    )
    await db.execute(
        "INSERT INTO user_artworks (artwork_id, list_type, rating) VALUES (2, 'seen', 3)"
    )
    await db.commit()
    profile = await recompute_taste_profile(db)
    assert "movement" in profile
    assert "Impressionism" in profile["movement"]
    assert profile["movement"]["Impressionism"] == 4.0  # (5+3)/2
