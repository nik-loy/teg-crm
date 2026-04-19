"""ARTIC (Art Institute of Chicago) — Technical metadata for artwork dossier."""
import difflib
import json

import httpx

_SEARCH_URL = "https://api.artic.edu/api/v1/artworks/search"
_FIELDS = (
    "id,title,technique_titles,style_titles,subject_titles,"
    "classification_titles,medium_display,dimensions,inscriptions,color"
)


async def find_artic_artwork(title: str, artist: str) -> dict | None:
    """Search ARTIC by title + artist. Return best-matching item or None."""
    params = {"q": f"{title} {artist}".strip(), "fields": _FIELDS, "limit": 5}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(_SEARCH_URL, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception:
        return None

    results = data.get("data") or []
    if not results:
        return None

    def _similarity(item: dict) -> float:
        t = item.get("title") or ""
        return difflib.SequenceMatcher(None, title.lower(), t.lower()).ratio()

    best = max(results, key=_similarity)
    return best if _similarity(best) >= 0.5 else None


def extract_dossier_fields(artic_item: dict) -> dict:
    """Normalise ARTIC fields into the artwork_dossier column format."""

    def _json_list(val) -> str | None:
        if isinstance(val, list) and any(v for v in val if v):
            return json.dumps([v for v in val if v])
        return None

    color = artic_item.get("color")
    palette = None
    if color and isinstance(color, dict):
        palette = json.dumps([{
            "hue": color.get("h"),
            "saturation": color.get("s"),
            "lightness": color.get("l"),
            "percentage": color.get("percentage"),
            "population": color.get("population"),
        }])

    return {
        "artic_id": str(artic_item.get("id", "")),
        "medium_display": artic_item.get("medium_display") or None,
        "technique_titles": _json_list(artic_item.get("technique_titles")),
        "style_titles": _json_list(artic_item.get("style_titles")),
        "subject_titles": _json_list(artic_item.get("subject_titles")),
        "classification_titles": _json_list(artic_item.get("classification_titles")),
        "physical_dimensions": artic_item.get("dimensions") or None,
        "inscriptions": artic_item.get("inscriptions") or None,
        "color_palette": palette,
    }
