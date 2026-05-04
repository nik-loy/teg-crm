# 🏛️ GoodArts — ARCHITECTURE

> **Last Updated:** 2026-05-04
> **Phase:** 6 — Search Overhaul (spec approved, implementation pending)

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser (localhost:8000)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  Feed /  │  │  Search  │  │Collection│  │  Exhibitions│  │
│  │ Discover │  │ + Explore│  │ Seen+Bkt │  │  + Visits   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       └─────────────┼─────────────┘               │         │
│                     │ fetch() / REST               │         │
└─────────────────────┼──────────────────────────────┘         │
                      │
┌─────────────────────┼────────────────────────────────────────┐
│  FastAPI Backend    │                                        │
│  ┌──────────────────▼───────────────────────────────────┐    │
│  │              API Router (routes.py)                  │    │
│  │  /search  /explore  /feed  /artworks  /recommend     │    │
│  │  /exhibitions  /visits  /onboarding  /stats          │    │
│  └──────┬──────────────┬──────────────┬─────────────────┘    │
│         │              │              │                       │
│  ┌──────▼──────┐ ┌─────▼──────┐ ┌────▼───────────┐           │
│  │  DB Layer   │ │ API Client │ │ Pattern Engine │           │
│  │ (database/) │ │ (clients/) │ │  (engine/)     │           │
│  └──────┬──────┘ └─────┬──────┘ └────┬───────────┘           │
│         │              │              │                       │
│  ┌──────▼──────────────▼──────────────▼───────────────────┐   │
│  │            SQLite (artlog.db)                          │   │
│  │  artworks + artworks_fts (Phase 6)                     │   │
│  │  artwork_dossier + dossier_queue                       │   │
│  │  exhibitions + visits + photos + personal_logs         │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Background Workers (asyncio, startup lifecycle)         │  │
│  │  • dossier_worker.py — enriches artworks from API queue  │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flows

### 2.1 Search (Phase 6 — post-overhaul)
```
User types query
  → GET /search?q=monet
    → [1] FTS5 local search (artworks_fts, BM25 ranked) — instant
    → [2] asyncio.gather:
          [2a] Wikidata — resolve artist Q-number → SPARQL by Q-number
          [2b] MET Museum — search_met(q)
          [2c] ARTIC — search_artic(q)
          [2d] Europeana — search_europeana(q) — only if API key set
    → Upsert all remote results to artworks (+ FTS5 via trigger)
    → Deduplicate by wikidata_id / source_id / europeana_id
    → Return {local, remote, suggestion}
  → Frontend groups combined results by era band
  → Renders section headings (Medieval / Renaissance / … / Contemporary)
```

### 2.2 Feed / Discover
```
User opens Discover tab
  → GET /feed (or /recommend)
  → Taste profile consulted (movement/era/artist affinities)
  → Feed composed: 35% taste-matched, 20% popular, 20% unexplored,
                   15% probes (calibration), 10% diverse
  → Returns batch of 20 artworks with "why" context
```

### 2.3 Technical Dossier (background)
```
Artwork imported (any source)
  → upsert_artwork() → enqueue_dossier(priority=1)
  → dossier_worker.py (asyncio, semaphore=3):
      artic_dossier.py → technique, style, subject, color palette
      getty_aat.py     → technique term definitions (SPARQL)
      getty_ulan.py    → artist bio, dates, nationality (SPARQL)
      wikidata.py      → movement hierarchy, influences (SPARQL)
  → artwork_dossier row upserted
  → GET /artworks/{id}/dossier returns structured data
```

### 2.4 Exhibitions Sync
```
Background job (exhibition_sync.py, daily)
  → Fetches exhibitions from Artsy API + configured RSS feeds
  → Normalises city names (unicode, lowercase)
  → Scores taste_affinity against user's taste profile
  → Upserts to exhibitions table
  → Frontend events view shows upcoming + interesting exhibitions
```

---

## 3. Database Schema (current — `migrations.py`)

### Core Tables

| Table | Purpose |
|---|---|
| `artworks` | All artwork records (local + fetched from APIs) |
| `artworks_fts` | FTS5 full-text index over artworks *(Phase 6)* |
| `user_artworks` | User's seen/bucket lists, ratings, notes |
| `taste_profile` | Precomputed affinity scores per dimension/value |
| `api_cache` | 30-day TTL cache of raw API responses |

### Dossier System (Phase 5)

| Table | Purpose |
|---|---|
| `artwork_dossier` | Structured enrichment per artwork (technique, color, artist bio) |
| `dossier_queue` | Priority queue driving the background enrichment worker |

### Gallery / Visits (Phase 3+)

| Table | Purpose |
|---|---|
| `exhibitions` | Exhibition records (Artsy + RSS, with taste_affinity score) |
| `user_exhibitions` | User's interest status per exhibition |
| `visits` | Museum visit log (venue, date, rating, duration) |
| `photos` | Photos attached to visits or artworks |
| `artwork_annotations` | Text notes on specific artworks |
| `personal_logs` | Free-form log entries per artwork or visit |
| `probe_log` | Taste calibration probe results |
| `user_settings` | Single-row user config (home city, onboarding state, etc.) |

### Key Columns Added Post-Initial Schema

| Table | Column | Added when |
|---|---|---|
| `artworks` | `image_url_hd`, `thumbnail_path`, `dominant_color`, `source_id` | Phase 2 |
| `taste_profile` | `last_rating_at`, `sentiment_sum` | Phase 2 |
| `exhibitions` | `normalized_city` | Phase 3 |
| `user_settings` | `cma_fetch_offset` | Phase 3 |

---

## 4. API Clients (`src/backend/clients/`)

| Client | Key? | Use |
|---|---|---|
| `wikidata.py` | No | Artwork search (SPARQL), artist Q-number resolution (wbsearchentities), movement hierarchy, artist influences |
| `europeana.py` | Yes (optional) | Supplementary image search |
| `met.py` | No | MET Museum collection (470K+ objects) — used in feed + **search (Phase 6)** |
| `artic.py` | No | Art Institute of Chicago — strong Impressionist collection — **search (Phase 6)** |
| `artic_dossier.py` | No | ARTIC technique/style/subject/color palette for dossier |
| `rijksmuseum.py` | Yes (optional) | Dutch masters collection |
| `harvard.py` | Yes (optional) | Harvard Art Museums |
| `smithsonian.py` | Yes (optional) | Smithsonian open access |
| `artsy.py` | Yes | Exhibition sync |
| `getty_aat.py` | No | Getty Art & Architecture Thesaurus (technique definitions, SPARQL) |
| `getty_ulan.py` | No | Getty Union List of Artist Names (artist bio, SPARQL) |
| `wikipedia.py` | No | Wikipedia article summaries |
| `wikidata.py` | No | (see above — multi-purpose) |
| `image_proxy.py` | No | Server-side image proxy for CORS-blocked images |

---

## 5. Pattern Engine (`src/backend/engine/`)

| Module | Responsibility |
|---|---|
| `taste_profile.py` | Compute + update affinity scores from user signals (swipe/rate). Dimensions: movement (3.0×), artist (2.5×), era (2.0×), geography (1.5×), medium (1.0×) |
| `recommender.py` | Score candidate artworks against taste profile. Compose feed batches (taste/popular/unexplored/probes/diverse). Exhibition recommendations. |
| `enrichment.py` | Artwork enrichment utilities |
| `probes.py` | Calibration probes — test taste predictions against actual user signals |
| `artwork_fetcher.py` | Fetch artworks for exhibitions (multi-source) |
| `dossier_worker.py` | Background asyncio worker: consumes `dossier_queue`, calls 4 API clients, upserts to `artwork_dossier` |

---

## 6. Frontend Structure (`src/frontend/`)

### Views (`js/views/`)
| File | View |
|---|---|
| `feed.js` / `infinite-scroll-feed.js` | Main art feed with infinite scroll |
| `search.js` | Search + explore collections. **Phase 6: adds era-band grouping** |
| `collection.js` | Seen + bucket list management |
| `artwork-detail.js` | Artwork modal: General Info tab + Technical Dossier tab |
| `onboarding.js` | Tinder-style swipe onboarding |
| `events.js` | Exhibitions + events feed |
| `exhibition-detail.js` | Exhibition detail modal |
| `visit-detail.js` | Museum visit log detail |

### Components (`js/components/`)
| File | Component |
|---|---|
| `artwork-card.js` | Reusable artwork card (image, title, artist) |
| `swipe-deck.js` | Swipe interaction for onboarding |
| `photo-upload.js` | Photo attachment to visits/artworks |
| `rating-stars.js` | Star rating input |
| `expandable.js` | Expandable text sections |

### Themes (`js/`)
| File | Purpose |
|---|---|
| `art-theme.js` | Theme switcher: Van Gogh / Dali / Magritte / Klimt |
| `api.js` | `window.API` — fetch wrapper for all backend calls |
| `app.js` | Main SPA controller + hash router |

---

## 7. Directory Tree (current)

```
GoodArts-Project/
├── .vibe/                          # Vibe Coding infrastructure
│   ├── PRIMER.md                   # App DNA & source of truth
│   ├── TODO.md                     # Task tracker (Phases 1–6)
│   ├── ARCHITECTURE.md             # This file
│   └── CONTEXT.md                  # Session continuity log
│
├── .env.example                    # Template for API keys
├── .env                            # Local secrets (never committed)
├── run.py                          # One-click launcher
├── CLAUDE.md                       # Claude Code project config
│
├── src/
│   ├── backend/
│   │   ├── app.py
│   │   ├── config.py
│   │   ├── api/
│   │   │   ├── routes.py
│   │   │   └── schemas.py
│   │   ├── database/
│   │   │   ├── connection.py
│   │   │   ├── migrations.py
│   │   │   └── crud.py
│   │   ├── clients/               # 13 API client modules
│   │   ├── engine/                # 6 engine modules
│   │   └── data/                  # Seed data (artworks, exhibitions, fun facts)
│   │
│   └── frontend/
│       ├── index.html
│       ├── css/
│       │   ├── styles.css
│       │   └── art-theme.css
│       └── js/
│           ├── app.js
│           ├── api.js
│           ├── art-theme.js
│           ├── components/        # 5 components
│           └── views/             # 8 views
│
├── tests/
│   └── *.py
│
├── docs/
│   ├── ARCHITECTURE.md            # Developer-facing docs
│   ├── API_REFERENCE.md
│   ├── FILE_INDEX.md
│   ├── DATA_MODELS.md
│   ├── COMPONENT_MAP.md
│   ├── TROUBLESHOOTING.md
│   └── superpowers/
│       ├── specs/                 # Design specs (1 per feature)
│       └── plans/                 # Implementation plans (1 per feature)
│
└── data/
    └── artlog.db                  # SQLite (auto-created, not committed)
```

---

## 8. Search Architecture — Phase 6 Target State

```
search_artworks_local()          (database/crud.py)
  └── FTS5 MATCH query
      ORDER BY rank (BM25)
      Fallback: LIKE query

search_wikidata()                (clients/wikidata.py)
  └── resolve_artist_qid(name)   ← NEW: wbsearchentities API
        ↓ Q-number found
      SPARQL: wdt:P170 wd:Q{id}  ← all works by artist, no type filter
        ↓ Q-number not found
      SPARQL: CONTAINS keyword   ← existing fallback

/search route                    (api/routes.py)
  └── asyncio.gather(
        search_artworks_local,   ← FTS5
        _safe_wikidata,          ← two-phase
        _safe_europeana,         ← existing (key optional)
        _safe_met,               ← NEW (no key, 470K objects)
        _safe_artic,             ← NEW (no key, great Impressionists)
      )
      → upsert all remote results to artworks
      → return {local, remote, suggestion}

search.js (frontend)
  └── groupByEraBand(results)
      → render section per band with artwork count
      → hide empty bands
```
