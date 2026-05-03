"""
GoodArts — Dossier Enrichment Worker
Background asyncio task that pre-enriches artworks with technical art data
from ARTIC, Getty AAT, Getty ULAN, and Wikidata SPARQL.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

import aiosqlite

from src.backend.database import crud
from src.backend.clients.artic_dossier import find_artic_artwork, extract_dossier_fields
from src.backend.clients.getty_aat import enrich_techniques
from src.backend.clients.getty_ulan import fetch_artist_dossier
from src.backend.clients.wikidata import get_movement_hierarchy, get_artist_influences

logger = logging.getLogger(__name__)

_SEMAPHORE = asyncio.Semaphore(3)   # max 3 artworks enriched concurrently
_POLL_INTERVAL = 10                 # seconds between queue polls


async def enrich_single_artwork(db: aiosqlite.Connection, artwork_id: int) -> None:
    """Run all API sources for one artwork and write result to artwork_dossier."""
    artwork = await crud.get_artwork(db, artwork_id)
    if not artwork:
        return

    title = artwork.get("title", "")
    artist = artwork.get("artist", "")
    wikidata_id = artwork.get("wikidata_id")

    await crud.mark_queue_processing(db, artwork_id)

    async def _empty_list():
        return []

    async def _empty_influences():
        return {"influenced_by": [], "influenced": []}

    async def _empty_none():
        return None

    # Fire all sources in parallel
    artic_task = asyncio.create_task(find_artic_artwork(title, artist))
    movement_task = asyncio.create_task(
        get_movement_hierarchy(artwork.get("movement")) if artwork.get("movement") else _empty_none()
    )
    influence_task = asyncio.create_task(
        get_artist_influences(artist) if artist else _empty_none()
    )
    ulan_task = asyncio.create_task(fetch_artist_dossier(artist) if artist else _empty_none())

    artic_item, movement_info, influences, ulan = await asyncio.gather(
        artic_task, movement_task, influence_task, ulan_task,
        return_exceptions=True,
    )

    # Treat exceptions as None/empty
    if isinstance(artic_item, Exception):
        logger.error(f"ARTIC task failed for {artwork_id}: {artic_item}")
        artic_item = None
    if isinstance(movement_info, Exception):
        logger.error(f"Movement task failed for {artwork_id}: {movement_info}")
        movement_info = None
    if isinstance(influences, Exception):
        logger.error(f"Influence task failed for {artwork_id}: {influences}")
        influences = None
    if isinstance(ulan, Exception):
        logger.error(f"ULAN task failed for {artwork_id}: {ulan}")
        ulan = None

    dossier: dict = {}
    sources: list[str] = []

    # ARTIC fields
    if artic_item:
        artic_fields = extract_dossier_fields(artic_item)
        dossier.update({k: v for k, v in artic_fields.items() if v is not None})
        if artic_fields.get("technique_titles"):
            technique_defs = await enrich_techniques(artic_fields["technique_titles"])
            if technique_defs:
                dossier["technique_definitions"] = technique_defs
        sources.append("artic")

    # Wikidata movement + influences
    if movement_info:
        dossier["movement_hierarchy"] = movement_info # It's already JSON from the client
        sources.append("wikidata")
    
    if influences:
        dossier["artist_influences"] = json.dumps(influences.get("influenced_by", []))
        dossier["artist_influenced"] = json.dumps(influences.get("influenced", []))
        if "wikidata" not in sources:
            sources.append("wikidata")

    # Getty ULAN artist data
    if ulan:
        dossier["artist_bio"] = ulan.get("bio")
        dossier["artist_nationality"] = ulan.get("nationality")
        dossier["artist_birth_year"] = ulan.get("birth_year")
        dossier["artist_death_year"] = ulan.get("death_year")
        sources.append("getty")

    if not dossier:
        await crud.upsert_dossier(db, artwork_id, {"status": "unavailable"})
        await crud.mark_queue_failed(db, artwork_id, "no data from any source")
        return

    dossier["data_sources"] = json.dumps(sources)
    dossier["status"] = "complete"
    dossier["completed_at"] = datetime.now(timezone.utc).isoformat()

    await crud.upsert_dossier(db, artwork_id, dossier)
    await crud.mark_queue_complete(db, artwork_id)
    logger.info("Dossier enriched: artwork_id=%s sources=%s", artwork_id, sources)


async def _process_batch(db: aiosqlite.Connection) -> int:
    items = await crud.get_pending_queue_items(db, limit=5)
    if not items:
        return 0

    async def _guarded(artwork_id: int) -> None:
        async with _SEMAPHORE:
            try:
                await enrich_single_artwork(db, artwork_id)
            except Exception as exc:
                logger.error("Dossier worker error artwork_id=%s: %s", artwork_id, exc)
                await crud.mark_queue_failed(db, artwork_id, str(exc))

    await asyncio.gather(*[_guarded(item["artwork_id"]) for item in items])
    return len(items)


async def dossier_worker_loop(db: aiosqlite.Connection) -> None:
    """Continuously process the dossier queue. Runs forever as a background task."""
    logger.info("Dossier worker started")
    while True:
        try:
            processed = await _process_batch(db)
            if processed == 0:
                await asyncio.sleep(_POLL_INTERVAL)
        except Exception as exc:
            logger.error("Dossier worker loop error: %s", exc)
            await asyncio.sleep(_POLL_INTERVAL)
