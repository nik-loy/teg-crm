"""
GoodArts — Artwork Buffer Refill
Fetches artworks from the Cleveland Museum of Art Open Access API.
No API key required. Images served from openaccess-cdn.clevelandart.org
with no bot-protection — reliably loadable in browsers.
"""
import asyncio
import re
import random
import httpx
import aiosqlite

CMA_API_URL = "https://openaccess-api.clevelandart.org/api/artworks/"

# Artwork types to rotate through for variety
ART_TYPES = [
    "Painting", "Drawing", "Print", "Watercolor",
    "Pastel", "Miniature",
]

# Culture filters for geographic diversity
CULTURES = [
    "France", "Netherlands", "Italy", "Spain",
    "Germany", "England", "America", "Japan",
]

_FETCH_SEMAPHORE = None

def get_fetch_semaphore():
    global _FETCH_SEMAPHORE
    if _FETCH_SEMAPHORE is None:
        _FETCH_SEMAPHORE = asyncio.Semaphore(6)
    return _FETCH_SEMAPHORE
_YEAR_RE = re.compile(r"\b(\d{4})\b")


def _parse_year(date_str: str | None) -> int | None:
    if not date_str:
        return None
    m = _YEAR_RE.search(date_str)
    return int(m.group(1)) if m else None


def _parse_artist(creators: list | None) -> str | None:
    if not creators:
        return None
    desc = creators[0].get("description", "") if creators else ""
    # "Vincent van Gogh (Dutch, 1853–1890)" → "Vincent van Gogh"
    return desc.split("(")[0].strip() or None


def _parse_era(culture: list | None, date_str: str | None) -> str | None:
    if culture:
        return culture[0] if isinstance(culture, list) else str(culture)
    year = _parse_year(date_str)
    if not year:
        return None
    if year < 1400:
        return "Medieval"
    if year < 1600:
        return "Renaissance"
    if year < 1750:
        return "Baroque"
    if year < 1850:
        return "Neoclassical / Romantic"
    if year < 1900:
        return "19th Century"
    return "Modern"


def _parse_cma_object(obj: dict) -> dict | None:
    imgs = obj.get("images") or {}
    web = (imgs.get("web") or {}).get("url")
    hd = (imgs.get("print") or {}).get("url") or (imgs.get("full") or {}).get("url")
    if not web:
        return None

    dept = obj.get("department") or ""
    movement = obj.get("style") or dept or None

    return {
        "title": obj.get("title") or "Untitled",
        "artist": _parse_artist(obj.get("creators")),
        "year": _parse_year(obj.get("creation_date")),
        "medium": obj.get("technique"),
        "movement": movement,
        "era": _parse_era(obj.get("culture"), obj.get("creation_date")),
        "museum": "Cleveland Museum of Art",
        "museum_city": "Cleveland",
        "museum_country": "United States",
        "image_url": web,
        "image_url_hd": hd,
        "description": obj.get("description"),
        "source": "cma",
        "source_id": str(obj["id"]),
    }


async def _count_with_images(db: aiosqlite.Connection) -> int:
    async with db.execute(
        "SELECT COUNT(*) FROM artworks WHERE image_url IS NOT NULL"
    ) as cur:
        return (await cur.fetchone())[0]


async def _source_id_exists(db: aiosqlite.Connection, source_id: str) -> bool:
    async with db.execute(
        "SELECT id FROM artworks WHERE source_id = ? AND source = 'cma'",
        (source_id,),
    ) as cur:
        return (await cur.fetchone()) is not None


async def _insert_artwork(db: aiosqlite.Connection, artwork: dict) -> None:
    cols = list(artwork.keys())
    vals = [artwork[k] for k in cols]
    placeholders = ", ".join("?" * len(cols))
    await db.execute(
        f"INSERT OR IGNORE INTO artworks ({', '.join(cols)}) VALUES ({placeholders})",
        vals,
    )
    await db.commit()


async def _fetch_cma_page(
    art_type: str, skip: int = 0, limit: int = 60
) -> list[dict]:
    """Fetch a page of CMA public-domain artworks of a given type."""
    async with get_fetch_semaphore():
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    CMA_API_URL,
                    params={
                        "has_image": 1,
                        "cc0": 1,
                        "type": art_type,
                        "limit": limit,
                        "skip": skip,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            results = []
            for obj in data.get("data") or []:
                parsed = _parse_cma_object(obj)
                if parsed:
                    results.append(parsed)
            return results
        except Exception:
            return []


async def _fetch_cma_culture(
    culture: str, skip: int = 0, limit: int = 60
) -> list[dict]:
    """Fetch CMA paintings filtered by culture for geographic variety."""
    async with get_fetch_semaphore():
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    CMA_API_URL,
                    params={
                        "has_image": 1,
                        "cc0": 1,
                        "culture": culture,
                        "type": "Painting",
                        "limit": limit,
                        "skip": skip,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            results = []
            for obj in data.get("data") or []:
                parsed = _parse_cma_object(obj)
                if parsed:
                    results.append(parsed)
            return results
        except Exception:
            return []


async def _get_fetch_offset(db: aiosqlite.Connection) -> int:
    try:
        async with db.execute(
            "SELECT cma_fetch_offset FROM user_settings WHERE id=1"
        ) as cur:
            row = await cur.fetchone()
            return int(row[0]) if row and row[0] else 0
    except Exception:
        return 0


async def _set_fetch_offset(db: aiosqlite.Connection, value: int) -> None:
    try:
        await db.execute(
            "UPDATE user_settings SET cma_fetch_offset=? WHERE id=1", (value,)
        )
        await db.commit()
    except Exception:
        pass


async def refill_artwork_buffer(db: aiosqlite.Connection, min_target: int = 500) -> int:
    """
    Top up the artwork DB to at least min_target artworks with images.
    Returns the number of new artworks added.

    Each call fans out across ALL art types and cultures in parallel,
    advancing a persistent page offset so successive calls explore new
    territory rather than re-fetching the same pages.

    CMA has ~65 000 public-domain artworks — this is effectively unlimited.
    """
    current = await _count_with_images(db)
    if current >= min_target:
        return 0

    # Advance offset by 60 each call so we walk through the full 65k catalogue
    base_skip = await _get_fetch_offset(db)
    next_skip = base_skip + 60
    await _set_fetch_offset(db, next_skip % 60000)  # wrap at 60000 (~full CMA catalogue)

    # Fan out: every art type + every culture, all in parallel
    tasks = [_fetch_cma_page(art_type, skip=base_skip) for art_type in ART_TYPES]
    tasks += [_fetch_cma_culture(culture, skip=base_skip) for culture in CULTURES]
    results = await asyncio.gather(*tasks)

    candidates_raw = [a for batch in results for a in batch]

    seen: set[str] = set()
    unique: list[dict] = []
    for a in candidates_raw:
        sid = a.get("source_id")
        if sid and sid not in seen:
            seen.add(sid)
            unique.append(a)

    random.shuffle(unique)

    added = 0
    for artwork in unique:
        source_id = artwork.get("source_id")
        if not source_id:
            continue
        if await _source_id_exists(db, source_id):
            continue
        await _insert_artwork(db, artwork)
        added += 1

    return added
