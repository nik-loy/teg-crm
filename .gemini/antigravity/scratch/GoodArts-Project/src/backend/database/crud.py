"""
ArtLog CRUD — All database read/write operations.
All functions accept an aiosqlite.Connection as first argument.
"""
import json
from datetime import datetime, timedelta
from typing import Optional
import aiosqlite

from src.backend.config import settings


# ─────────────────────────────────────────────────────────────────────────────
# ARTWORKS
# ─────────────────────────────────────────────────────────────────────────────

async def get_artwork(db: aiosqlite.Connection, artwork_id: int) -> Optional[dict]:
    async with db.execute("SELECT * FROM artworks WHERE id = ?", (artwork_id,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def get_artwork_by_wikidata_id(db: aiosqlite.Connection, wikidata_id: str) -> Optional[dict]:
    async with db.execute("SELECT * FROM artworks WHERE wikidata_id = ?", (wikidata_id,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def upsert_artwork(db: aiosqlite.Connection, data: dict) -> int:
    """Insert or update an artwork. Returns its ID."""
    cols = list(data.keys())
    vals = list(data.values())
    placeholders = ", ".join("?" * len(cols))
    col_names = ", ".join(cols)
    updates = ", ".join(f"{c}=excluded.{c}" for c in cols if c != "id")
    sql = f"""
        INSERT INTO artworks ({col_names}) VALUES ({placeholders})
        ON CONFLICT(wikidata_id) DO UPDATE SET {updates}, updated_at=CURRENT_TIMESTAMP
    """
    async with db.execute(sql, vals) as cur:
        await db.commit()
        artwork_id = cur.lastrowid or (await get_artwork_by_wikidata_id(db, data.get("wikidata_id")))["id"]
    await enqueue_dossier(db, artwork_id, priority=1)
    return artwork_id


async def search_artworks_local(db: aiosqlite.Connection, query: str, limit: int = 30) -> list[dict]:
    q = f"%{query}%"
    sql = """
        SELECT * FROM artworks
        WHERE title LIKE ? OR artist LIKE ? OR movement LIKE ?
        ORDER BY title LIMIT ?
    """
    async with db.execute(sql, (q, q, q, limit)) as cur:
        return [dict(r) for r in await cur.fetchall()]


async def get_all_artworks(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute("SELECT * FROM artworks ORDER BY title") as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─────────────────────────────────────────────────────────────────────────────
# USER ARTWORKS (Seen / Bucket)
# ─────────────────────────────────────────────────────────────────────────────

async def get_user_artworks(db: aiosqlite.Connection, list_type: str) -> list[dict]:
    sql = """
        SELECT ua.*, a.title, a.artist, a.year, a.movement, a.medium,
               a.museum, a.museum_city, a.image_url, a.image_url_hd, a.era
        FROM user_artworks ua
        JOIN artworks a ON ua.artwork_id = a.id
        WHERE ua.list_type = ?
        ORDER BY ua.added_at DESC
    """
    async with db.execute(sql, (list_type,)) as cur:
        return [dict(r) for r in await cur.fetchall()]


async def add_to_list(db: aiosqlite.Connection, artwork_id: int, list_type: str,
                      rating: Optional[int] = None, notes: Optional[str] = None,
                      date_seen: Optional[str] = None, museum_visited: Optional[str] = None,
                      priority: int = 3) -> dict:
    sql = """
        INSERT INTO user_artworks (artwork_id, list_type, rating, notes, date_seen, museum_visited, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(artwork_id, list_type) DO UPDATE SET
            rating=excluded.rating,
            notes=excluded.notes,
            date_seen=excluded.date_seen,
            museum_visited=excluded.museum_visited,
            priority=excluded.priority,
            updated_at=CURRENT_TIMESTAMP
    """
    await db.execute(sql, (artwork_id, list_type, rating, notes, date_seen, museum_visited, priority))
    await db.commit()
    return {"artwork_id": artwork_id, "list_type": list_type}


async def remove_from_list(db: aiosqlite.Connection, artwork_id: int, list_type: str):
    await db.execute("DELETE FROM user_artworks WHERE artwork_id=? AND list_type=?", (artwork_id, list_type))
    await db.commit()


async def get_user_artwork_ids(db: aiosqlite.Connection) -> set[int]:
    """Returns set of all artwork_ids that appear in any user list."""
    async with db.execute("SELECT DISTINCT artwork_id FROM user_artworks") as cur:
        return {r[0] for r in await cur.fetchall()}


async def get_recently_seen_artwork_ids(db: aiosqlite.Connection, days: int = 60) -> set[int]:
    """Returns IDs of artworks interacted with within the last N days."""
    sql = "SELECT DISTINCT artwork_id FROM user_artworks WHERE added_at >= datetime('now', ?)"
    async with db.execute(sql, (f"-{days} days",)) as cur:
        return {r[0] for r in await cur.fetchall()}


async def get_rated_artworks(db: aiosqlite.Connection) -> list[dict]:
    """Artworks that the user has explicitly rated (seen with a rating)."""
    sql = """
        SELECT ua.rating, a.*
        FROM user_artworks ua
        JOIN artworks a ON ua.artwork_id = a.id
        WHERE ua.list_type = 'seen' AND ua.rating IS NOT NULL
    """
    async with db.execute(sql) as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─────────────────────────────────────────────────────────────────────────────
# TASTE PROFILE
# ─────────────────────────────────────────────────────────────────────────────

async def get_taste_profile(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute("SELECT * FROM taste_profile ORDER BY affinity_score DESC") as cur:
        return [dict(r) for r in await cur.fetchall()]


async def upsert_taste_entry(db: aiosqlite.Connection, dimension: str, value: str,
                              score: float, count: int):
    sql = """
        INSERT INTO taste_profile (dimension, value, affinity_score, artwork_count)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(dimension, value) DO UPDATE SET
            affinity_score=excluded.affinity_score,
            artwork_count=excluded.artwork_count,
            updated_at=CURRENT_TIMESTAMP
    """
    await db.execute(sql, (dimension, value, score, count))
    await db.commit()


async def clear_taste_profile(db: aiosqlite.Connection):
    await db.execute("DELETE FROM taste_profile")
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# API CACHE
# ─────────────────────────────────────────────────────────────────────────────

async def get_cache(db: aiosqlite.Connection, cache_key: str) -> Optional[dict]:
    sql = "SELECT * FROM api_cache WHERE cache_key=? AND expires_at > CURRENT_TIMESTAMP"
    async with db.execute(sql, (cache_key,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def set_cache(db: aiosqlite.Connection, cache_key: str, source: str,
                    query: str, response: dict):
    expires = (datetime.utcnow() + timedelta(days=settings.CACHE_TTL_DAYS)).isoformat()
    sql = """
        INSERT INTO api_cache (cache_key, source, query, response_json, expires_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            response_json=excluded.response_json,
            fetched_at=CURRENT_TIMESTAMP,
            expires_at=excluded.expires_at
    """
    await db.execute(sql, (cache_key, source, query, json.dumps(response), expires))
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# MUSEUM VISITS
# ─────────────────────────────────────────────────────────────────────────────

async def get_museum_visits(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute("SELECT * FROM museum_visits ORDER BY visit_date DESC") as cur:
        return [dict(r) for r in await cur.fetchall()]


async def add_museum_visit(db: aiosqlite.Connection, museum_name: str, city: str = None,
                            country: str = None, visit_date: str = None, notes: str = None) -> int:
    sql = """
        INSERT INTO museum_visits (museum_name, city, country, visit_date, notes)
        VALUES (?, ?, ?, ?, ?)
    """
    async with db.execute(sql, (museum_name, city, country, visit_date, notes)) as cur:
        await db.commit()
        return cur.lastrowid


# ─────────────────────────────────────────────────────────────────────────────
# STATS
# ─────────────────────────────────────────────────────────────────────────────

async def get_stats(db: aiosqlite.Connection) -> dict:
    async with db.execute("SELECT COUNT(*) FROM user_artworks WHERE list_type='seen'") as cur:
        seen_count = (await cur.fetchone())[0]
    async with db.execute("SELECT COUNT(*) FROM user_artworks WHERE list_type='bucket'") as cur:
        bucket_count = (await cur.fetchone())[0]
    async with db.execute("SELECT AVG(rating) FROM user_artworks WHERE list_type='seen' AND rating IS NOT NULL") as cur:
        avg_rating = (await cur.fetchone())[0] or 0
    async with db.execute("SELECT COUNT(*) FROM visits") as cur:
        visit_count = (await cur.fetchone())[0]
    return {
        "seen_count": seen_count,
        "bucket_count": bucket_count,
        "avg_rating": round(avg_rating, 1),
        "visit_count": visit_count,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ARTWORK ENRICHMENT
# ─────────────────────────────────────────────────────────────────────────────

async def upsert_enrichment(db: aiosqlite.Connection, artwork_id: int, data: dict):
    cols = ["artwork_id"] + list(data.keys())
    vals = [artwork_id] + list(data.values())
    placeholders = ", ".join("?" * len(cols))
    col_names = ", ".join(cols)
    updates = ", ".join(f"{c}=excluded.{c}" for c in data.keys())
    sql = f"""
        INSERT INTO artwork_enrichment ({col_names}) VALUES ({placeholders})
        ON CONFLICT(artwork_id) DO UPDATE SET {updates}, fetched_at=CURRENT_TIMESTAMP
    """
    await db.execute(sql, vals)
    await db.commit()


async def get_enrichment(db: aiosqlite.Connection, artwork_id: int) -> Optional[dict]:
    sql = "SELECT * FROM artwork_enrichment WHERE artwork_id = ?"
    async with db.execute(sql, (artwork_id,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


# ─────────────────────────────────────────────────────────────────────────────
# EXHIBITIONS
# ─────────────────────────────────────────────────────────────────────────────

async def create_exhibition(db: aiosqlite.Connection, data: dict) -> int:
    cols = list(data.keys())
    vals = list(data.values())
    placeholders = ", ".join("?" * len(cols))
    col_names = ", ".join(cols)
    sql = f"INSERT INTO exhibitions ({col_names}) VALUES ({placeholders})"
    async with db.execute(sql, vals) as cur:
        await db.commit()
        return cur.lastrowid


async def get_exhibitions(db: aiosqlite.Connection, city: Optional[str] = None) -> list:
    if city:
        sql = "SELECT * FROM exhibitions WHERE LOWER(city) = LOWER(?) ORDER BY start_date"
        async with db.execute(sql, (city,)) as cur:
            return [dict(r) for r in await cur.fetchall()]
    else:
        async with db.execute("SELECT * FROM exhibitions ORDER BY start_date") as cur:
            return [dict(r) for r in await cur.fetchall()]


async def update_exhibition_affinity(db: aiosqlite.Connection, exhibition_id: int, affinity: float):
    await db.execute(
        "UPDATE exhibitions SET taste_affinity=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (affinity, exhibition_id),
    )
    await db.commit()


async def set_exhibition_status(db: aiosqlite.Connection, exhibition_id: int, status: str):
    sql = """
        INSERT INTO user_exhibitions (exhibition_id, status)
        VALUES (?, ?)
        ON CONFLICT(exhibition_id) DO UPDATE SET status=excluded.status, updated_at=CURRENT_TIMESTAMP
    """
    try:
        await db.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_exh_eid ON user_exhibitions(exhibition_id)"
        )
    except Exception:
        pass
    await db.execute(sql, (exhibition_id, status))
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# VISITS
# ─────────────────────────────────────────────────────────────────────────────

async def create_visit(db: aiosqlite.Connection, data: dict) -> int:
    cols = list(data.keys())
    vals = list(data.values())
    placeholders = ", ".join("?" * len(cols))
    col_names = ", ".join(cols)
    sql = f"INSERT INTO visits ({col_names}) VALUES ({placeholders})"
    async with db.execute(sql, vals) as cur:
        await db.commit()
        return cur.lastrowid


async def get_visits(db: aiosqlite.Connection) -> list:
    async with db.execute("SELECT * FROM visits ORDER BY visit_date DESC") as cur:
        return [dict(r) for r in await cur.fetchall()]


async def get_visit(db: aiosqlite.Connection, visit_id: int) -> Optional[dict]:
    async with db.execute("SELECT * FROM visits WHERE id = ?", (visit_id,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def update_visit(db: aiosqlite.Connection, visit_id: int, data: dict):
    sets = ", ".join(f"{k}=?" for k in data.keys())
    vals = list(data.values()) + [visit_id]
    await db.execute(f"UPDATE visits SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE id=?", vals)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# PHOTOS
# ─────────────────────────────────────────────────────────────────────────────

async def create_photo(db: aiosqlite.Connection, data: dict) -> int:
    cols = list(data.keys())
    vals = list(data.values())
    placeholders = ", ".join("?" * len(cols))
    col_names = ", ".join(cols)
    sql = f"INSERT INTO photos ({col_names}) VALUES ({placeholders})"
    async with db.execute(sql, vals) as cur:
        await db.commit()
        return cur.lastrowid


async def get_photos_for_visit(db: aiosqlite.Connection, visit_id: int) -> list:
    async with db.execute("SELECT * FROM photos WHERE visit_id=? ORDER BY created_at", (visit_id,)) as cur:
        return [dict(r) for r in await cur.fetchall()]


async def get_photos_for_artwork(db: aiosqlite.Connection, artwork_id: int) -> list:
    async with db.execute("SELECT * FROM photos WHERE artwork_id=? ORDER BY created_at", (artwork_id,)) as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─────────────────────────────────────────────────────────────────────────────
# ARTWORK ANNOTATIONS
# ─────────────────────────────────────────────────────────────────────────────

async def create_annotation(db: aiosqlite.Connection, artwork_id: int,
                            note_text: Optional[str] = None,
                            photo_id: Optional[int] = None) -> int:
    sql = "INSERT INTO artwork_annotations (artwork_id, note_text, photo_id) VALUES (?, ?, ?)"
    async with db.execute(sql, (artwork_id, note_text, photo_id)) as cur:
        await db.commit()
        return cur.lastrowid


async def get_annotations(db: aiosqlite.Connection, artwork_id: int) -> list:
    sql = "SELECT * FROM artwork_annotations WHERE artwork_id=? ORDER BY created_at DESC"
    async with db.execute(sql, (artwork_id,)) as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─────────────────────────────────────────────────────────────────────────────
# PROBE LOG
# ─────────────────────────────────────────────────────────────────────────────

async def log_probe(db: aiosqlite.Connection, artwork_id: int, probe_type: str,
                    expected_signal: str, actual_signal: str, agreed: bool):
    sql = """
        INSERT INTO probe_log (artwork_id, probe_type, expected_signal, actual_signal, agreed)
        VALUES (?, ?, ?, ?, ?)
    """
    await db.execute(sql, (artwork_id, probe_type, expected_signal, actual_signal, agreed))
    await db.commit()


async def get_recent_probes(db: aiosqlite.Connection, days: int = 30) -> list:
    sql = """
        SELECT * FROM probe_log
        WHERE created_at >= datetime('now', ?)
        ORDER BY created_at DESC
    """
    async with db.execute(sql, (f"-{days} days",)) as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─────────────────────────────────────────────────────────────────────────────
# USER SETTINGS
# ─────────────────────────────────────────────────────────────────────────────

async def get_settings(db: aiosqlite.Connection) -> dict:
    async with db.execute("SELECT * FROM user_settings WHERE id=1") as cur:
        row = await cur.fetchone()
        if row:
            return dict(row)
    await db.execute("INSERT OR IGNORE INTO user_settings DEFAULT VALUES")
    await db.commit()
    async with db.execute("SELECT * FROM user_settings WHERE id=1") as cur:
        return dict(await cur.fetchone())


async def update_settings(db: aiosqlite.Connection, data: dict):
    sets = ", ".join(f"{k}=?" for k in data.keys())
    vals = list(data.values())
    await db.execute(f"UPDATE user_settings SET {sets} WHERE id=1", vals)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# DOSSIER QUEUE
# ─────────────────────────────────────────────────────────────────────────────

async def enqueue_dossier(db: aiosqlite.Connection, artwork_id: int, priority: int = 1) -> None:
    """Add artwork to enrichment queue and create dossier placeholder. Idempotent."""
    await db.execute(
        """INSERT OR IGNORE INTO dossier_queue (artwork_id, priority, status, created_at)
           VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)""",
        (artwork_id, priority),
    )
    await db.execute(
        """INSERT OR IGNORE INTO artwork_dossier (artwork_id, status, queued_at)
           VALUES (?, 'pending', CURRENT_TIMESTAMP)""",
        (artwork_id,),
    )
    await db.commit()


async def get_pending_queue_items(db: aiosqlite.Connection, limit: int = 5) -> list[dict]:
    """Return up to `limit` pending queue items, highest priority first."""
    async with db.execute(
        """SELECT artwork_id, priority, attempts FROM dossier_queue
           WHERE status = 'pending' AND attempts < 3
           ORDER BY priority DESC, created_at ASC
           LIMIT ?""",
        (limit,),
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


async def mark_queue_processing(db: aiosqlite.Connection, artwork_id: int) -> None:
    await db.execute(
        """UPDATE dossier_queue
           SET status = 'processing', last_attempted_at = CURRENT_TIMESTAMP,
               attempts = attempts + 1
           WHERE artwork_id = ?""",
        (artwork_id,),
    )
    await db.commit()


async def mark_queue_complete(db: aiosqlite.Connection, artwork_id: int) -> None:
    await db.execute(
        "UPDATE dossier_queue SET status = 'complete' WHERE artwork_id = ?",
        (artwork_id,),
    )
    await db.commit()


async def mark_queue_failed(db: aiosqlite.Connection, artwork_id: int, error: str) -> None:
    await db.execute(
        "UPDATE dossier_queue SET status = 'failed' WHERE artwork_id = ?",
        (artwork_id,),
    )
    await db.execute(
        """UPDATE artwork_dossier SET status = 'failed', error_message = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE artwork_id = ?""",
        (error, artwork_id),
    )
    await db.commit()


async def boost_dossier_priority(db: aiosqlite.Connection, artwork_id: int, priority: int = 10) -> None:
    """Raise queue priority for an artwork (e.g., when it appears in the feed)."""
    await db.execute(
        """UPDATE dossier_queue SET priority = ?
           WHERE artwork_id = ? AND status = 'pending'""",
        (priority, artwork_id),
    )
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# DOSSIER DATA
# ─────────────────────────────────────────────────────────────────────────────

async def get_dossier(db: aiosqlite.Connection, artwork_id: int) -> Optional[dict]:
    async with db.execute(
        "SELECT * FROM artwork_dossier WHERE artwork_id = ?", (artwork_id,)
    ) as cur:
        row = await cur.fetchone()
    return dict(row) if row else None


async def upsert_dossier(db: aiosqlite.Connection, artwork_id: int, data: dict) -> None:
    """Merge `data` dict into the artwork_dossier row for `artwork_id`."""
    allowed = {
        "artic_id", "medium_display", "technique_titles", "style_titles",
        "subject_titles", "classification_titles", "physical_dimensions",
        "inscriptions", "color_palette", "technique_definitions",
        "movement_hierarchy", "movement_characteristics", "artist_influences",
        "artist_influenced", "artist_bio", "artist_nationality",
        "artist_birth_year", "artist_death_year", "data_sources",
        "status", "completed_at", "error_message",
    }
    valid = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not valid:
        return
    set_clause = ", ".join(f"{k} = ?" for k in valid)
    set_clause += ", updated_at = CURRENT_TIMESTAMP"
    await db.execute(
        f"UPDATE artwork_dossier SET {set_clause} WHERE artwork_id = ?",
        [*valid.values(), artwork_id],
    )
    await db.commit()
