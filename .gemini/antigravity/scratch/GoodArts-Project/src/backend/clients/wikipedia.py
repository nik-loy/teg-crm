"""GoodArts — Wikipedia REST + MediaWiki API Client. No API key required."""
import httpx
from src.backend.config import settings

HEADERS = {"User-Agent": "GoodArts/0.1 (personal art tracker)"}


async def get_page_summary(title: str):
    url = f"{settings.WIKIPEDIA_API_URL}/page/summary/{title.replace(' ', '_')}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=HEADERS)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
        return {
            "extract": data.get("extract", ""),
            "description": data.get("description", ""),
            "thumbnail": data.get("thumbnail", {}).get("source"),
        }
    except Exception:
        return None


async def get_page_sections(title: str) -> list:
    params = {
        "action": "parse", "page": title.replace(" ", "_"),
        "prop": "sections", "format": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(settings.MEDIAWIKI_API_URL, params=params, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()
        sections = data.get("parse", {}).get("sections", [])
        return [{"index": s["index"], "heading": s["line"], "level": int(s["level"])} for s in sections]
    except Exception:
        return []


async def get_section_text(title: str, section_index: int) -> str:
    params = {
        "action": "parse", "page": title.replace(" ", "_"),
        "section": section_index, "prop": "wikitext", "format": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(settings.MEDIAWIKI_API_URL, params=params, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()
        wikitext = data.get("parse", {}).get("wikitext", {}).get("*", "")
        import re
        text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", wikitext)
        text = re.sub(r"\{\{[^}]*\}\}", "", text)
        text = re.sub(r"'{2,}", "", text)
        text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.DOTALL)
        text = re.sub(r"<[^>]+>", "", text)
        return text.strip()
    except Exception:
        return ""
