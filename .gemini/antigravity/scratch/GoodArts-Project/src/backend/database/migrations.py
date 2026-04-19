"""
GoodArts Database — Schema migrations.
Idempotent: safe to call on every app startup.
"""
import aiosqlite
from src.backend.config import settings


SCHEMA = """
CREATE TABLE IF NOT EXISTS artworks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    artist          TEXT,
    year            INTEGER,
    medium          TEXT,
    movement        TEXT,
    era             TEXT,
    museum          TEXT,
    museum_city     TEXT,
    museum_country  TEXT,
    image_url       TEXT,
    image_url_hd    TEXT,
    thumbnail_path  TEXT,
    dominant_color  TEXT,
    description     TEXT,
    wikidata_id     TEXT UNIQUE,
    europeana_id    TEXT UNIQUE,
    source          TEXT DEFAULT 'manual',
    source_id       TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_artworks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id      INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
    list_type       TEXT NOT NULL CHECK(list_type IN ('seen', 'bucket')),
    rating          INTEGER CHECK(rating BETWEEN 1 AND 5),
    notes           TEXT,
    date_seen       DATE,
    museum_visited  TEXT,
    priority        INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artwork_id, list_type)
);

CREATE TABLE IF NOT EXISTS taste_profile (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dimension       TEXT NOT NULL,
    value           TEXT NOT NULL,
    affinity_score  REAL DEFAULT 0.0,
    artwork_count   INTEGER DEFAULT 0,
    last_rating_at  TIMESTAMP,
    sentiment_sum   REAL DEFAULT 0.0,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dimension, value)
);

CREATE TABLE IF NOT EXISTS api_cache (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key       TEXT UNIQUE NOT NULL,
    source          TEXT NOT NULL,
    query           TEXT NOT NULL,
    response_json   TEXT NOT NULL,
    fetched_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS artwork_enrichment (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id          INTEGER REFERENCES artworks(id) UNIQUE,
    formal_analysis     TEXT,
    technique_notes     TEXT,
    iconography         TEXT,
    movement_context    TEXT,
    historical_period   TEXT,
    impact_on_art       TEXT,
    contemporary_rel    TEXT,
    provenance          TEXT,
    artist_context      TEXT,
    fun_facts           TEXT,
    fetched_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exhibitions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    venue_name      TEXT,
    city            TEXT,
    country         TEXT,
    start_date      DATE,
    end_date        DATE,
    image_url       TEXT,
    source          TEXT,
    source_id       TEXT,
    movement_tags   TEXT,
    artist_tags     TEXT,
    taste_affinity  REAL DEFAULT 0.0,
    url             TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_exhibitions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    exhibition_id   INTEGER REFERENCES exhibitions(id),
    status          TEXT DEFAULT 'interested',
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visits (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_name      TEXT NOT NULL,
    city            TEXT,
    country         TEXT,
    visit_date      DATE,
    overall_notes   TEXT,
    overall_rating  REAL,
    duration_min    INTEGER,
    exhibition_id   INTEGER REFERENCES exhibitions(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id        INTEGER REFERENCES visits(id),
    artwork_id      INTEGER REFERENCES artworks(id),
    file_path       TEXT NOT NULL,
    thumbnail_path  TEXT,
    caption         TEXT,
    taken_at        TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artwork_annotations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id      INTEGER REFERENCES artworks(id),
    note_text       TEXT,
    photo_id        INTEGER REFERENCES photos(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS probe_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id      INTEGER REFERENCES artworks(id),
    probe_type      TEXT,
    expected_signal TEXT,
    actual_signal   TEXT,
    agreed          BOOLEAN,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    id                      INTEGER PRIMARY KEY DEFAULT 1,
    home_city               TEXT DEFAULT 'São Paulo',
    home_country            TEXT DEFAULT 'Brazil',
    temp_city               TEXT,
    exhibition_sync_interval INTEGER DEFAULT 86400,
    last_exhibition_sync    TIMESTAMP,
    daily_masterpiece_id    INTEGER,
    daily_masterpiece_date  DATE,
    onboarding_done         BOOLEAN DEFAULT 0,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artworks_movement   ON artworks(movement);
CREATE INDEX IF NOT EXISTS idx_artworks_artist     ON artworks(artist);
CREATE INDEX IF NOT EXISTS idx_artworks_wikidata   ON artworks(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_artworks_europeana  ON artworks(europeana_id);
CREATE INDEX IF NOT EXISTS idx_user_artworks_list  ON user_artworks(list_type);
CREATE INDEX IF NOT EXISTS idx_user_artworks_rating ON user_artworks(rating);
CREATE INDEX IF NOT EXISTS idx_taste_dimension     ON taste_profile(dimension, value);
CREATE INDEX IF NOT EXISTS idx_cache_key           ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires       ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_exhibitions_city    ON exhibitions(city);
CREATE INDEX IF NOT EXISTS idx_photos_artwork      ON photos(artwork_id);
CREATE INDEX IF NOT EXISTS idx_photos_visit        ON photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_annotations_artwork ON artwork_annotations(artwork_id);
CREATE INDEX IF NOT EXISTS idx_probe_log_date      ON probe_log(created_at);

CREATE TABLE IF NOT EXISTS artwork_dossier (
    artwork_id          INTEGER PRIMARY KEY REFERENCES artworks(id) ON DELETE CASCADE,
    artic_id            TEXT,
    medium_display      TEXT,
    technique_titles    TEXT,
    style_titles        TEXT,
    subject_titles      TEXT,
    classification_titles TEXT,
    physical_dimensions TEXT,
    inscriptions        TEXT,
    color_palette       TEXT,
    technique_definitions TEXT,
    movement_hierarchy  TEXT,
    movement_characteristics TEXT,
    artist_influences   TEXT,
    artist_influenced   TEXT,
    artist_bio          TEXT,
    artist_nationality  TEXT,
    artist_birth_year   INTEGER,
    artist_death_year   INTEGER,
    data_sources        TEXT,
    status              TEXT DEFAULT 'pending',
    attempts            INTEGER DEFAULT 0,
    queued_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP,
    error_message       TEXT
);

CREATE TABLE IF NOT EXISTS dossier_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id      INTEGER UNIQUE REFERENCES artworks(id) ON DELETE CASCADE,
    priority        INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'pending',
    attempts        INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_attempted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dossier_queue_priority
    ON dossier_queue(status, priority DESC, created_at ASC);
"""


async def run_migrations():
    """Run all CREATE TABLE IF NOT EXISTS statements. Safe to call on every boot."""
    settings.ensure_data_dir()
    async with aiosqlite.connect(str(settings.DB_PATH)) as db:
        await db.executescript(SCHEMA)
        for col, typ in [
            ("thumbnail_path", "TEXT"),
            ("dominant_color", "TEXT"),
            ("source_id", "TEXT"),
        ]:
            try:
                await db.execute(f"ALTER TABLE artworks ADD COLUMN {col} {typ}")
            except Exception:
                pass
        # Create this index after source_id is guaranteed to exist
        try:
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_artworks_source ON artworks(source, source_id)"
            )
        except Exception:
            pass
        # Seed artwork data once (idempotent)
        async with db.execute("SELECT COUNT(*) FROM artworks WHERE source='seed'") as cur:
            artwork_seed_count = (await cur.fetchone())[0]
        if artwork_seed_count == 0:
            from src.backend.data.test_artworks_seed import get_test_artworks_seed
            for artwork in get_test_artworks_seed():
                cols = list(artwork.keys())
                vals = list(artwork.values())
                placeholders = ", ".join("?" * len(cols))
                col_str = ", ".join(cols)
                await db.execute(
                    f"INSERT OR IGNORE INTO artworks ({col_str}) VALUES ({placeholders})",
                    vals,
                )
            await db.commit()
            print(f"Seeded {len(get_test_artworks_seed())} test artworks.")

        # Seed exhibition data once (idempotent)
        async with db.execute("SELECT COUNT(*) FROM exhibitions WHERE source='seed'") as cur:
            seed_count = (await cur.fetchone())[0]
        if seed_count == 0:
            from src.backend.data.exhibition_seed import get_exhibition_seed
            for exh in get_exhibition_seed():
                cols = list(exh.keys())
                vals = list(exh.values())
                placeholders = ", ".join("?" * len(cols))
                col_str = ", ".join(cols)
                await db.execute(
                    f"INSERT OR IGNORE INTO exhibitions ({col_str}) VALUES ({placeholders})",
                    vals,
                )
            await db.commit()
            print(f"Seeded {len(get_exhibition_seed())} exhibitions.")
        for col, typ in [
            ("last_rating_at", "TIMESTAMP"),
            ("sentiment_sum", "REAL DEFAULT 0.0"),
        ]:
            try:
                await db.execute(f"ALTER TABLE taste_profile ADD COLUMN {col} {typ}")
            except Exception:
                pass
        try:
            await db.execute(
                "ALTER TABLE user_settings ADD COLUMN cma_fetch_offset INTEGER DEFAULT 0"
            )
        except Exception:
            pass
        await db.commit()
    print("Database schema is up to date.")
