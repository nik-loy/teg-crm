"""
GoodArts — API Routes
All REST endpoints for the application.
"""
import asyncio
import uuid
from pathlib import Path
from typing import Optional, Any

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
    ExhibitionCreate, ExhibitionOut, ExhibitionDetailOut, ExhibitionStatusUpdate,
    VisitCreate, VisitOut,
    AnnotationCreate, AnnotationOut,
    PersonalLogCreate, PersonalLogOut,
    SettingsOut, SettingsUpdate, DossierOut,
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

import difflib

POPULAR_SEARCH_TERMS = [
    "Vincent van Gogh", "Leonardo da Vinci", "Pablo Picasso", "Claude Monet",
    "Rembrandt van Rijn", "Michelangelo", "Johannes Vermeer", "Edvard Munch",
    "Salvador Dali", "Gustav Klimt", "Frida Kahlo", "Georgia O'Keeffe",
    "Diego Rivera", "Jackson Pollock", "Andy Warhol", "Henri Matisse",
    "Paul Cezanne", "Edgar Degas", "Titian", "Raphael", "Caravaggio",
    "Peter Paul Rubens", "Francisco Goya", "Edouard Manet", "Pierre-Auguste Renoir",
    "Paul Gauguin", "Georges Seurat", "Henri de Toulouse-Lautrec", "Marc Chagall",
    "Wassily Kandinsky", "Piet Mondrian", "Rene Magritte", "Joan Miro",
    "Mark Rothko", "Edward Hopper", "Giotto", "Sandro Botticelli",
    "Hieronymus Bosch", "Pieter Bruegel the Elder", "El Greco", "Diego Velazquez",
    "J.M.W. Turner", "John Constable", "Caspar David Friedrich", "Eugene Delacroix",
    "Gustave Courbet", "Camille Pissarro", "Alfred Sisley", "Mary Cassatt",
    "Berthe Morisot", "Auguste Rodin", "Paul Klee", "Amedeo Modigliani",
    "Egon Schiele", "Marcel Duchamp", "Kazimir Malevich", "Max Ernst",
    "Impressionism", "Renaissance", "Baroque", "Cubism", "Surrealism", "Modernism"
]

@router.get("/search", response_model=SearchResult)
async def search(
    q: str = Query(..., min_length=1),
    db: aiosqlite.Connection = Depends(get_db),
):
    local = await crud.search_artworks_local(db, q)

    # Parallel fetch from Wikidata + Europeana — each provider fails independently
    async def _safe_wikidata(query: str) -> list:
        try:
            return await search_wikidata(query)
        except Exception as exc:
            print(f"[search] Wikidata failed for '{query}': {exc}")
            return []

    async def _safe_europeana(query: str) -> list:
        try:
            return await search_europeana(query)
        except Exception as exc:
            print(f"[search] Europeana failed for '{query}': {exc}")
            return []

    wikidata_results, europeana_results = await asyncio.gather(
        _safe_wikidata(q),
        _safe_europeana(q),
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

    suggestion = None
    if len(local) + len(remote) < 5:
        q_lower = q.lower()
        terms_lower = {t.lower(): t for t in POPULAR_SEARCH_TERMS}
        matches = difflib.get_close_matches(q_lower, terms_lower.keys(), n=1, cutoff=0.7)
        if matches:
            matched_term = terms_lower[matches[0]]
            if matched_term.lower() != q_lower:
                suggestion = matched_term

    return {"local": local, "remote": remote, "suggestion": suggestion}


# ─── Explore ─────────────────────────────────────────────────────────────────

@router.get("/explore")
async def explore():
    """Fetch random notable artworks categorized by movements."""
    import random
    movements = [
        "Impressionism", "Post-Impressionism", "Renaissance", "Baroque",
        "Romanticism", "Surrealism", "Cubism", "Expressionism",
        "Realism", "Abstract Expressionism", "Minimalism", "Symbolism",
        "Art Nouveau", "Neoclassicism", "Fauvism", "Mannerism",
    ]
    chosen = random.sample(movements, 4)
    results = await asyncio.gather(*[explore_wikidata(m) for m in chosen])
    return {
        "categories": [
            {"name": chosen[i], "artworks": results[i]}
            for i in range(len(chosen))
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


# ─── Technical Dossier ───────────────────────────────────────────────────────

@router.get("/artworks/{artwork_id}/dossier", response_model=DossierOut)
async def get_dossier(artwork_id: int, db: aiosqlite.Connection = Depends(get_db)):
    row = await crud.get_dossier(db, artwork_id)

    if row is None:
        # Artwork exists but was never queued — enqueue now
        artwork = await crud.get_artwork(db, artwork_id)
        if not artwork:
            raise HTTPException(status_code=404, detail="Artwork not found")
        await crud.enqueue_dossier(db, artwork_id, priority=10)
        return DossierOut(status="enriching", artwork_id=artwork_id)

    status = row.get("status", "pending")
    if status in ("pending", "processing"):
        return DossierOut(status="enriching", artwork_id=artwork_id)
    if status in ("failed", "unavailable"):
        return DossierOut(status="unavailable", artwork_id=artwork_id)

    # status == "complete" — build structured response
    def _json(val) -> Any:
        if val is None:
            return None
        try:
            import json
            return json.loads(val)
        except Exception:
            return val

    return DossierOut(
        status="complete",
        artwork_id=artwork_id,
        data_sources=_json(row.get("data_sources")),
        materials={
            "medium_display": row.get("medium_display"),
            "technique_titles": _json(row.get("technique_titles")),
            "technique_definitions": _json(row.get("technique_definitions")),
        } if any([row.get("medium_display"), row.get("technique_titles")]) else None,
        physical={
            "dimensions": row.get("physical_dimensions"),
            "inscriptions": row.get("inscriptions"),
        } if any([row.get("physical_dimensions"), row.get("inscriptions")]) else None,
        color_palette=_json(row.get("color_palette")),
        classification={
            "style_titles": _json(row.get("style_titles")),
            "subject_titles": _json(row.get("subject_titles")),
            "classification_titles": _json(row.get("classification_titles")),
        } if any([row.get("style_titles"), row.get("subject_titles"), row.get("classification_titles")]) else None,
        movement={
            "hierarchy": _json(row.get("movement_hierarchy")),
            "characteristics": row.get("movement_characteristics"),
        } if any([row.get("movement_hierarchy"), row.get("movement_characteristics")]) else None,
        lineage={
            "influenced_by": _json(row.get("artist_influences")),
            "influenced": _json(row.get("artist_influenced")),
        } if any([row.get("artist_influences"), row.get("artist_influenced")]) else None,
        artist={
            "bio": row.get("artist_bio"),
            "nationality": row.get("artist_nationality"),
            "birth_year": row.get("artist_birth_year"),
            "death_year": row.get("artist_death_year"),
        } if any([row.get("artist_bio"), row.get("artist_nationality")]) else None,
    )


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
    try:
        exhs = await crud.get_exhibitions(db, city=city)
        
        # Auto-sync if no results found locally for a city
        if not exhs and city:
            from src.backend.jobs.exhibition_sync import sync_exhibitions
            new_count = await sync_exhibitions(db, city=city)
            if new_count > 0:
                exhs = await crud.get_exhibitions(db, city=city)
        
        profile = await get_taste_profile_dict(db)
        
        import json
        for exh in exhs:
            try:
                tags = []
                try:
                    atags = exh.get("artist_tags")
                    mtags = exh.get("movement_tags")
                    tags = json.loads(atags or "[]") + json.loads(mtags or "[]")
                except Exception:
                    pass
                
                score = 0.0
                for tag in tags:
                    for dim in ["artist", "movement"]:
                        if dim in profile and tag in profile[dim]:
                            score = max(score, profile[dim][tag])
                exh["taste_affinity"] = score
            except Exception:
                exh["taste_affinity"] = 0.0
        
        return exhs
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exhibitions", response_model=ExhibitionOut)
async def create_exhibition(
    payload: ExhibitionCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)
    eid = await crud.create_exhibition(db, data)
    exhs = await crud.get_exhibitions(db)
    return next(e for e in exhs if e["id"] == eid)


@router.get("/exhibitions/{exhibition_id}", response_model=ExhibitionDetailOut)
async def get_exhibition_detail(
    exhibition_id: int,
    db: aiosqlite.Connection = Depends(get_db),
):
    exh = await crud.get_exhibition(db, exhibition_id)
    if not exh:
        raise HTTPException(status_code=404, detail="Exhibition not found")

    # Get personalized recommendations
    from src.backend.engine.recommender import recommend_for_exhibition
    recs = await recommend_for_exhibition(db, exh)

    # Get "all" artworks (Research Tool)
    import json
    try:
        exh_artists = json.loads(exh.get("artist_tags") or "[]")
    except Exception:
        exh_artists = []

    all_artworks = []
    
    # Try Artsy first if it's an Artsy show
    if exh.get("source") == "artsy" and exh.get("source_id"):
        from src.backend.clients.artsy import fetch_show_artworks
        artsy_works = await fetch_show_artworks(exh["source_id"])
        for aw in artsy_works:
            all_artworks.append({
                "id": 0,
                "title": aw["title"],
                "artist": aw.get("artist"),
                "image_url": aw.get("image_url"),
                "year": aw.get("year"),
                "source": "artsy",
                "wikidata_id": None
            })

    # Supplement with local artworks matching artists
    all_local = await crud.get_all_artworks(db)
    local_matches = [a for a in all_local if a.get("artist") in exh_artists]
    for lm in local_matches:
        if not any(a.get("title") == lm.get("title") for a in all_artworks):
            all_artworks.append(lm)

    # Fallback to Wikidata if still empty
    if not all_artworks and exh_artists:
        from src.backend.clients.wikidata import search_wikidata
        try:
            remote_results = await search_wikidata(exh_artists[0])
            for r in remote_results[:10]:
                all_artworks.append({
                    "id": 0,
                    "title": r["title"],
                    "artist": r.get("artist"),
                    "image_url": r.get("image_url"),
                    "year": r.get("year"),
                    "source": "wikidata",
                    "wikidata_id": r.get("wikidata_id")
                })
        except Exception:
            pass

    return {
        **exh,
        "recommended_artworks": recs["recommended_artworks"],
        "recommended_artists": recs["recommended_artists"],
        "all_artworks": all_artworks,
    }


@router.patch("/exhibitions/{exhibition_id}/status")
async def update_exhibition_status(
    exhibition_id: int,
    payload: ExhibitionStatusUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    await crud.set_exhibition_status(db, exhibition_id, payload.status, payload.notes)
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
# ─── Personal Logs ───────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[PersonalLogOut])
async def get_logs(
    artwork_id: Optional[int] = None,
    visit_id: Optional[int] = None,
    db: aiosqlite.Connection = Depends(get_db)
):
    return await crud.get_personal_logs(db, artwork_id=artwork_id, visit_id=visit_id)


@router.post("/logs", response_model=PersonalLogOut)
async def create_log(
    payload: PersonalLogCreate,
    db: aiosqlite.Connection = Depends(get_db)
):
    data = payload.model_dump(exclude_none=True)
    log_id = await crud.create_personal_log(db, data)
    logs = await crud.get_personal_logs(db, artwork_id=payload.artwork_id, visit_id=payload.visit_id)
    return next(l for l in logs if l["id"] == log_id)


@router.delete("/logs/{log_id}")
async def delete_log(log_id: int, db: aiosqlite.Connection = Depends(get_db)):
    await crud.delete_personal_log(db, log_id)
    return {"deleted": True}
