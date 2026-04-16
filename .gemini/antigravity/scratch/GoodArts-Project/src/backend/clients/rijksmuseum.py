"""
GoodArts — Rijksmuseum API Client
Tier 1 provider: highest quality Dutch/Flemish art with 4500px tile images.
"""
import httpx
from src.backend.config import settings
from src.backend.clients.wikidata import _derive_era


def _parse_artwork(obj: dict) -> dict:
    web_image = obj.get("webImage") or {}
    dating = obj.get("dating") or {}
    year = dating.get("sortingDate")
    image_url = web_image.get("url")
    image_url_hd = image_url.replace("=s0", "") if image_url else None
    return {
        "title": obj.get("title", "Untitled"),
        "artist": obj.get("principalOrFirstMaker"),
        "year": year,
        "image_url": image_url,
        "image_url_hd": image_url_hd,
        "source": "rijksmuseum",
        "source_id": obj.get("objectNumber"),
        "museum": "Rijksmuseum",
        "museum_city": "Amsterdam",
        "museum_country": "Netherlands",
        "era": _derive_era(year),
    }


async def search_rijksmuseum(query: str, limit: int = 20) -> list:
    """Search Rijksmuseum collection. Returns empty list if no API key."""
    if not settings.RIJKSMUSEUM_API_KEY:
        return []
    params = {
        "key": settings.RIJKSMUSEUM_API_KEY,
        "q": query,
        "ps": limit,
        "imgonly": "true",
        "type": "painting",
        "s": "relevance",
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(settings.RIJKSMUSEUM_API_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    return [_parse_artwork(obj) for obj in data.get("artObjects", []) if obj.get("webImage")]
