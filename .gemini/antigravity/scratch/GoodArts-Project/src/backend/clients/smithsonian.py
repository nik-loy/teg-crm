"""GoodArts — Smithsonian API Client. Requires API key."""
import httpx
from src.backend.config import settings
from src.backend.clients.wikidata import _derive_era


def _parse_result(row: dict):
    content = row.get("content", {})
    desc = content.get("descriptiveNonRepeating", {})
    freetext = content.get("freetext", {})
    indexed = content.get("indexedStructured", {})
    title = desc.get("title", {}).get("content", "Untitled")
    if isinstance(title, list):
        title = title[0] if title else "Untitled"
    names = freetext.get("name", [])
    artist = None
    for n in names:
        if n.get("label") == "Artist":
            artist = n.get("content")
            break
    if not artist and names:
        artist = names[0].get("content")
    media = desc.get("online_media", {}).get("media", [])
    image_url = None
    for m in media:
        if m.get("type") == "Images":
            image_url = m.get("content")
            break
        if m.get("thumbnail"):
            image_url = m.get("thumbnail")
    if not image_url:
        return None
    year = None
    dates = indexed.get("date", [])
    if dates:
        try:
            year = int(str(dates[0])[:4])
        except (ValueError, TypeError):
            pass
    return {
        "title": title, "artist": artist, "year": year,
        "image_url": image_url, "image_url_hd": image_url,
        "source": "smithsonian", "source_id": row.get("id", ""),
        "museum": "Smithsonian", "museum_city": "Washington D.C.", "museum_country": "USA",
        "era": _derive_era(year),
    }


async def search_smithsonian(query: str, limit: int = 20) -> list:
    if not settings.SMITHSONIAN_API_KEY:
        return []
    params = {
        "api_key": settings.SMITHSONIAN_API_KEY,
        "q": f"{query} AND online_media_type:Images",
        "rows": limit,
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(settings.SMITHSONIAN_API_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    rows = data.get("response", {}).get("rows", [])
    return [r for r in [_parse_result(row) for row in rows] if r is not None]
