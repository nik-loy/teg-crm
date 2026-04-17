"""
GoodArts — Feed Composition Engine
Produces 5-tier feed batches: taste-matched, popular, unexplored, probes, diverse.
"""
import random

import aiosqlite

from src.backend.config import settings
from src.backend.database import crud
from src.backend.engine.taste_profile import get_taste_profile_full
from src.backend.engine.probes import select_probes

DIMENSION_WEIGHTS = settings.DIMENSION_WEIGHTS

# Static must-see Wikidata IDs for popular slot
MUST_SEE_IDS = [
    "Q12418", "Q45585", "Q151679", "Q130979", "Q183399",
    "Q272942", "Q217541", "Q130531", "Q239014", "Q193048",
]

# Static Popular Museums (used by old recommend endpoint)
POPULAR_MUSEUMS = [
    {"name": "The Louvre",                    "city": "Paris",        "country": "France"},
    {"name": "The Metropolitan Museum of Art","city": "New York",     "country": "USA"},
    {"name": "The British Museum",            "city": "London",       "country": "UK"},
    {"name": "Uffizi Gallery",                "city": "Florence",     "country": "Italy"},
    {"name": "Rijksmuseum",                   "city": "Amsterdam",    "country": "Netherlands"},
    {"name": "Musée d'Orsay",                 "city": "Paris",        "country": "France"},
    {"name": "The Prado",                     "city": "Madrid",       "country": "Spain"},
    {"name": "Tate Modern",                   "city": "London",       "country": "UK"},
    {"name": "MoMA",                          "city": "New York",     "country": "USA"},
    {"name": "The Vatican Museums",           "city": "Vatican City", "country": "Vatican"},
]


def _score_artwork(artwork: dict, profile: dict) -> float:
    """Score artwork against taste profile. Profile entries have {score, confidence, count}."""
    total = 0.0

    for dim_name, weight in DIMENSION_WEIGHTS.items():
        dim_data = profile.get(dim_name, {})
        if dim_name == "geography":
            art_val = artwork.get("museum_city")
        else:
            art_val = artwork.get(dim_name)

        if art_val and art_val in dim_data:
            entry = dim_data[art_val]
            if isinstance(entry, dict):
                total += entry["score"] * entry.get("confidence", 1.0) * weight
            else:
                total += entry * weight

    return total


async def compose_feed_batch(db: aiosqlite.Connection, offset: int = 0,
                             limit: int = 20) -> list[dict]:
    """Build a feed batch with the 5-tier composition from the spec."""
    profile = await get_taste_profile_full(db)
    user_ids = await crud.get_user_artwork_ids(db)

    # Fetch all artworks with images that user hasn't interacted with
    async with db.execute(
        "SELECT * FROM artworks WHERE image_url IS NOT NULL ORDER BY id"
    ) as cur:
        all_artworks = [dict(r) for r in await cur.fetchall()]

    candidates = [a for a in all_artworks if a["id"] not in user_ids]
    if not candidates:
        return []

    batch_size = min(limit, len(candidates))
    batch = []
    used_ids = set()

    # -- Taste-matched (35%) --
    taste_count = int(batch_size * settings.FEED_TASTE_MATCHED)
    scored = [(a, _score_artwork(a, profile)) for a in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)
    for artwork, score in scored:
        if len(batch) >= taste_count:
            break
        if artwork["id"] not in used_ids and score > 0:
            batch.append({"artwork": artwork, "slot_type": "taste_matched", "score": score})
            used_ids.add(artwork["id"])

    # -- Popular (20%) --
    popular_count = int(batch_size * settings.FEED_POPULAR)
    popular = [a for a in candidates if a.get("wikidata_id") in MUST_SEE_IDS and a["id"] not in used_ids]
    random.shuffle(popular)
    for artwork in popular[:popular_count]:
        batch.append({"artwork": artwork, "slot_type": "popular", "score": 0})
        used_ids.add(artwork["id"])

    # -- Unexplored (20%) --
    unexplored_count = int(batch_size * settings.FEED_UNEXPLORED)
    if profile:
        unexplored_candidates = [
            a for a in candidates
            if a["id"] not in used_ids and not any(
                a.get(d) in profile.get(d, {}) for d in ["movement", "artist", "era"]
            )
        ]
    else:
        unexplored_candidates = [a for a in candidates if a["id"] not in used_ids]
    random.shuffle(unexplored_candidates)
    for artwork in unexplored_candidates[:unexplored_count]:
        batch.append({"artwork": artwork, "slot_type": "unexplored", "score": 0})
        used_ids.add(artwork["id"])

    # -- Probes (15%) --
    probe_count = int(batch_size * settings.FEED_PROBES)
    probes = await select_probes(db, count=probe_count, exclude_ids=used_ids)
    for probe in probes:
        artwork = probe["artwork"]
        batch.append({
            "artwork": artwork,
            "slot_type": "probe",
            "score": 0,
            "probe_type": probe["probe_type"],
            "expected_signal": probe["expected_signal"],
        })
        used_ids.add(artwork["id"])

    # -- Diverse (10%) --
    diverse_count = batch_size - len(batch)
    remaining = [a for a in candidates if a["id"] not in used_ids]
    random.shuffle(remaining)
    for artwork in remaining[:diverse_count]:
        batch.append({"artwork": artwork, "slot_type": "diverse", "score": 0})
        used_ids.add(artwork["id"])

    # Shuffle to prevent users from detecting slot patterns
    random.shuffle(batch)

    return batch[offset:offset + limit]


async def select_daily_masterpiece(db: aiosqlite.Connection) -> dict | None:
    """Pick today's featured artwork. Cached in user_settings until tomorrow."""
    from datetime import date

    s = await crud.get_settings(db)
    today = date.today().isoformat()

    if s.get("daily_masterpiece_date") == today and s.get("daily_masterpiece_id"):
        artwork = await crud.get_artwork(db, s["daily_masterpiece_id"])
        if artwork:
            return artwork

    # Pick from high-affinity unseen artworks
    profile = await get_taste_profile_full(db)
    user_ids = await crud.get_user_artwork_ids(db)

    async with db.execute(
        "SELECT * FROM artworks WHERE image_url IS NOT NULL"
    ) as cur:
        all_artworks = [dict(r) for r in await cur.fetchall()]

    candidates = [a for a in all_artworks if a["id"] not in user_ids]
    if not candidates:
        candidates = all_artworks  # Fallback: show seen artworks

    if not candidates:
        return None

    # Score and pick top candidate with variety (avoid same movement 2 days in a row)
    scored = [(a, _score_artwork(a, profile)) for a in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)

    # Get yesterday's movement to avoid repeating
    prev_id = s.get("daily_masterpiece_id")
    prev_movement = None
    if prev_id:
        prev = await crud.get_artwork(db, prev_id)
        if prev:
            prev_movement = prev.get("movement")

    chosen = None
    for artwork, score in scored[:10]:
        if artwork.get("movement") != prev_movement:
            chosen = artwork
            break
    if not chosen:
        chosen = scored[0][0] if scored else candidates[0]

    await crud.update_settings(db, {
        "daily_masterpiece_id": chosen["id"],
        "daily_masterpiece_date": today,
    })
    return chosen


async def generate_recommendations(db: aiosqlite.Connection) -> dict:
    """Legacy 4-tier recommendations (used by /recommend endpoint)."""
    from src.backend.engine.taste_profile import get_taste_profile_dict
    profile = await get_taste_profile_dict(db)
    user_ids = await crud.get_user_artwork_ids(db)

    all_artworks = await crud.get_all_artworks(db)
    candidates = [a for a in all_artworks if a["id"] not in user_ids]

    scored = []
    for artwork in candidates:
        score = _score_artwork(artwork, profile)
        if score > 0:
            scored.append({"artwork": artwork, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)

    return {
        "personalized_artworks": scored[:20],
        "must_see_artworks": [a for a in all_artworks if a.get("wikidata_id") in MUST_SEE_IDS and a["id"] not in user_ids],
        "popular_museums": POPULAR_MUSEUMS,
    }
