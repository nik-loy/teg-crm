"""
GoodArts — Adaptive Half-Life Taste Profile Engine
Tracks per-dimension affinity with decay, confidence, and sentiment awareness.
"""
import math
from collections import defaultdict
from datetime import datetime
from typing import Optional

import aiosqlite

from src.backend.config import settings
from src.backend.database import crud


BASE_HALF_LIFE = settings.BASE_HALF_LIFE_DAYS
CONFIDENCE_THRESHOLD = settings.CONFIDENCE_THRESHOLD
DIMENSION_WEIGHTS = settings.DIMENSION_WEIGHTS


def compute_effective_half_life(rating_count: int, sentiment_multiplier: float) -> float:
    """Stable dimensions decay slower. More ratings = more inertia."""
    return BASE_HALF_LIFE * (1 + math.log2(max(rating_count, 1))) * sentiment_multiplier


def compute_decayed_score(raw_score: float, days_since: float, half_life: float) -> float:
    """Exponential decay: score halves every half_life days."""
    if days_since <= 0:
        return raw_score
    return raw_score * (2 ** (-days_since / half_life))


def compute_confidence(rating_count: int, days_since_last: float) -> float:
    """Confidence: grows with count, decays if no recent ratings."""
    base = min(1.0, rating_count / CONFIDENCE_THRESHOLD)
    if days_since_last <= 60:
        recency = 1.0
    else:
        recency = max(0.1, 1.0 - (days_since_last - 60) / 300)
    return base * recency


def _sentiment_multiplier(sentiment_sum: float, count: int) -> float:
    """Derive sentiment multiplier from accumulated sentiment signals."""
    if count == 0:
        return 1.0
    avg = sentiment_sum / count
    if avg > 0.5:
        return 1.5  # Consistent positive
    elif avg < -0.3:
        return 0.7  # Consistent negative
    return 1.0  # Mixed


def _extract_dimensions(artwork: dict) -> list[tuple[str, str]]:
    """Extract (dimension, value) pairs from an artwork dict."""
    dims = []
    if artwork.get("movement"):
        dims.append(("movement", artwork["movement"]))
    if artwork.get("artist"):
        dims.append(("artist", artwork["artist"]))
    if artwork.get("era"):
        dims.append(("era", artwork["era"]))
    if artwork.get("museum_city"):
        dims.append(("geography", artwork["museum_city"]))
    if artwork.get("medium"):
        dims.append(("medium", artwork["medium"]))
    return dims


async def record_taste_signal(db: aiosqlite.Connection, artwork_id: int, weight: int):
    """Incrementally update taste profile when user rates/swipes an artwork."""
    artwork = await crud.get_artwork(db, artwork_id)
    if not artwork:
        return

    sentiment = 1.0 if weight > 0 else (-1.0 if weight < 0 else 0.0)

    for dimension, value in _extract_dimensions(artwork):
        # Fetch existing entry
        sql = "SELECT affinity_score, artwork_count, sentiment_sum FROM taste_profile WHERE dimension=? AND value=?"
        async with db.execute(sql, (dimension, value)) as cur:
            row = await cur.fetchone()

        if row:
            old_score = row[0]
            old_count = row[1]
            old_sentiment = row[2] or 0.0
            new_count = old_count + 1
            # Running average weighted by signal strength
            normalized_weight = max(-1.0, min(1.0, weight / 5.0))
            new_score = ((old_score * old_count) + normalized_weight) / new_count
            new_sentiment = old_sentiment + sentiment
        else:
            new_count = 1
            new_score = max(-1.0, min(1.0, weight / 5.0))
            new_sentiment = sentiment

        sql = """
            INSERT INTO taste_profile (dimension, value, affinity_score, artwork_count, last_rating_at, sentiment_sum)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(dimension, value) DO UPDATE SET
                affinity_score=excluded.affinity_score,
                artwork_count=excluded.artwork_count,
                last_rating_at=CURRENT_TIMESTAMP,
                sentiment_sum=excluded.sentiment_sum,
                updated_at=CURRENT_TIMESTAMP
        """
        await db.execute(sql, (dimension, value, new_score, new_count, new_sentiment))
    await db.commit()


async def recompute_taste_profile(db: aiosqlite.Connection) -> dict:
    """Full rebuild from rated artworks. Used after onboarding or manual recalibration."""
    rated = await crud.get_rated_artworks(db)
    if not rated:
        return {}

    buckets: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    for row in rated:
        rating = row["rating"]
        if row.get("movement"):
            buckets["movement"][row["movement"]].append(rating)
        if row.get("artist"):
            buckets["artist"][row["artist"]].append(rating)
        if row.get("era"):
            buckets["era"][row["era"]].append(rating)
        if row.get("medium"):
            buckets["medium"][row["medium"]].append(rating)
        if row.get("museum_city"):
            buckets["geography"][row["museum_city"]].append(rating)

    await crud.clear_taste_profile(db)
    profile: dict[str, dict[str, float]] = {}

    for dimension, values in buckets.items():
        profile[dimension] = {}
        for value, ratings in values.items():
            score = sum(ratings) / len(ratings)
            count = len(ratings)
            profile[dimension][value] = score
            await crud.upsert_taste_entry(db, dimension, value, score, count)

    return profile


async def get_taste_profile_dict(db: aiosqlite.Connection) -> dict[str, dict[str, float]]:
    """Load stored profile as nested dict (no decay applied)."""
    rows = await crud.get_taste_profile(db)
    profile: dict[str, dict[str, float]] = defaultdict(dict)
    for row in rows:
        profile[row["dimension"]][row["value"]] = row["affinity_score"]
    return dict(profile)


async def get_taste_profile_full(db: aiosqlite.Connection) -> dict[str, dict[str, dict]]:
    """Load profile with decay and confidence applied."""
    rows = await crud.get_taste_profile(db)
    now = datetime.utcnow()
    profile: dict[str, dict[str, dict]] = defaultdict(dict)

    for row in rows:
        count = row["artwork_count"]
        sentiment_sum = row.get("sentiment_sum") or 0.0
        last_rating = row.get("last_rating_at")

        if last_rating:
            try:
                last_dt = datetime.fromisoformat(last_rating)
                days_since = (now - last_dt).days
            except (ValueError, TypeError):
                days_since = 0
        else:
            days_since = 0

        sm = _sentiment_multiplier(sentiment_sum, count)
        hl = compute_effective_half_life(count, sm)
        decayed = compute_decayed_score(row["affinity_score"], days_since, hl)
        conf = compute_confidence(count, days_since)

        profile[row["dimension"]][row["value"]] = {
            "score": decayed,
            "raw_score": row["affinity_score"],
            "confidence": conf,
            "count": count,
            "half_life": hl,
        }

    return dict(profile)
