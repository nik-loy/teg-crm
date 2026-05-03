"""
GoodArts — Metropolitan Museum API Client
Tier 2 provider: encyclopedic collection, 470K+ objects, open access.
No API key required.
"""
import asyncio
import httpx
from src.backend.config import settings
from src.backend.clients.wikidata import _derive_era


def _parse_object(obj: dict) -> dict:
    year = None
    end_date = obj.get("objectEndDate")
    if end_date and isinstance(end_date, (int, float)) and end_date != 0:
        year = int(end_date)

    return {
        "title": obj.get("title", "Untitled"),
        "artist": obj.get("artistDisplayName") or None,
        "year": year,
        "medium": obj.get("medium"),
        "movement": obj.get("classification"),
        "image_url": obj.get("primaryImageSmall") or obj.get("primaryImage"),
        "image_url_hd": obj.get("primaryImage"),
        "source": "met",
        "source_id": str(obj.get("objectID", "")),
        "museum": "The Metropolitan Museum of Art",
        "museum_city": "New York",
        "museum_country": "USA",
        "era": _derive_era(year),
    }


async def search_met(query: str, limit: int = 20) -> list[dict]:
    """Search Met collection. Two-step: search IDs then fetch objects."""
    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(
            settings.MET_SEARCH_URL,
            params={"q": query, "hasImages": "true"},
        )
        resp.raise_for_status()
        data = resp.json()

    object_ids = data.get("objectIDs") or []
    object_ids = object_ids[:min(limit, 10)]  # Cap parallel requests

    if not object_ids:
        return []

    async def fetch_one(oid: int) -> dict | None:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(f"{settings.MET_OBJECT_URL}/{oid}")
                resp.raise_for_status()
                obj = resp.json()
            if obj.get("primaryImage"):
                return _parse_object(obj)
        except Exception:
            pass
        return None

    results = await asyncio.gather(*[fetch_one(oid) for oid in object_ids])
    return [r for r in results if r is not None]
