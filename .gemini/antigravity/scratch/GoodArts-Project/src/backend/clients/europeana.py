"""
ArtLog — Europeana REST Client
Enriches search results with European cultural heritage data.
Requires EUROPEANA_API_KEY in .env (optional — gracefully degraded if missing).
"""
from typing import Optional
import httpx
from src.backend.config import settings


def _parse_europeana_item(item: dict) -> dict:
    """Parse one Europeana search result item."""
    title_list = item.get("title", ["Untitled"])
    title = title_list[0] if title_list else "Untitled"

    creator_list = item.get("dcCreator", [])
    artist = creator_list[0] if creator_list else None

    # Prefer edmPreview (HD thumbnail done right), then dataProvider image
    image_url = item.get("edmPreview", [None])[0]
    image_url_hd = item.get("edmIsShownBy", [None])[0] or image_url

    year = None
    year_list = item.get("year", [])
    if year_list:
        try:
            year = int(str(year_list[0])[:4])
        except (ValueError, TypeError):
            pass

    return {
        "title": title,
        "artist": artist,
        "year": year,
        "image_url": image_url,
        "image_url_hd": image_url_hd,
        "europeana_id": item.get("id"),
        "museum": (item.get("dataProvider") or [None])[0],
        "source": "europeana",
    }


async def search_europeana(query: str, limit: int = 40) -> list[dict]:
    """Search Europeana for artworks. Returns empty list if no API key is configured."""
    if not settings.EUROPEANA_API_KEY:
        return []

    params = {
        "wskey": settings.EUROPEANA_API_KEY,
        "query": query,
        "qf": "TYPE:IMAGE",
        "profile": "rich",
        "rows": limit,
        "sort": "score desc",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(settings.EUROPEANA_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        items = data.get("items", [])
        return [_parse_europeana_item(i) for i in items if i.get("edmPreview")]
    except httpx.HTTPError:
        return []
