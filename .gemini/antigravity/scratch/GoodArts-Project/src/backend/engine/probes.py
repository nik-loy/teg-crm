"""
GoodArts — Verification Probe System
Detects taste drift by testing the profile against user responses.
"""
import random

import aiosqlite

from src.backend.database import crud


async def select_probes(db: aiosqlite.Connection, count: int = 3,
                        exclude_ids: set[int] = None) -> list[dict]:
    """
    Select probe artworks: 2 confirmation + 1 contradiction.
    Confirmation: artworks that SHOULD score high (top movements).
    Contradiction: artworks from LOW-scoring dimensions.
    """
    if exclude_ids is None:
        exclude_ids = set()

    profile = await crud.get_taste_profile(db)
    if not profile:
        return []

    # Separate high and low affinity movements
    movements = {r["value"]: r["affinity_score"]
                 for r in profile if r["dimension"] == "movement"}
    if not movements:
        return []

    sorted_movs = sorted(movements.items(), key=lambda x: x[1], reverse=True)
    high_movs = [m[0] for m in sorted_movs[:3]]
    low_movs = [m[0] for m in sorted_movs[-3:]] if len(sorted_movs) > 3 else []

    probes = []
    user_ids = await crud.get_user_artwork_ids(db)
    all_exclude = exclude_ids | user_ids

    # Confirmation probes (2): artworks from top movements
    confirmation_count = min(2, count - 1) if count > 1 else count
    if high_movs:
        placeholders = ", ".join("?" * len(high_movs))
        sql = f"""
            SELECT * FROM artworks
            WHERE movement IN ({placeholders}) AND image_url IS NOT NULL
            ORDER BY RANDOM() LIMIT ?
        """
        async with db.execute(sql, high_movs + [confirmation_count * 3]) as cur:
            candidates = [dict(r) for r in await cur.fetchall()]
        candidates = [c for c in candidates if c["id"] not in all_exclude]
        for c in candidates[:confirmation_count]:
            probes.append({
                "artwork": c,
                "probe_type": "confirmation",
                "expected_signal": "positive",
            })

    # Contradiction probes (1): artworks from low movements
    contradiction_count = count - len(probes)
    if low_movs and contradiction_count > 0:
        placeholders = ", ".join("?" * len(low_movs))
        sql = f"""
            SELECT * FROM artworks
            WHERE movement IN ({placeholders}) AND image_url IS NOT NULL
            ORDER BY RANDOM() LIMIT ?
        """
        async with db.execute(sql, low_movs + [contradiction_count * 3]) as cur:
            candidates = [dict(r) for r in await cur.fetchall()]
        candidates = [c for c in candidates if c["id"] not in all_exclude]
        for c in candidates[:contradiction_count]:
            probes.append({
                "artwork": c,
                "probe_type": "contradiction",
                "expected_signal": "negative",
            })

    return probes[:count]


async def evaluate_probe(db: aiosqlite.Connection, artwork_id: int,
                         probe_type: str, expected_signal: str,
                         actual_weight: int):
    """Record a probe response and check agreement."""
    if actual_weight > 0:
        actual_signal = "positive"
    elif actual_weight < 0:
        actual_signal = "negative"
    else:
        actual_signal = "neutral"

    agreed = (
        (expected_signal == "positive" and actual_signal == "positive") or
        (expected_signal == "negative" and actual_signal == "negative")
    )
    await crud.log_probe(db, artwork_id, probe_type, expected_signal, actual_signal, agreed)


def compute_drift_score(probes: list[dict]) -> float:
    """Fraction of disagreements in probe results. 0 = stable, 1 = full drift."""
    if not probes:
        return 0.0
    disagreements = sum(1 for p in probes if not p.get("agreed"))
    return disagreements / len(probes)
