# Search Overhaul — Design Spec
**Date**: 2026-05-04
**Status**: Approved
**Scope**: Backend search pipeline + frontend result grouping

---

## Problem

Searching "Monet" returns ~4 results. Root causes:

1. **MET and ARTIC clients exist but are never called in `/search`** — two of the best free art databases are completely unused.
2. **Wikidata SPARQL is over-constrained**: requires `wdt:P31 wd:Q3305213` (paintings only) AND `?item wdt:P18 ?image` (must have a Wikimedia Commons image). Works classified as watercolours, studies, prints, or simply lacking an image are invisible.
3. **Europeana silently returns nothing** if `EUROPEANA_API_KEY` is not set.
4. **Local DB is sparse**: the SQLite `LIKE` query only finds what has been previously fetched and stored — usually nothing on a fresh install.
5. **No result caching**: remote results are never written back to the DB, so every search re-fetches from scratch and the system never improves.
6. **No UX structure**: all results are dumped into a single flat grid with no way to orient by period.

---

## Goals

1. A search for "Monet" returns 40–80+ results reliably.
2. Results are grouped by era/decade so users can orient themselves temporally.
3. The local index grows with every search — repeat queries get faster and richer.
4. No new external dependencies or API keys required for the core fix.

---

## Non-Goals

- Real-time streaming of results to the frontend (websockets).
- Semantic/vector similarity search.
- User-facing filters (by medium, museum, country) — future work.
- Changing the `SearchResult` API response shape.

---

## Architecture

```
User types query
       │
       ▼
GET /search?q=monet
       │
       ├─► [1] FTS5 local search (SQLite) — instant, ranked
       │
       └─► [2] Remote fan-out (parallel asyncio.gather)
                ├─► [2a] Wikidata — two-phase artist resolution + SPARQL
                ├─► [2b] MET Museum — free, 470K objects
                ├─► [2c] ARTIC — free, strong Impressionist collection
                └─► [2d] Europeana — only if API key is set
                         │
                         ▼
                   [3] Cache all remote results → artworks table + FTS5
                         │
                         ▼
              Return {local, remote, suggestion}
                         │
                         ▼
              [4] Frontend groups by era band, renders sections
```

---

## Layer 1: FTS5 Local Index

### Migration (`database/migrations.py`)

Add a FTS5 virtual table as a content table backed by `artworks`:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS artworks_fts USING fts5(
    title,
    artist,
    movement,
    era,
    museum,
    description,
    content='artworks',
    content_rowid='id',
    tokenize='porter unicode61'
);
```

- `porter` stemmer: "impressionist" matches "impressionism", "painted" matches "painting"
- `unicode61`: handles accented characters (Renoir, Dürer, Modigliani)
- `content='artworks'`: FTS5 stores only the index tokens; text lives in `artworks` (keeps DB size small)

Add a trigger to keep FTS5 in sync on insert and update:

```sql
CREATE TRIGGER IF NOT EXISTS artworks_fts_insert
AFTER INSERT ON artworks BEGIN
    INSERT INTO artworks_fts(rowid, title, artist, movement, era, museum, description)
    VALUES (new.id, new.title, new.artist, new.movement, new.era, new.museum, new.description);
END;

CREATE TRIGGER IF NOT EXISTS artworks_fts_update
AFTER UPDATE ON artworks BEGIN
    INSERT INTO artworks_fts(artworks_fts, rowid, title, artist, movement, era, museum, description)
    VALUES ('delete', old.id, old.title, old.artist, old.movement, old.era, old.museum, old.description);
    INSERT INTO artworks_fts(rowid, title, artist, movement, era, museum, description)
    VALUES (new.id, new.title, new.artist, new.movement, new.era, new.museum, new.description);
END;
```

Run `INSERT INTO artworks_fts(...) SELECT ...` once on migration to index existing rows.

### CRUD (`database/crud.py`)

Replace `search_artworks_local`:

```python
async def search_artworks_local(db, query: str, limit: int = 40) -> list[dict]:
    fts_query = " OR ".join(f'"{term}"' for term in query.split())
    sql = """
        SELECT a.* FROM artworks a
        JOIN artworks_fts f ON a.id = f.rowid
        WHERE artworks_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    """
    async with db.execute(sql, (fts_query, limit)) as cur:
        return [dict(r) for r in await cur.fetchall()]
```

`ORDER BY rank` uses FTS5's built-in BM25 scoring — most relevant results first.

**Fallback**: if the FTS query raises (e.g. special characters), fall back to the existing `LIKE` query silently.

---

## Layer 2: Two-Phase Wikidata Resolution

### Phase 1 — Artist Q-number resolution (`clients/wikidata.py`)

New function `resolve_artist_qid(name: str) -> str | None`:

```python
async def resolve_artist_qid(name: str) -> str | None:
    """Resolve an artist name to their Wikidata Q-number via entity search."""
    params = {
        "action": "wbsearchentities",
        "search": name,
        "language": "en",
        "type": "item",
        "limit": 5,
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get("https://www.wikidata.org/w/api.php", params=params)
        resp.raise_for_status()
        data = resp.json()
    for result in data.get("search", []):
        description = result.get("description", "").lower()
        if any(word in description for word in ("painter", "artist", "sculptor", "draughtsman")):
            return result["id"]  # e.g. "Q296"
    return None
```

Filters results by description so "Monet" → Claude Monet (painter), not a town in France.

### Phase 2 — SPARQL by Q-number

When a Q-number is resolved, use it directly in SPARQL:

```sparql
?item wdt:P170 wd:Q296.   -- creator = Claude Monet
```

This replaces the fragile `CONTAINS(LCASE(?lbl), ...)` match. Removes:
- `wdt:P31 wd:Q3305213` (paintings-only filter) → accept all visual art
- Mandatory `?item wdt:P18 ?image` → make image optional, filter client-side for display

**Fallback**: if Q-number resolution fails or times out, fall back to the current keyword SPARQL (which at least returns something).

---

## Layer 3: Multi-Provider Fan-out

### Route change (`api/routes.py`)

```python
from src.backend.clients.met import search_met
from src.backend.clients.artic import search_artic

wikidata_results, europeana_results, met_results, artic_results = await asyncio.gather(
    _safe_wikidata(q),
    _safe_europeana(q),
    _safe_met(q),
    _safe_artic(q),
)
```

Each provider is wrapped in a `_safe_*` function that catches all exceptions and returns `[]` — one provider being down never breaks the search.

Provider limits:
- Wikidata: up to 40 results (via SPARQL LIMIT)
- MET: up to 20 results (caps parallel object fetches at 10 to avoid hammering the API)
- ARTIC: up to 20 results
- Europeana: up to 40 results (only if API key set)

---

## Layer 4: Result Caching

After the fan-out, upsert all remote results to the `artworks` table:

```python
for item in wikidata_results + met_results + artic_results + europeana_results:
    await crud.upsert_artwork(db, item)
```

`upsert_artwork` already exists and handles `ON CONFLICT(wikidata_id) DO UPDATE`. The FTS5 trigger then indexes each row automatically.

**Deduplication before caching**: items without a stable ID (no `wikidata_id`, `source_id`, or `europeana_id`) are skipped to avoid orphan rows.

---

## Layer 5: Frontend Era/Decade Grouping

### Era bands (`frontend/js/views/search.js`)

After receiving results, group by `year` into bands:

| Band label | Year range |
|---|---|
| Medieval & Earlier | < 1400 |
| Renaissance | 1400 – 1599 |
| Baroque | 1600 – 1749 |
| 18th Century | 1750 – 1799 |
| 19th Century | 1800 – 1899 |
| Early Modern | 1900 – 1944 |
| Mid-Century | 1945 – 1979 |
| Contemporary | 1980+ |
| Unknown | no year data |

Bands with zero results are not rendered. Bands render as a `<h3>` section heading (matching `.section-subheading` class, consistent with `loadCollections()`) followed by a `.search-results-grid`.

### Status line

Update the status text from `"Found N results."` to `"Found N works across M periods."` when grouping is active.

### No change to API contract

The frontend still calls `GET /search?q=` and receives `{local, remote, suggestion}`. Grouping is a pure client-side transformation of the combined `local + remote` array.

---

## Files Changed

| File | Type of change |
|---|---|
| `src/backend/database/migrations.py` | Add FTS5 virtual table, sync triggers, backfill |
| `src/backend/database/crud.py` | Replace `search_artworks_local` with FTS5 + fallback |
| `src/backend/clients/wikidata.py` | Add `resolve_artist_qid()`; loosen SPARQL constraints |
| `src/backend/api/routes.py` | Add MET + ARTIC to fan-out; cache remote results |
| `src/frontend/js/views/search.js` | Group results by era band; update status text |

---

## Testing

- `tests/test_search.py`: unit test FTS5 query with known DB fixture (Monet, Klimt, Van Gogh seeded)
- `tests/test_wikidata.py`: mock `wbsearchentities` response; assert Q-number resolved correctly
- Manual browser test: search "Monet" → expect 40+ results in multiple era bands
- Manual browser test: search "impressionism" → porter stemmer matches "impressionist" works
- Manual browser test: search "mon" (2 chars) → no search fired (min length guard in frontend)

---

## Risks

| Risk | Mitigation |
|---|---|
| Wikidata entity search returns wrong Q-number | Filter by `description` containing artist-related keywords; fall back to keyword SPARQL |
| SPARQL query timeout with broader constraints | Keep 15s timeout; `_safe_wikidata` returns `[]` on failure |
| FTS5 not available in SQLite build | Wrap migration in try/except; fall back to LIKE if FTS5 missing (extremely rare) |
| Caching remote results pollutes local DB with low-quality items | Only upsert items that have at minimum a title and either an image_url or wikidata_id |
