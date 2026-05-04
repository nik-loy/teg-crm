# ✅ GoodArts — TODO Tracker

> **Last Updated:** 2026-05-04
> **Legend:** `PENDING` | `WORKING` | `COMPLETE` | `BLOCKED`

---

## Phase 1: Planning & Architecture — `COMPLETE`

| # | Task | Status |
|---|------|--------|
| 1.1 | Create `.vibe/` infrastructure | `COMPLETE` |
| 1.2 | Design SQLite schema | `COMPLETE` |
| 1.3 | Propose directory structure | `COMPLETE` |
| 1.4 | Solidify requirements with user | `COMPLETE` |

---

## Phase 2: Core Development — `COMPLETE`

| # | Task | Status |
|---|------|--------|
| 2.1 | `run.py` launcher | `COMPLETE` |
| 2.2 | FastAPI app factory (`app.py`) | `COMPLETE` |
| 2.3 | Config module (`config.py`) | `COMPLETE` |
| 2.4 | SQLite connection + migrations | `COMPLETE` |
| 2.5 | CRUD operations | `COMPLETE` |
| 2.6 | Pydantic schemas | `COMPLETE` |
| 2.7 | All API routes | `COMPLETE` |
| 2.8 | Wikidata SPARQL client | `COMPLETE` |
| 2.9 | Europeana REST client | `COMPLETE` |
| 2.10 | Taste profile engine | `COMPLETE` |
| 2.11 | Recommendation scorer | `COMPLETE` |

---

## Phase 3: Frontend — `COMPLETE`

| # | Task | Status |
|---|------|--------|
| 3.1 | Design system CSS | `COMPLETE` |
| 3.2 | SPA shell + hash router | `COMPLETE` |
| 3.3 | Onboarding swipe flow | `COMPLETE` |
| 3.4 | Feed / Discover view | `COMPLETE` |
| 3.5 | Search view | `COMPLETE` |
| 3.6 | Collection (seen + bucket) view | `COMPLETE` |
| 3.7 | Artwork detail modal | `COMPLETE` |
| 3.8 | Events / exhibitions view | `COMPLETE` |
| 3.9 | Visit detail view | `COMPLETE` |

---

## Phase 4: Living Gallery Theming — `COMPLETE`

| # | Task | Status |
|---|------|--------|
| 4.1 | Art theme system (CSS variables) | `COMPLETE` |
| 4.2 | Van Gogh theme | `COMPLETE` |
| 4.3 | Dali theme | `COMPLETE` |
| 4.4 | Magritte theme | `COMPLETE` |
| 4.5 | Klimt theme | `COMPLETE` |

---

## Phase 5: Technical Dossier — `COMPLETE`

| # | Task | Status |
|---|------|--------|
| 5.1 | `artwork_dossier` table migration | `COMPLETE` |
| 5.2 | `dossier_queue` table migration | `COMPLETE` |
| 5.3 | Dossier CRUD functions | `COMPLETE` |
| 5.4 | Auto-enqueue in `upsert_artwork()` | `COMPLETE` |
| 5.5 | `artic_dossier.py` client | `COMPLETE` |
| 5.6 | `getty_aat.py` client (SPARQL) | `COMPLETE` |
| 5.7 | `getty_ulan.py` client (SPARQL) | `COMPLETE` |
| 5.8 | Wikidata movement/influence queries | `COMPLETE` |
| 5.9 | `dossier_worker.py` background worker | `COMPLETE` |
| 5.10 | Wire worker into `app.py` startup | `COMPLETE` |
| 5.11 | `DossierOut` Pydantic schema | `COMPLETE` |
| 5.12 | `GET /artworks/{id}/dossier` route | `COMPLETE` |
| 5.13 | Dossier tab in artwork detail modal | `COMPLETE` |

---

## Phase 6: Search Overhaul — `WORKING`

> Spec: `docs/superpowers/specs/2026-05-04-search-overhaul-design.md`

### 6A — FTS5 Local Index
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Add FTS5 virtual table to migrations | `PENDING` | porter + unicode61 tokenizer, content='artworks' |
| 6.2 | Add FTS5 sync triggers (insert + update) | `PENDING` | Keep index in sync automatically |
| 6.3 | Backfill FTS5 from existing artworks rows | `PENDING` | One-time INSERT INTO artworks_fts SELECT |
| 6.4 | Replace `search_artworks_local` with FTS5 + BM25 | `PENDING` | Fallback to LIKE if FTS5 unavailable |

### 6B — Two-Phase Wikidata
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.5 | Add `resolve_artist_qid()` to `wikidata.py` | `PENDING` | wbsearchentities API, filter by "painter"/"artist" description |
| 6.6 | Update SPARQL query to use Q-number when resolved | `PENDING` | `wdt:P170 wd:Q296` — all works by artist |
| 6.7 | Remove paintings-only filter (`Q3305213`) | `PENDING` | Accept all visual art types |
| 6.8 | Make image field optional in SPARQL | `PENDING` | Filter client-side instead |

### 6C — Multi-Provider Fan-out
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.9  | Import and wire `search_met` into `/search` | `PENDING` | Already fully implemented in `clients/met.py` |
| 6.10 | Import and wire `search_artic` into `/search` | `PENDING` | Already fully implemented in `clients/artic.py` |
| 6.11 | Run all 4 providers in single `asyncio.gather` | `PENDING` | Each wrapped in `_safe_*` error handler |

### 6D — Result Caching
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.12 | Upsert all remote results to `artworks` after search | `PENDING` | Skip items with no title or stable ID |
| 6.13 | Verify FTS5 trigger fires on upserted rows | `PENDING` | Ensures next search finds cached results locally |

### 6E — Frontend Era Grouping
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.14 | Group results by era band in `search.js` | `PENDING` | 9 bands from Medieval to Contemporary |
| 6.15 | Render era band headings + counts | `PENDING` | Reuse `.section-subheading` class |
| 6.16 | Hide bands with zero results | `PENDING` | |
| 6.17 | Update status line ("N works across M periods") | `PENDING` | |

### 6F — Testing
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.18 | FTS5 unit test with seeded fixture | `PENDING` | Monet, Klimt, Van Gogh |
| 6.19 | Wikidata entity resolution mock test | `PENDING` | Assert Q296 resolved for "Monet" |
| 6.20 | Manual browser test: "Monet" → 40+ results | `PENDING` | |
| 6.21 | Manual browser test: "impressionism" stem match | `PENDING` | |
