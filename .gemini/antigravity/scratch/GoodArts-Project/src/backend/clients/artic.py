"""
GoodArts — Art Institute of Chicago API Client
Tier 2 provider: excellent Impressionist/modern collection with IIIF images.
No API key required.
"""
import httpx
from src.backend.config import settings
from src.backend.clients.wikidata import _derive_era

IIIF_BASE = "https://www.artic.edu/iiif/2"


def _iiif_url(image_id: str, full_res: bool = False) -> str:
    size = "max" if full_res else "843,"
    return f"{IIIF_BASE}/{image_id}/full/{size}/0/default.jpg"


def _parse_artwork(data: dict) -> dict:
    image_id = data.get("image_id")
    year = data.get("date_end")
    return {
        "title": data.get("title", "Untitled"),
        "artist": data.get("artist_title"),
        "year": year,
        "medium": data.get("medium_display"),
        "movement": data.get("style_title"),
        "image_url": _iiif_url(image_id) if image_id else None,
        "image_url_hd": _iiif_url(image_id, full_res=True) if image_id else None,
        "source": "artic",
        "source_id": str(data.get("id", "")),
        "museum": "Art Institute of Chicago",
        "museum_city": "Chicago",
        "museum_country": "USA",
        "era": _derive_era(year),
    }


async def search_artic(query: str, limit: int = 20) -> list:
    """Search Art Institute of Chicago. No API key needed."""
    params = {
        "q": query,
        "limit": limit,
        "fields": "id,title,artist_title,date_end,image_id,medium_display,style_title,place_of_origin",
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(f"{settings.ARTIC_API_URL}/search", params=params)
        resp.raise_for_status()
        data = resp.json()
    return [_parse_artwork(item) for item in data.get("data", []) if item.get("image_id")]
