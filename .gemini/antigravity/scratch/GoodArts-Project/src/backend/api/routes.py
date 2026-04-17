"""
GoodArts — API Routes
All REST endpoints for the application.
"""
import asyncio
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
import aiosqlite

from src.backend.database.connection import get_db
from src.backend.database import crud
from src.backend.clients.wikidata import search_wikidata, fetch_artwork_by_id, explore_wikidata
from src.backend.clients.europeana import search_europeana
from src.backend.engine.taste_profile import (
    recompute_taste_profile, get_taste_profile_dict,
    record_taste_signal, get_taste_profile_full,
)
from src.backend.engine.recommender import (
    compose_feed_batch, select_daily_masterpiece, generate_recommendations,
)
from src.backend.engine.probes import evaluate_probe, compute_drift_score
from src.backend.engine.enrichment import enrich_artwork
from src.backend.data.onboarding_seed import get_onboarding_pool
from src.backend.data.fun_facts_seed import get_fun_facts
from src.backend.api.schemas import (
    ArtworkCreate, ArtworkOut, AddToListRequest, UserArtworkOut,
    OnboardingRateRequest, OnboardingArtwork,
    StatsOut, SearchResult,
    FeedItem, TasteSignal, EnrichmentOut,
    ExhibitionCreate, ExhibitionOut, ExhibitionStatusUpdate,
    VisitCreate, VisitOut,
    AnnotationCreate, AnnotationOut,
    SettingsOut, SettingsUpdate,
)

router = APIRouter()


# ─── Health ──────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok"}


# ─── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsOut)
async def get_stats(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_stats(db)


# ─── Search ──────────────────────────────────────────────────────────────────

@router.get("/search", response_model=SearchResult)
async def search(
    q: str = Query(..., min_length=1),
    db: aiosqlite.Connection = Depends(get_db),
):
    local = await crud.search_artworks_local(db, q)

    # Parallel fetch from Wikidata + Europeana
    wikidata_results, europeana_results = await asyncio.gather(
        search_wikidata(q),
        search_europeana(q),
    )

    # Deduplicate remote results by wikidata_id
    local_wikidata_ids = {a.get("wikidata_id") for a in local if a.get("wikidata_id")}
    remote = []
    seen_ids = set()
    for item in wikidata_results + europeana_results:
        wid = item.get("wikidata_id") or item.get("europeana_id")
        if wid and wid not in local_wikidata_ids and wid not in seen_ids:
            seen_ids.add(wid)
            remote.append(item)

    return {"local": local, "remote": remote}


# ─── Explore ─────────────────────────────────────────────────────────────────

@router.get("/explore")
async def explore():
    """Fetch random notable artworks categorized by movements."""
    import random
    movements = ["Impressionism", "Renaissance", "Surrealism", "Baroque", "Romanticism", "Post-Impressionism"]
    chosen = random.sample(movements, 2)
    results = await asyncio.gather(*[explore_wikidata(m) for m in chosen])
    return {
        "categories": [
            {"name": f"Explore {chosen[0]}", "artworks": results[0]},
            {"name": f"Explore {chosen[1]}", "artworks": results[1]},
        ]
    }


# ─── Artworks — Manual Add ───────────────────────────────────────────────────

@router.post("/artworks", response_model=ArtworkOut)
async def create_artwork(
    payload: ArtworkCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)
    artwork_id = await crud.upsert_artwork(db, data)
    artwork = await crud.get_artwork(db, artwork_id)
    return artwork


@router.get("/artworks/{artwork_id}", response_model=ArtworkOut)
async def get_artwork(artwork_id: int, db: aiosqlite.Connection = Depends(get_db)):
    artwork = await crud.get_artwork(db, artwork_id)
    if not artwork:
        raise HTTPException(status_code=404, detail="Artwork not found")
    return artwork


# ─── Import from Wikidata ─────────────────────────────────────────────────────

@router.post("/artworks/import/{wikidata_id}", response_model=ArtworkOut)
async def import_from_wikidata(
    wikidata_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    existing = await crud.get_artwork_by_wikidata_id(db, wikidata_id)
    if existing:
        return existing
    artwork_data = await fetch_artwork_by_id(wikidata_id)
    if not artwork_data:
        raise HTTPException(status_code=404, detail="Artwork not found on Wikidata")
    artwork_id = await crud.upsert_artwork(db, artwork_data)
    return await crud.get_artwork(db, artwork_id)


# ─── Enriched Artwork Details ────────────────────────────────────────────────

@router.get("/artworks/{artwork_id}/enriched")
async def get_enriched(artwork_id: int, db: aiosqlite.Connection = Depends(get_db)):
    enrichment = await enrich_artwork(db, artwork_id)
    if not enrichment:
        raise HTTPException(status_code=404, detail="Could not enrich artwork")
    enrichment["artwork_id"] = artwork_id
    return enrichment


# ─── Annotations ─────────────────────────────────────────────────────────────

@router.get("/artworks/{artwork_id}/annotations", response_model=list[AnnotationOut])
async def get_annotations(artwork_id: int, db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_annotations(db, artwork_id)


@router.post("/artworks/{artwork_id}/annotations", response_model=AnnotationOut)
async def add_annotation(
    artwork_id: int,
    payload: AnnotationCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    ann_id = await crud.create_annotation(db, artwork_id, payload.note_text, payload.photo_id)
    anns = await crud.get_annotations(db, artwork_id)
    return next(a for a in anns if a["id"] == ann_id)


# ─── User Lists (Seen / Bucket) ───────────────────────────────────────────────

@router.get("/checklist", response_model=list[UserArtworkOut])
async def get_checklist(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_user_artworks(db, "seen")


@router.get("/bucketlist", response_model=list[UserArtworkOut])
async def get_bucketlist(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_user_artworks(db, "bucket")


@router.post("/list/add")
async def add_to_list(
    payload: AddToListRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    result = await crud.add_to_list(
        db,
        artwork_id=payload.artwork_id,
        list_type=payload.list_type,
        rating=payload.rating,
        notes=payload.notes,
        date_seen=payload.date_seen,
        museum_visited=payload.museum_visited,
        priority=payload.priority,
    )
    asyncio.create_task(recompute_taste_profile(db))
    return result


@router.delete("/list/remove/{artwork_id}/{list_type}")
async def remove_from_list(
    artwork_id: int,
    list_type: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    await crud.remove_from_list(db, artwork_id, list_type)
    return {"removed": True}


# ─── Onboarding ──────────────────────────────────────────────────────────────

@router.get("/onboarding/deck", response_model=list[OnboardingArtwork])
async def get_onboarding_deck(db: aiosqlite.Connection = Depends(get_db)):
    pool = get_onboarding_pool()
    results = []
    for item in pool:
        wid = item["wikidata_id"]
        existing = await crud.get_artwork_by_wikidata_id(db, wid)
        if existing and existing.get("image_url"):
            results.append({
                "wikidata_id": wid,
                "title": existing["title"],
                "artist": existing.get("artist"),
                "movement": existing.get("movement"),
                "year": existing.get("year"),
                "image_url": existing.get("image_url"),
                "image_url_hd": existing.get("image_url_hd"),
            })
        else:
            results.append({
                "wikidata_id": wid,
                "title": item["title"],
                "artist": item.get("artist"),
                "movement": item.get("movement"),
                "year": item.get("year"),
                "image_url": item.get("image_url"),
                "image_url_hd": item.get("image_url_hd"),
            })
    return results


@router.post("/onboarding/rate")
async def rate_onboarding_artwork(
    payload: OnboardingRateRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    existing = await crud.get_artwork_by_wikidata_id(db, payload.wikidata_id)
    if not existing:
        artwork_data = await fetch_artwork_by_id(payload.wikidata_id)
        if not artwork_data:
            raise HTTPException(status_code=404, detail="Artwork not found on Wikidata")
        artwork_id = await crud.upsert_artwork(db, artwork_data)
    else:
        artwork_id = existing["id"]

    await crud.add_to_list(db, artwork_id=artwork_id, list_type="seen", rating=payload.rating)
    await recompute_taste_profile(db)
    return {"rated": True, "artwork_id": artwork_id}


@router.post("/onboarding/complete")
async def complete_onboarding(db: aiosqlite.Connection = Depends(get_db)):
    profile = await recompute_taste_profile(db)
    return {"profile_dimensions": len(profile)}


# ─── Recommendations (legacy) ────────────────────────────────────────────────

@router.get("/recommend")
async def get_recommendations(db: aiosqlite.Connection = Depends(get_db)):
    return await generate_recommendations(db)


# ─── Daily Masterpiece ──────────────────────────────────────────────────────

@router.get("/daily-masterpiece")
async def daily_masterpiece(db: aiosqlite.Connection = Depends(get_db)):
    artwork = await select_daily_masterpiece(db)
    if not artwork:
        raise HTTPException(status_code=404, detail="No artworks available")
    facts = get_fun_facts(artwork.get("wikidata_id", ""))
    return {"artwork": artwork, "fun_facts": facts}


# ─── Swipe Feed ─────────────────────────────────────────────────────────────

@router.get("/feed")
async def get_feed(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: aiosqlite.Connection = Depends(get_db),
):
    return await compose_feed_batch(db, offset=offset, limit=limit)


# ─── Taste Profile ────────────────────────────────────────────────────────────

@router.get("/taste-profile")
async def get_taste_profile(db: aiosqlite.Connection = Depends(get_db)):
    return await get_taste_profile_dict(db)


@router.post("/taste-profile/recompute")
async def recompute_profile(db: aiosqlite.Connection = Depends(get_db)):
    profile = await recompute_taste_profile(db)
    return {"recomputed": True, "dimensions": len(profile)}


@router.post("/taste-profile/signal")
async def post_taste_signal(
    payload: TasteSignal,
    db: aiosqlite.Connection = Depends(get_db),
):
    await record_taste_signal(db, payload.artwork_id, payload.weight)

    if payload.probe_type and payload.expected_signal:
        await evaluate_probe(
            db, payload.artwork_id, payload.probe_type,
            payload.expected_signal, payload.weight,
        )

    return {"recorded": True}


@router.get("/taste-profile/drift")
async def get_drift(db: aiosqlite.Connection = Depends(get_db)):
    probes = await crud.get_recent_probes(db, days=30)
    drift = compute_drift_score([dict(p) for p in probes])
    return {"drift_score": drift, "probe_count": len(probes)}


# ─── Collection ──────────────────────────────────────────────────────────────

@router.get("/collection/wishlist")
async def get_wishlist(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_user_artworks(db, "bucket")


@router.get("/collection/journal")
async def get_journal(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_user_artworks(db, "seen")


@router.get("/collection/visits", response_model=list[VisitOut])
async def get_collection_visits(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_visits(db)


# ─── Visits ──────────────────────────────────────────────────────────────────

@router.post("/visits", response_model=VisitOut)
async def create_visit(
    payload: VisitCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)
    visit_id = await crud.create_visit(db, data)
    return await crud.get_visit(db, visit_id)


@router.get("/visits", response_model=list[VisitOut])
async def list_visits(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_visits(db)


@router.get("/visits/{visit_id}", response_model=VisitOut)
async def get_visit(visit_id: int, db: aiosqlite.Connection = Depends(get_db)):
    visit = await crud.get_visit(db, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@router.patch("/visits/{visit_id}")
async def update_visit(
    visit_id: int,
    payload: VisitCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)
    await crud.update_visit(db, visit_id, data)
    return await crud.get_visit(db, visit_id)


# ─── Exhibitions ─────────────────────────────────────────────────────────────

@router.get("/exhibitions", response_model=list[ExhibitionOut])
async def get_exhibitions(
    city: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    return await crud.get_exhibitions(db, city=city)


@router.post("/exhibitions", response_model=ExhibitionOut)
async def create_exhibition(
    payload: ExhibitionCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)
    eid = await crud.create_exhibition(db, data)
    exhs = await crud.get_exhibitions(db)
    return next(e for e in exhs if e["id"] == eid)


@router.patch("/exhibitions/{exhibition_id}/status")
async def update_exhibition_status(
    exhibition_id: int,
    payload: ExhibitionStatusUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    await crud.set_exhibition_status(db, exhibition_id, payload.status)
    return {"updated": True}


# ─── Settings ────────────────────────────────────────────────────────────────

@router.get("/settings", response_model=SettingsOut)
async def get_settings(db: aiosqlite.Connection = Depends(get_db)):
    return await crud.get_settings(db)


@router.patch("/settings", response_model=SettingsOut)
async def update_settings(
    payload: SettingsUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)
    if data:
        await crud.update_settings(db, data)
    return await crud.get_settings(db)


# ─── Image Proxy ─────────────────────────────────────────────────────────────

@router.get("/image-proxy")
async def image_proxy(url: str = Query(...)):
    from src.backend.clients.image_proxy import fetch_and_cache
    from fastapi.responses import FileResponse
    result = await fetch_and_cache(url)
    if result.get("path"):
        return FileResponse(
            result["path"],
            headers={"Cache-Control": "public, max-age=31536000"},
        )
    raise HTTPException(status_code=502, detail="Failed to fetch image")


# ─── Photo Upload ────────────────────────────────────────────────────────────

@router.post("/photos/upload")
async def upload_photo(
    file: UploadFile = File(...),
    artwork_id: Optional[int] = Form(None),
    visit_id: Optional[int] = Form(None),
    caption: Optional[str] = Form(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    from src.backend.config import settings as cfg
    from src.backend.clients.image_proxy import generate_thumbnail

    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = Path(str(cfg.UPLOAD_DIR)) / filename
    file_path.parent.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    file_path.write_bytes(content)

    thumb_key = filename.rsplit(".", 1)[0]
    thumb_path = generate_thumbnail(str(file_path), thumb_key)

    photo_id = await crud.create_photo(db, {
        "visit_id": visit_id,
        "artwork_id": artwork_id,
        "file_path": f"/uploads/{filename}",
        "thumbnail_path": f"/uploads/thumbs/{thumb_key}_thumb.jpg" if thumb_path != str(file_path) else f"/uploads/{filename}",
        "caption": caption,
    })

    return {
        "id": photo_id,
        "path": f"/uploads/{filename}",
        "thumbnail": f"/uploads/thumbs/{thumb_key}_thumb.jpg",
    }


@router.post("/exhibitions/sync")
async def sync_exhibitions_route(db: aiosqlite.Connection = Depends(get_db)):
    from src.backend.jobs.exhibition_sync import sync_exhibitions
    await sync_exhibitions(db)
    return {"synced": True}
