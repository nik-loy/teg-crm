"""
GoodArts — Artsy API Client
Fetches exhibition data. Requires ARTSY_CLIENT_ID and ARTSY_CLIENT_SECRET.
"""
import httpx
from src.backend.config import settings

_token_cache: dict = {"token": None}


async def _get_token() -> str | None:
    """Fetch xapp token from Artsy. Cached in-memory."""
    if _token_cache["token"]:
        return _token_cache["token"]

    if not settings.ARTSY_CLIENT_ID or not settings.ARTSY_CLIENT_SECRET:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.ARTSY_API_URL}/tokens/xapp_token",
                json={
                    "client_id": settings.ARTSY_CLIENT_ID,
                    "client_secret": settings.ARTSY_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()
            _token_cache["token"] = resp.json().get("token")
            return _token_cache["token"]
    except Exception:
        return None


async def fetch_exhibitions(city: str = None, status: str = "current") -> list[dict]:
    """Fetch exhibitions from Artsy. Returns list of exhibition dicts."""
    token = await _get_token()
    if not token:
        return []

    headers = {"X-Xapp-Token": token}
    params = {"status": status, "size": 20}
    if city:
        params["near"] = city

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                f"{settings.ARTSY_API_URL}/shows",
                headers=headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

        shows = data.get("_embedded", {}).get("shows", [])
        results = []
        for show in shows:
            loc = show.get("_embedded", {}).get("location", {}) or {}
            results.append({
                "title": show.get("name", "Untitled Show"),
                "description": show.get("description"),
                "venue_name": show.get("partner", {}).get("name") if show.get("partner") else None,
                "city": loc.get("city") or city,
                "country": loc.get("country"),
                "start_date": show.get("start_at", "")[:10] if show.get("start_at") else None,
                "end_date": show.get("end_at", "")[:10] if show.get("end_at") else None,
                "image_url": (show.get("_links", {}).get("thumbnail", {}) or {}).get("href"),
                "source": "artsy",
                "source_id": show.get("id"),
                "url": show.get("_links", {}).get("permalink", {}).get("href"),
            })
        return results
    except Exception:
        return []
