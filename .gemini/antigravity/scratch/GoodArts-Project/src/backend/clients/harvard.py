"""
GoodArts — Harvard Art Museums API Client
Tier 1 provider: broad collection with IIIF max-resolution images.
Requires API key from harvardartmuseums.org/collections/api.
"""
import httpx
from src.backend.config import settings
from src.backend.clients.wikidata import _derive_era


def _parse_artwork(record: dict) -> dict:
    people = record.get("people") or []
    artist = people[0]["name"] if people else None
    year = None
    dated = record.get("dated")
    if dated:
        try:
            year = int(str(dated)[:4])
        except (ValueError, TypeError):
            pass

    primary = record.get("primaryimageurl")
    # Harvard supports IIIF: append /full/full/0/default.jpg for max res
    image_url_hd = primary
    if primary and "iiif" in primary.lower():
        image_url_hd = primary.rsplit("?", 1)[0]

    return {
        "title": record.get("title", "Untitled"),
        "artist": artist,
        "year": year,
        "medium": record.get("medium"),
        "movement": record.get("style"),
        "image_url": primary,
        "image_url_hd": image_url_hd,
        "source": "harvard",
        "source_id": str(record.get("objectid", "")),
        "museum": "Harvard Art Museums",
        "museum_city": "Cambridge",
        "museum_country": "USA",
        "era": _derive_era(year),
    }


async def search_harvard(query: str, limit: int = 20) -> list[dict]:
    """Search Harvard Art Museums. Returns empty list if no API key."""
    if not settings.HARVARD_API_KEY:
        return []

    params = {
        "apikey": settings.HARVARD_API_KEY,
        "q": query,
        "size": limit,
        "hasimage": 1,
        "classification": "Paintings",
        "sort": "rank",
        "sortorder": "desc",
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(settings.HARVARD_API_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    records = data.get("records", [])
    return [_parse_artwork(r) for r in records if r.get("primaryimageurl")]
