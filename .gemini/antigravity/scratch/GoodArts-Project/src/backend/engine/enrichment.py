"""GoodArts — Artwork Enrichment Engine. Fetches and caches Wikipedia context."""
import json
import aiosqlite
from src.backend.database import crud
from src.backend.clients.wikipedia import get_page_summary, get_page_sections, get_section_text
from src.backend.data.fun_facts_seed import get_fun_facts

SECTION_MAP = {
    "formal_analysis": ["composition", "formal analysis", "style", "visual analysis"],
    "technique_notes": ["technique", "medium", "materials", "process", "creation"],
    "iconography": ["iconography", "symbolism", "meaning", "allegory", "interpretation"],
    "movement_context": ["movement", "art movement", "school", "influence"],
    "historical_period": ["historical context", "history", "background", "context"],
    "impact_on_art": ["impact", "influence", "legacy", "significance"],
    "contemporary_rel": ["reception", "contemporary", "criticism", "modern"],
    "provenance": ["provenance", "ownership", "collection", "exhibition history"],
    "artist_context": ["artist", "biography", "life", "career"],
}


def _match_section(heading: str):
    heading_lower = heading.lower().strip()
    for field, keywords in SECTION_MAP.items():
        for kw in keywords:
            if kw in heading_lower:
                return field
    return None


async def enrich_artwork(db: aiosqlite.Connection, artwork_id: int) -> dict:
    cached = await crud.get_enrichment(db, artwork_id)
    if cached:
        return cached
    artwork = await crud.get_artwork(db, artwork_id)
    if not artwork:
        return {}
    enrichment = {}
    wikidata_id = artwork.get("wikidata_id")
    facts = get_fun_facts(wikidata_id) if wikidata_id else []
    title = artwork.get("title", "")
    artist = artwork.get("artist", "")
    wiki_title = f"{title} ({artist})" if artist else title
    summary = await get_page_summary(wiki_title)
    if not summary:
        summary = await get_page_summary(title)
    if summary and summary.get("extract"):
        enrichment["artist_context"] = summary["extract"]
    sections = await get_page_sections(wiki_title)
    if not sections:
        sections = await get_page_sections(title)
    for section in sections:
        field = _match_section(section["heading"])
        if field and field not in enrichment:
            text = await get_section_text(wiki_title or title, section["index"])
            if text and len(text) > 50:
                enrichment[field] = text[:2000]
    if not facts and summary:
        extract = summary.get("extract", "")
        if extract and len(extract) > 100:
            facts = [extract[:300]]
    enrichment["fun_facts"] = json.dumps(facts)
    if enrichment:
        await crud.upsert_enrichment(db, artwork_id, enrichment)
    return enrichment
