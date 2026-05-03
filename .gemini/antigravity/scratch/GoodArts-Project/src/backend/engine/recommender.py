"""
GoodArts — Feed Composition Engine
Phase-aware feed that evolves as the user's taste profile matures.

User phases (based on total artworks seen):
  cold_start  (<30)   — wide discovery to build initial taste signal quickly
  learning    (30-100) — preferences emerging; balanced exploration and matching
  refined     (100-300)— profile established; targeted deep dive unlocks
  long_term   (300+)  — highly personalized with sustained variety
"""
import asyncio
import random

import aiosqlite

from src.backend.config import settings
from src.backend.database import crud
from src.backend.engine.taste_profile import get_taste_profile_full
from src.backend.engine.artwork_fetcher import refill_artwork_buffer

DIMENSION_WEIGHTS = settings.DIMENSION_WEIGHTS

MUST_SEE_IDS = [
    "Q12418", "Q45585", "Q151679", "Q130979", "Q183399",
    "Q272942", "Q217541", "Q130531", "Q239014", "Q193048",
]

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

# Feed slot weights per phase. Proportions must sum to ~1.0.
# deep_dive is 0 in cold_start — no signal to dive into yet.
_PHASE_WEIGHTS = {
    "cold_start": {"taste": 0.10, "deep_dive": 0.00, "discovery": 0.40, "cultural": 0.25, "wild_card": 0.25},
    "learning":   {"taste": 0.25, "deep_dive": 0.10, "discovery": 0.30, "cultural": 0.20, "wild_card": 0.15},
    "refined":    {"taste": 0.35, "deep_dive": 0.20, "discovery": 0.20, "cultural": 0.15, "wild_card": 0.10},
    "long_term":  {"taste": 0.40, "deep_dive": 0.25, "discovery": 0.15, "cultural": 0.10, "wild_card": 0.10},
}

# Deep dive only fires when a dimension has accumulated enough confirmed signal.
# count>=5 avoids over-committing to a preference from just 1-2 coincidental likes.
_DEEP_DIVE_MIN_COUNT = 5
_DEEP_DIVE_MIN_SCORE = 0.2
_DEEP_DIVE_MIN_CONF  = 0.5


def _get_user_phase(seen_count: int) -> str:
    if seen_count < 30:
        return "cold_start"
    if seen_count < 100:
        return "learning"
    if seen_count < 300:
        return "refined"
    return "long_term"


def _score_artwork(artwork: dict, profile: dict) -> float:
    total = 0.0
    for dim_name, weight in DIMENSION_WEIGHTS.items():
        dim_data = profile.get(dim_name, {})
        art_val = artwork.get("museum_city") if dim_name == "geography" else artwork.get(dim_name)
        if art_val and art_val in dim_data:
            entry = dim_data[art_val]
            if isinstance(entry, dict):
                total += entry["score"] * entry.get("confidence", 1.0) * weight
            else:
                total += entry * weight
    return total


def _select_taste_matched(candidates: list, profile: dict, count: int, used_ids: set) -> list:
    available = [a for a in candidates if a["id"] not in used_ids]
    scored = [(a, _score_artwork(a, profile)) for a in available]
    scored.sort(key=lambda x: x[1], reverse=True)
    result = []
    for artwork, score in scored:
        if len(result) >= count:
            break
        if score > 0:
            result.append({"artwork": artwork, "slot_type": "taste_matched", "score": score})
            used_ids.add(artwork["id"])
    return result


def _select_deep_dive(candidates: list, profile: dict, count: int, used_ids: set) -> list:
    """
    Reinforce the user's strongest confirmed preferences.
    Only activates once count >= 5 AND positive score AND confidence > 0.5,
    preventing over-commitment to preferences inferred from too few data points.
    """
    top_dims: list[tuple[str, str, float]] = []
    for dim_name in ("movement", "artist", "era"):
        for value, data in profile.get(dim_name, {}).items():
            if (data["count"] >= _DEEP_DIVE_MIN_COUNT
                    and data["score"] > _DEEP_DIVE_MIN_SCORE
                    and data["confidence"] > _DEEP_DIVE_MIN_CONF):
                top_dims.append((dim_name, value, data["score"] * data["confidence"]))

    if not top_dims:
        return []

    top_dims.sort(key=lambda x: x[2], reverse=True)
    result = []
    for dim_name, value, _ in top_dims:
        if len(result) >= count:
            break
        pool = [a for a in candidates
                if a["id"] not in used_ids and a.get(dim_name) == value]
        random.shuffle(pool)
        for artwork in pool:
            if len(result) >= count:
                break
            result.append({"artwork": artwork, "slot_type": "deep_dive", "score": 0})
            used_ids.add(artwork["id"])
    return result


def _select_discovery(candidates: list, profile: dict, phase: str,
                      count: int, used_ids: set) -> list:
    """
    Select artworks from movements the user has barely explored.

    Degrades gracefully through three tiers — never exhausts:
      1. Primary: movements at/below the phase threshold (truly new territory)
      2. Fallback: all candidates sorted by least-seen movement (always has results)

    Phase threshold:
      cold_start/learning → 0 (only movements never seen at all)
      refined/long_term   → 3 (movements seen fewer than 3 times)
    """
    movement_counts = {
        v: data["count"] for v, data in profile.get("movement", {}).items()
    }
    threshold = 0 if phase in ("cold_start", "learning") else 3

    available = [a for a in candidates if a["id"] not in used_ids]

    primary = [a for a in available
               if movement_counts.get(a.get("movement"), 0) <= threshold]

    if len(primary) >= count:
        random.shuffle(primary)
        pool = primary
    else:
        # Sort by how little the user has encountered each movement
        available.sort(key=lambda a: movement_counts.get(a.get("movement"), 0))
        pool = available

    result = []
    for artwork in pool[:count]:
        result.append({"artwork": artwork, "slot_type": "discovery", "score": 0})
        used_ids.add(artwork["id"])
    return result


def _select_cultural(candidates: list, count: int, used_ids: set) -> list:
    """Famous/canonical works — builds art literacy regardless of personal taste."""
    pool = [a for a in candidates
            if a.get("wikidata_id") in MUST_SEE_IDS and a["id"] not in used_ids]
    random.shuffle(pool)
    result = []
    for artwork in pool[:count]:
        result.append({"artwork": artwork, "slot_type": "cultural_literacy", "score": 0})
        used_ids.add(artwork["id"])
    return result


def _select_wild_card(candidates: list, count: int, used_ids: set) -> list:
    """Completely random — maximum serendipity, no filters applied."""
    pool = [a for a in candidates if a["id"] not in used_ids]
    random.shuffle(pool)
    result = []
    for artwork in pool[:count]:
        result.append({"artwork": artwork, "slot_type": "wild_card", "score": 0})
        used_ids.add(artwork["id"])
    return result


async def compose_feed_batch(db: aiosqlite.Connection, offset: int = 0,
                             limit: int = 20) -> list[dict]:
    """
    Build a phase-aware feed batch.

    Slot mix shifts automatically as the user's taste matures:
    - Cold start: discovery-heavy to build taste signal fast
    - Learning: mix emerges as preferences surface
    - Refined/long-term: personalized core with sustained discovery

    Artworks are drawn from the local cache (never-seen first).
    60-day cooldown reintroduction only activates when the unseen pool
    genuinely runs low — with 65k CMA artworks this should be rare.
    """
    stats = await crud.get_stats(db)
    seen_count = stats.get("seen_count", 0)
    phase = _get_user_phase(seen_count)
    weights = _PHASE_WEIGHTS[phase]

    profile = await get_taste_profile_full(db)
    user_ids = await crud.get_user_artwork_ids(db)

    async with db.execute(
        "SELECT * FROM artworks WHERE image_url IS NOT NULL ORDER BY id"
    ) as cur:
        all_artworks = [dict(r) for r in await cur.fetchall()]

    unseen = [a for a in all_artworks if a["id"] not in user_ids]

    # Block and refill when unseen pool is too small to serve this request and
    # the next few — avoids gaps in infinite scroll on first launch (seed data = 10).
    need = offset + limit
    if len(unseen) < max(need, 30):
        await refill_artwork_buffer(db, min_target=max(need + 150, 200))
        async with db.execute(
            "SELECT * FROM artworks WHERE image_url IS NOT NULL ORDER BY id"
        ) as cur:
            all_artworks = [dict(r) for r in await cur.fetchall()]
        unseen = [a for a in all_artworks if a["id"] not in user_ids]
    elif len(unseen) < 150:
        try:
            asyncio.create_task(refill_artwork_buffer(db))
        except RuntimeError:
            pass

    # 60-day cooldown reintroduction — only when unseen pool is genuinely exhausted
    candidates = unseen
    if len(unseen) < limit:
        recently_seen_ids = await crud.get_recently_seen_artwork_ids(db, days=60)
        cooldown_eligible = [
            a for a in all_artworks
            if a["id"] in user_ids and a["id"] not in recently_seen_ids
        ]
        candidates = unseen + cooldown_eligible

    if not candidates:
        return []

    batch_size = min(offset + limit, len(candidates))
    batch: list[dict] = []
    used_ids: set[int] = set()

    # Deep dive fills first (zero slots in cold_start since weight=0.00)
    deep_dive_count = int(batch_size * weights["deep_dive"])
    if deep_dive_count > 0:
        batch += _select_deep_dive(candidates, profile, deep_dive_count, used_ids)

    # Taste-matched
    taste_count = int(batch_size * weights["taste"])
    batch += _select_taste_matched(candidates, profile, taste_count, used_ids)

    # Discovery — artworks from movements the user hasn't explored
    discovery_count = int(batch_size * weights["discovery"])
    batch += _select_discovery(candidates, profile, phase, discovery_count, used_ids)

    # Cultural literacy — famous works regardless of taste
    cultural_count = int(batch_size * weights["cultural"])
    batch += _select_cultural(candidates, cultural_count, used_ids)

    # Wild card fills the remainder (absorbs any rounding slack too)
    wild_count = batch_size - len(batch)
    batch += _select_wild_card(candidates, wild_count, used_ids)

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

    profile = await get_taste_profile_full(db)
    user_ids = await crud.get_user_artwork_ids(db)

    async with db.execute(
        "SELECT * FROM artworks WHERE image_url IS NOT NULL"
    ) as cur:
        all_artworks = [dict(r) for r in await cur.fetchall()]

    candidates = [a for a in all_artworks if a["id"] not in user_ids]
    if not candidates:
        candidates = all_artworks

    if not candidates:
        return None

    scored = [(a, _score_artwork(a, profile)) for a in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)

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


async def recommend_for_exhibition(db: aiosqlite.Connection, exhibition: dict) -> dict:
    """Find artworks and artists in the user's taste profile that match an exhibition."""
    import json
    profile = await get_taste_profile_full(db)

    # Parse tags
    try:
        exh_artists = json.loads(exhibition.get("artist_tags") or "[]")
    except Exception:
        exh_artists = [a.strip() for a in (exhibition.get("artist_tags") or "").split(",") if a.strip()]

    try:
        exh_movements = json.loads(exhibition.get("movement_tags") or "[]")
    except Exception:
        exh_movements = [m.strip() for m in (exhibition.get("movement_tags") or "").split(",") if m.strip()]

    # 1. Matching Artists
    user_artists = profile.get("artist", {})
    recommended_artists = [a for a in exh_artists if a in user_artists and user_artists[a]["score"] > 0]
    # Fallback to featured artists if no match
    if not recommended_artists:
        recommended_artists = exh_artists[:3]

    # 2. Matching Artworks (from local DB)
    all_artworks = await crud.get_all_artworks(db)
    matches = []
    for artwork in all_artworks:
        score = 0
        if artwork.get("artist") in exh_artists:
            score += 1.0
        if artwork.get("movement") in exh_movements:
            score += 0.5

        if score > 0:
            # Multiply by user affinity
            user_score = _score_artwork(artwork, profile)
            final_score = score * (user_score + 1.0)
            matches.append({"artwork": artwork, "score": final_score})

    matches.sort(key=lambda x: x["score"], reverse=True)

    return {
        "recommended_artists": recommended_artists,
        "recommended_artworks": [m["artwork"] for m in matches[:6]]
    }
