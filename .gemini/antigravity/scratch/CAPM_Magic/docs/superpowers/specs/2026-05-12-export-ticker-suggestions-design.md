# Design Spec — Phase 7: Peer Table Export + Ticker Suggestion Engine

**Date:** 2026-05-12  
**Status:** Approved  
**Decisions:** D27 (Export/Copy), D28 (Ticker Suggestion Engine)

---

## 1. Problem Statement

### P1 — Peer Table Copy

The config-mode peer table is rendered as Streamlit columns + mixed widgets (`st.markdown` / `st.text_input`). There is no real DOM `<table>`, so browser text selection captures the entire row (ticker + all financial data) rather than a single column. Analysts who work in Excel/Word/PowerPoint need to copy just the tickers, or export the full peer table, without manually reformatting.

### P2 — Ticker Suffix Resolution

yfinance requires exchange-qualified symbols for non-US listings (e.g. `SIE.DE`, `ABBN.SW`, `ELUX-B.ST`). Analysts routinely enter bare root symbols (`SIE`, `ABBN`, `ELUXB`) and receive silent failures. The current `_add_peers_batch` flow logs a warning and discards the ticker with no analyst feedback.

---

## 2. Design Decisions

### D27 — Peer Table Export (Binding)

**Implementation:** `st.code(text, language=None)` — Streamlit's built-in component renders a read-only monospace block with a native copy-to-clipboard button in the top-right corner. No JS injection, no browser permission prompts, works in all Streamlit environments.

**Export points and formats:**

| Location | Button label | Format | Target use |
|---|---|---|---|
| Config mode, below peer table | COPY TICKERS | Newline-separated ticker list | Bloomberg terminal paste-in, Excel single column, Word bulleted list |
| Config mode, below peer table | COPY PEER TABLE | TSV with header row | Excel paste → formatted table; Excel → copy → Word/PPT |
| Report mode, below peer detail | COPY RESULTS TABLE | TSV with header row | Excel modeling, client deliverable workbooks |

**Ticker format (newline-separated):**
```
SAP.DE
ASML.AS
SIE.DE
```
Paste into Excel → single column A. Paste into Word → separate paragraphs; one click of "List Bullet" on Home tab converts to bulleted list. Paste into Bloomberg terminal → accepted as ticker list.

**TSV config-mode columns:** `Ticker`, `Company Name`, `Index`, `Country`, `Market Cap (M)`, `Currency`, `Industry`

**TSV report-mode columns:** `Ticker`, `Beta (Adj)`, `D/E Ratio`, `Rf (Local)%`, `Ke (Local)%`, `Unlevered Beta`, `Status`

**Word/PPT workflow note** (rendered as `st.caption` under the TSV block):  
`"Excel: paste directly. Word/PPT: paste into Excel → select range → copy → paste into Word/PPT as table."`

**UI behaviour:** Both export buttons toggle `session_state["show_ticker_export"]` / `session_state["show_table_export"]`. Clicking again collapses. Only renders when `peer_data` is non-empty.

---

### D28 — Ticker Suggestion Engine (Binding)

**Trigger:** A bare ticker (no `.` in symbol) fails yfinance direct enrichment (exception raised, or `longName` and `market_cap` both absent from the returned info dict).

**Search backend:** `yf.Search(ticker, news_count=0).quotes` — available since yfinance 0.2.18, project pins >= 0.2.40. Returns list of dicts; filter to `quoteType == "EQUITY"`, cap at 5 results.

**State:** `session_state["pending_suggestions"]` — `dict[str, list[dict]]` where each inner dict has keys `symbol`, `shortname`, `exchange`. Initialised as `{}` on session start.

**Behaviour rules (non-negotiable):**
1. **Never auto-select.** No suggestion is applied without explicit user click.
2. **Exact-match pass-through.** If the user typed `SAP.DE` and yfinance returns `SAP.DE` directly — no suggestion needed (existing flow already works).
3. **Zero results.** If `yf.Search` returns no equity results → show amber error: `"[TICKER] — not recognized. No suggestions found. Verify the exchange suffix (e.g. .DE, .SW, .ST)."`
4. **Failed-with-suffix.** If the ticker already contains `.` and fails → treat as a data error, not a suggestion case; show existing red error banner.

**Resolution UI:** Renders as a distinct amber-bordered panel **above** the peer table (or above the empty-state message when no peers loaded yet). Only rendered when `pending_suggestions` is non-empty.

Each unresolved ticker shows:
```
ABBN — not recognized. Did you mean:
  [ ABBN.SW  ABB Ltd  Swiss Exchange ]  [ ABBN.US  ABB Ltd  NYSE ]  [ Dismiss ]
```

Each suggestion button displays: `{symbol}  {shortname}  {exchange}`. Clicking a button:
1. Runs `_fetch_one(symbol)` with the confirmed full ticker
2. On success → appends to `peer_data`, removes from `pending_suggestions`
3. On failure → shows inline error under that ticker's row in the suggestions panel

"Dismiss" removes the ticker from `pending_suggestions` without adding to `peer_data`.

**New function:** `_search_ticker_suggestions(bare_ticker: str) -> list[dict]` — wraps `yf.Search`, filters, caps at 5, never raises (returns `[]` on any exception).

---

## 3. File Changes

| File | Change type | Description |
|---|---|---|
| `src/ui/dashboard.py` | Modify | Add export panel to config-mode peer section (P1), add export panel to `_render_peer_table` (P1), add `pending_suggestions` session state (P2), modify `_add_peers_batch` to store suggestions (P2), add `_search_ticker_suggestions` function (P2), add `_render_suggestions_panel` function (P2) |
| `tests/test_dashboard_export.py` | Create | Unit tests for TSV generation, ticker list formatting, suggestion search wrapper |

**No other files require changes.** The yfinance.Search API is already available in the pinned version. No new dependencies.

---

## 4. Format Specifications

### TSV Config-Mode Peer Table

Header: `Ticker\tCompany Name\tIndex\tCountry\tMarket Cap (M)\tCurrency\tIndustry`

Per-row formatting:
- `Market Cap (M)`: `f"{(peer.get('market_cap') or 0) / 1e6:,.0f}"` — comma thousands separator, zero decimal, no currency symbol (currency in adjacent column)
- Missing values: `"—"` (em dash, consistent with report mode)
- All string values: stripped, no extra whitespace

### TSV Report-Mode Results Table

Header: `Ticker\tBeta (Adj)\tD/E Ratio\tRf (Local)%\tKe (Local)%\tUnlevered Beta\tStatus`

Per-row formatting:
- `Beta (Adj)`, `Unlevered Beta`: `f"{val:.4f}"` — 4 decimal places (matches existing report display)
- `D/E Ratio`: `f"{val:.3f}"`
- `Rf (Local)%`, `Ke (Local)%`: `f"{val*100:.2f}"` — percentage as number (e.g. `8.12`, not `8.12%`; column header carries the `%` suffix)
- Status: `"Eligible"` or `f"Excluded: {reason}"`
- Missing values: `"—"`

---

## 5. Testing Plan

### Test file: `tests/test_dashboard_export.py`

```
test_ticker_list_newline_separated          — verify \n joins, no trailing newline
test_tsv_config_header_row                  — verify exact header string
test_tsv_config_market_cap_formatting       — 1_500_000_000 → "1,500"
test_tsv_config_missing_fields_em_dash      — None market_cap → "—"
test_tsv_report_header_row                  — verify exact header string
test_tsv_report_percentage_as_number        — 0.0812 → "8.12"
test_search_suggestions_filters_non_equity  — mock yf.Search returning mixed quoteTypes
test_search_suggestions_caps_at_five        — mock returning 10 results → list len 5
test_search_suggestions_returns_empty_on_exception — mock yf.Search raising → []
test_search_suggestions_bare_ticker_only    — ticker with "." returns [] immediately
```

---

## 6. Scope Boundary

**In scope:**
- `st.code` export blocks with copy buttons (P1)
- `yf.Search`-based suggestion panel (P2)

**Out of scope:**
- HTML-formatted table copy for Word (requires JS clipboard with MIME types — deferred)
- CSV download button (the existing Excel workbook download already serves this need)
- Auto-suggest for tickers that already have a suffix but fail (D/E quality issue, not a UX issue)
- GICS auto-suggest integration with the suggestion panel (separate feature)
