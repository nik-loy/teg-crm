# 🎨 GoodArts — PRIMER (Source of Truth)

> **Version:** 0.6.0
> **Status:** Phase 6 — Search Overhaul (spec approved)
> **Last Updated:** 2026-05-04

---

## 1. App Identity

**GoodArts** is a local-first, single-user "Goodreads for Art" — a personal art companion that helps users:

- **Discover** new art through intelligent, taste-driven recommendations and curated feeds
- **Track** museum visits and artworks they've seen (Seen List)
- **Curate** a bucket list of art they want to see
- **Search** a growing personal art library powered by FTS5 + multi-provider APIs
- **Explore** upcoming exhibitions matched to their taste profile
- **Enrich** any artwork with a Technical Dossier (materials, technique, color palette, artist lineage)

The app runs entirely locally via `python run.py` — no cloud, no accounts, no complexity.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Python 3.12 | Ubiquitous, easy install |
| Backend | **FastAPI** | Async-ready, auto-docs, modern Python |
| Database | **SQLite** (via `aiosqlite`) | Zero-config, portable, single-file. FTS5 built-in. |
| Frontend | **Vanilla HTML/CSS/JS** | Served by FastAPI StaticFiles. No build step. |
| Primary API | Wikidata SPARQL + wbsearchentities | Free, open, rich art metadata |
| Secondary APIs | MET, ARTIC, Europeana, Getty, Rijksmuseum, Harvard | Supplementary — most require no API key |
| Launcher | `run.py` | Single entry point: installs deps + opens browser |

### Why NOT Streamlit / React?
- **Streamlit**: Opinionated layout, hard to achieve premium UI, re-runs on every interaction
- **React**: Requires Node.js toolchain — breaks the "one-click" promise
- **Vanilla frontend**: Zero build step. FastAPI serves static files. One command.

---

## 3. Core Concepts

### 3.1 Artwork Record
```
title, artist, year, medium, movement, era, museum, museum_city, museum_country
image_url, image_url_hd, thumbnail_path, dominant_color, description
wikidata_id, europeana_id, source, source_id
```
`era` is auto-derived from `year` (Medieval / Renaissance / Baroque / … / Contemporary).

### 3.2 User Interaction Model

| Flow | Description |
|---|---|
| **Onboarding** | Tinder-style swipe-to-rate stack of iconic artworks. After 10 swipes, compute taste profile. |
| **Feed** | Infinite scroll of artworks composed from: 35% taste-matched, 20% popular, 20% unexplored, 15% probes, 10% diverse |
| **Search** | FTS5 local search + multi-provider fan-out (Wikidata, MET, ARTIC, Europeana). Results grouped by era band. |
| **Explore** | Browse curated collections by movement on the search screen |
| **Collection** | Seen list (with ratings + notes) and Bucket list |
| **Exhibitions** | Upcoming exhibitions scored against user taste profile |
| **Visits** | Log museum visits with photos, notes, artworks seen |
| **Dossier** | Technical Dossier tab on artwork detail: materials, technique, color palette, artist lineage |

### 3.3 Art Pattern Engine

Builds a **Taste Profile** from user signals (swipe direction, ratings):

```
Taste signal → affinity_score update per dimension

Dimensions and weights:
  movement   × 3.0   (e.g., Impressionism, Baroque)
  artist     × 2.5   (e.g., Monet, Klimt)
  era        × 2.0   (e.g., 19th Century, Renaissance)
  geography  × 1.5   (e.g., France, Netherlands)
  medium     × 1.0   (e.g., Oil on canvas, Watercolour)

Recommendation score:
  For each candidate artwork:
    score = Σ (affinity[dim][val] × weight[dim])
    rank by score DESC
```

**Signals**: swipe-left (−1), skip (0), long-press (+1), swipe-right (+3), swipe-up (+5).

### 3.4 Search Architecture (Phase 6 target)

```
Query → FTS5 local (BM25 ranked)
      + asyncio.gather:
          Wikidata two-phase (entity resolve → SPARQL by Q-number)
          MET Museum (no key, 470K objects)
          ARTIC (no key, best Impressionist collection in the US)
          Europeana (optional key)
→ Upsert remote results to local DB (index grows with every search)
→ Frontend groups by era band
```

---

## 4. API Strategy

### Tier 1 — Primary (no key required)
| Provider | Strength |
|---|---|
| **Wikidata SPARQL** | Comprehensive metadata, artist Q-numbers, movements, influences |
| **MET Museum** | 470K+ objects, encyclopedic, open access |
| **ARTIC** | Art Institute of Chicago — outstanding Impressionist/Modern collection |
| **Getty AAT** | Technique and material definitions (SPARQL) |
| **Getty ULAN** | Artist biography and nationality (SPARQL) |

### Tier 2 — Supplementary (key optional / free)
| Provider | Key | Strength |
|---|---|---|
| **Europeana** | Yes (free) | European cultural heritage, broad search |
| **Rijksmuseum** | Yes (free) | Dutch masters, excellent image quality |
| **Harvard Art Museums** | Yes (free) | Strong academic metadata |
| **Smithsonian** | Yes (free) | American art + natural history |
| **Artsy** | Yes (free) | Exhibition data sync |

### Image Strategy
- **No local downloads** — store URLs only (prevents storage bloat)
- **HD enforcement** — always prefer P18 (Wikidata), IIIF full-res (ARTIC), `edmIsShownBy` (Europeana)
- **Proxy** — `image_proxy.py` handles CORS-blocked images server-side

---

## 5. Design Philosophy

- **The App is an Artwork**: Premium gallery aesthetic, not "generic AI slop." Custom art themes (Van Gogh / Dali / Magritte / Klimt).
- **Data Offline, Images Online**: Text/metadata operates fully offline via SQLite. Images hotlinked.
- **Privacy-first**: No telemetry, no accounts, no cloud sync.
- **Transparent intelligence**: Recommendations show *why* (affinity scores surfaced to UI).
- **Build it right**: FTS5 over LIKE queries. Two-phase API resolution over keyword guessing. Cache everything so the system improves with use.
- **One-click launch**: `python run.py` handles everything.

---

## 6. Non-Goals (v1)

- Multi-user / authentication
- Cloud sync / mobile app
- ML/vector-based recommendations (keep it heuristic — transparent and explainable)
- Social features (sharing, following)
- Image recognition / camera input
- Real-time websocket streaming

---

## 7. Phase History

| Phase | Description | Status |
|---|---|---|
| 1 | Planning & Architecture | COMPLETE |
| 2 | Core Backend (FastAPI, SQLite, CRUD, Wikidata, Engine) | COMPLETE |
| 3 | Frontend (SPA, all views, onboarding, search, collection) | COMPLETE |
| 4 | Living Gallery Theming (4 art themes) | COMPLETE |
| 5 | Technical Dossier (background enrichment, 4 API clients, dossier tab) | COMPLETE |
| **6** | **Search Overhaul (FTS5, two-phase Wikidata, MET+ARTIC fan-out, era grouping)** | **IN PROGRESS** |
