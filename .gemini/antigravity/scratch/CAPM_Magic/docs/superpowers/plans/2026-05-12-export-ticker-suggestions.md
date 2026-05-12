# Phase 7: Peer Table Export + Ticker Suggestion Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add copy-friendly export blocks for the peer and results tables, and surface yfinance-powered suggestions when analysts type bare tickers without exchange suffixes.

**Architecture:** All changes live in `src/ui/dashboard.py`. Pure-function formatting helpers are added first (testable in isolation), then UI wiring, then the API-backed suggestion engine. A new `tests/test_dashboard_export.py` covers all new logic. No new dependencies — `yfinance.Search` is available in the pinned version (>=0.2.40).

**Tech Stack:** Python 3.12, Streamlit >= 1.36, yfinance >= 0.2.40, pytest + pytest-mock

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/ui/dashboard.py` | Modify | Add session state keys, helper functions, export panels, suggestion engine, resolution UI |
| `tests/test_dashboard_export.py` | Create | Unit tests for all new pure functions |

---

## Task 1: TDD — Export Format Helpers

Three pure functions that build the copyable strings. No Streamlit dependency; fully testable.

**Files:**
- Create: `tests/test_dashboard_export.py`
- Modify: `src/ui/dashboard.py` (add after line ~160, before `_load_modules`)

---

- [ ] **Step 1.1: Create the test file with all export helper tests**

Create `tests/test_dashboard_export.py`:

```python
"""Unit tests for dashboard export helper functions (D27)."""
from unittest.mock import MagicMock
import pytest

# Import helpers — they live at module level in dashboard.py
# Use importlib to avoid triggering st.set_page_config at import time
import importlib, sys, types

def _import_helpers():
    """Return the three helper functions without executing Streamlit page setup."""
    # Patch streamlit so set_page_config and session_state don't blow up on import
    st_mock = MagicMock()
    st_mock.session_state = {}
    sys.modules.setdefault("streamlit", st_mock)
    import src.ui.dashboard as dash
    return dash._build_ticker_list, dash._build_config_tsv, dash._build_results_tsv

_build_ticker_list, _build_config_tsv, _build_results_tsv = _import_helpers()


# ---------------------------------------------------------------------------
# _build_ticker_list
# ---------------------------------------------------------------------------

def test_ticker_list_basic():
    peers = [{"ticker": "SAP.DE"}, {"ticker": "ASML.AS"}, {"ticker": "SIE.DE"}]
    assert _build_ticker_list(peers) == "SAP.DE\nASML.AS\nSIE.DE"

def test_ticker_list_single():
    assert _build_ticker_list([{"ticker": "ENR.DE"}]) == "ENR.DE"

def test_ticker_list_empty():
    assert _build_ticker_list([]) == ""

def test_ticker_list_no_trailing_newline():
    result = _build_ticker_list([{"ticker": "A"}, {"ticker": "B"}])
    assert not result.endswith("\n")


# ---------------------------------------------------------------------------
# _build_config_tsv
# ---------------------------------------------------------------------------

_CONFIG_HEADER = "Ticker\tCompany Name\tIndex\tCountry\tMarket Cap (M)\tCurrency\tIndustry"

def test_config_tsv_header_only_when_empty():
    result = _build_config_tsv([])
    assert result == _CONFIG_HEADER

def test_config_tsv_header_row():
    peers = [{"ticker": "SAP.DE", "name": "SAP SE", "index_ticker": "^GDAXI",
              "country_code": "DE", "market_cap": 100_000_000, "currency": "EUR", "industry": "Software"}]
    lines = _build_config_tsv(peers).split("\n")
    assert lines[0] == _CONFIG_HEADER

def test_config_tsv_market_cap_formatting():
    peers = [{"ticker": "SAP.DE", "name": "SAP SE", "index_ticker": "^GDAXI",
              "country_code": "DE", "market_cap": 1_500_000_000, "currency": "EUR", "industry": "Software"}]
    row = _build_config_tsv(peers).split("\n")[1].split("\t")
    assert row[4] == "1,500"  # 1.5B / 1e6 = 1500, formatted with comma

def test_config_tsv_missing_market_cap_shows_em_dash():
    peers = [{"ticker": "X.DE", "name": "Co", "index_ticker": "", "country_code": "DE",
              "market_cap": None, "currency": "EUR", "industry": ""}]
    row = _build_config_tsv(peers).split("\n")[1].split("\t")
    assert row[4] == "—"

def test_config_tsv_missing_industry_shows_em_dash():
    peers = [{"ticker": "X.DE", "name": "Co", "index_ticker": "", "country_code": "DE",
              "market_cap": None, "currency": "EUR", "industry": None}]
    row = _build_config_tsv(peers).split("\n")[1].split("\t")
    assert row[6] == "—"

def test_config_tsv_columns_count():
    peers = [{"ticker": "SAP.DE", "name": "SAP SE", "index_ticker": "^GDAXI",
              "country_code": "DE", "market_cap": 0, "currency": "EUR", "industry": "SW"}]
    row = _build_config_tsv(peers).split("\n")[1].split("\t")
    assert len(row) == 7


# ---------------------------------------------------------------------------
# _build_results_tsv
# ---------------------------------------------------------------------------

_RESULTS_HEADER = "Ticker\tBeta (Adj)\tD/E Ratio\tRf (Local)%\tKe (Local)%\tUnlevered Beta\tStatus"

def _make_peer(ticker, beta=0.82, de=0.31, rf=0.024, ke=0.082, ub=0.65, eligible=True, reason="ok"):
    p = MagicMock()
    p.ticker = ticker
    p.eligibility.eligible = eligible
    p.eligibility.reason = reason
    p.beta.adjusted_beta = beta
    p.capital_structure.de_ratio = de
    p.rf = rf
    p.ke = ke
    p.unlevered_beta = ub
    return p

def test_results_tsv_header():
    lines = _build_results_tsv([]).split("\n")
    assert lines[0] == _RESULTS_HEADER

def test_results_tsv_beta_four_decimals():
    row = _build_results_tsv([_make_peer("SAP.DE", beta=0.8234)]).split("\n")[1].split("\t")
    assert row[1] == "0.8234"

def test_results_tsv_rf_percentage_no_symbol():
    # rf=0.0234 → "2.34" (no % sign — header carries it)
    row = _build_results_tsv([_make_peer("SAP.DE", rf=0.0234)]).split("\n")[1].split("\t")
    assert row[3] == "2.34"

def test_results_tsv_ke_percentage_no_symbol():
    row = _build_results_tsv([_make_peer("SAP.DE", ke=0.0812)]).split("\n")[1].split("\t")
    assert row[4] == "8.12"

def test_results_tsv_eligible_status():
    row = _build_results_tsv([_make_peer("SAP.DE", eligible=True)]).split("\n")[1].split("\t")
    assert row[6] == "Eligible"

def test_results_tsv_excluded_status():
    row = _build_results_tsv([_make_peer("BANK.DE", eligible=False, reason="financial_sector")]).split("\n")[1].split("\t")
    assert row[6] == "Excluded: financial_sector"

def test_results_tsv_none_values_em_dash():
    p = MagicMock()
    p.ticker = "X.DE"
    p.eligibility.eligible = False
    p.eligibility.reason = "missing_data"
    p.beta = None
    p.capital_structure = None
    p.rf = None
    p.ke = None
    p.unlevered_beta = None
    row = _build_results_tsv([p]).split("\n")[1].split("\t")
    assert row[1] == "—"
    assert row[2] == "—"
    assert row[5] == "—"

def test_results_tsv_columns_count():
    row = _build_results_tsv([_make_peer("SAP.DE")]).split("\n")[1].split("\t")
    assert len(row) == 7
```

- [ ] **Step 1.2: Run tests — verify they all FAIL (functions not yet defined)**

```bash
cd C:\Users\nikla\.gemini\antigravity\scratch\CAPM_Magic
python -m pytest tests/test_dashboard_export.py -v 2>&1 | head -40
```

Expected: `ImportError` or `AttributeError` because `_build_ticker_list` doesn't exist yet.

- [ ] **Step 1.3: Add the three helper functions to `dashboard.py`**

In `src/ui/dashboard.py`, find the line `def _load_modules() -> dict:` (currently around line 165). Insert the following block **immediately before** that line:

```python
# ---------------------------------------------------------------------------
# Export format helpers (D27)
# ---------------------------------------------------------------------------

def _build_ticker_list(peers: list[dict]) -> str:
    """Newline-separated ticker list for Bloomberg/Excel column/Word list paste."""
    return "\n".join(p["ticker"] for p in peers)


def _build_config_tsv(peers: list[dict]) -> str:
    """Tab-separated peer enrichment table. Paste directly into Excel."""
    header = "Ticker\tCompany Name\tIndex\tCountry\tMarket Cap (M)\tCurrency\tIndustry"
    rows = [header]
    for p in peers:
        mcap = p.get("market_cap")
        mcap_str = f"{mcap / 1e6:,.0f}" if mcap else "—"
        rows.append("\t".join([
            p.get("ticker") or "—",
            p.get("name") or "—",
            p.get("index_ticker") or "—",
            p.get("country_code") or "—",
            mcap_str,
            p.get("currency") or "—",
            p.get("industry") or "—",
        ]))
    return "\n".join(rows)


def _build_results_tsv(peers: list) -> str:
    """Tab-separated peer results table (beta/Ke). Paste directly into Excel."""
    header = "Ticker\tBeta (Adj)\tD/E Ratio\tRf (Local)%\tKe (Local)%\tUnlevered Beta\tStatus"
    rows = [header]
    for p in sorted(peers, key=lambda x: (not x.eligibility.eligible, x.ticker)):
        beta_l = p.beta.adjusted_beta if p.beta else None
        de = p.capital_structure.de_ratio if p.capital_structure else None
        rows.append("\t".join([
            p.ticker,
            f"{beta_l:.4f}" if beta_l is not None else "—",
            f"{de:.3f}" if de is not None else "—",
            f"{p.rf * 100:.2f}" if p.rf is not None else "—",
            f"{p.ke * 100:.2f}" if p.ke is not None else "—",
            f"{p.unlevered_beta:.4f}" if p.unlevered_beta is not None else "—",
            "Eligible" if p.eligibility.eligible else f"Excluded: {p.eligibility.reason}",
        ]))
    return "\n".join(rows)

```

- [ ] **Step 1.4: Run tests — verify they all PASS**

```bash
python -m pytest tests/test_dashboard_export.py -v
```

Expected: All 20 tests pass.

- [ ] **Step 1.5: Run full suite to confirm no regressions**

```bash
python -m pytest tests/ -q
```

Expected: 226 existing + 20 new = 246 passed, 0 failed.

- [ ] **Step 1.6: Commit**

```bash
git add tests/test_dashboard_export.py src/ui/dashboard.py
git commit -m "feat: add export format helpers _build_ticker_list/_build_config_tsv/_build_results_tsv (D27)"
```

---

## Task 2: Export UI — Session State + Panels

Wire the three helpers into the Streamlit UI. Two new export panels: one in config mode below the peer table, one in report mode below the peer detail breakdown.

**Files:**
- Modify: `src/ui/dashboard.py`

---

- [ ] **Step 2.1: Add three session state toggle bools**

In `dashboard.py`, find the session state initialisation block (starts around line 40, ends around line 68). Add these three lines at the end of that block, before the `# ---------------------------------------------------------------------------` separator:

```python
# D27 — Export panel visibility toggles
if "show_ticker_export" not in st.session_state:
    st.session_state["show_ticker_export"] = False
if "show_table_export" not in st.session_state:
    st.session_state["show_table_export"] = False
if "show_results_export" not in st.session_state:
    st.session_state["show_results_export"] = False
```

- [ ] **Step 2.2: Add the config-mode export panel**

In `render_config_mode()`, find the block that renders when `peer_data` is non-empty — specifically the section that ends with the force-include checkbox block (around line 368). After that entire peer rendering `for` loop and its force-include block, but **before** the `# ── 03 Methodology Preset` section marker, insert:

```python
    # ── D27: Export panel ──────────────────────────────────────────────────
    if st.session_state["peer_data"]:
        exp_col1, exp_col2 = st.columns([1, 1])
        with exp_col1:
            if st.button(
                "COPY TICKERS" if not st.session_state["show_ticker_export"] else "▲ HIDE TICKERS",
                key="toggle_ticker_export", use_container_width=True, type="secondary"
            ):
                st.session_state["show_ticker_export"] = not st.session_state["show_ticker_export"]
                st.session_state["show_table_export"] = False
                st.rerun()
        with exp_col2:
            if st.button(
                "COPY PEER TABLE (Excel/TSV)" if not st.session_state["show_table_export"] else "▲ HIDE TABLE",
                key="toggle_table_export", use_container_width=True, type="secondary"
            ):
                st.session_state["show_table_export"] = not st.session_state["show_table_export"]
                st.session_state["show_ticker_export"] = False
                st.rerun()

        if st.session_state["show_ticker_export"]:
            st.code(_build_ticker_list(st.session_state["peer_data"]), language=None)
            st.caption("Paste into Excel → single column A. Paste into Word → paragraphs; apply 'List Bullet' to convert to a list.")

        if st.session_state["show_table_export"]:
            st.code(_build_config_tsv(st.session_state["peer_data"]), language=None)
            st.caption("Excel: Ctrl+V into any cell — columns auto-fill. Word/PPT: paste into Excel first, select range, copy, paste into Word/PPT as table.")

```

- [ ] **Step 2.3: Add the report-mode export panel**

In `render_report_mode()`, find the call to `_render_peer_table(result)` (around line 1053). Immediately after that line, insert:

```python
    # ── D27: Results table export ──────────────────────────────────────────
    if st.button(
        "COPY RESULTS TABLE (Excel/TSV)" if not st.session_state["show_results_export"] else "▲ HIDE RESULTS TABLE",
        key="toggle_results_export", type="secondary"
    ):
        st.session_state["show_results_export"] = not st.session_state["show_results_export"]
        st.rerun()
    if st.session_state["show_results_export"]:
        st.code(_build_results_tsv(result.peers), language=None)
        st.caption("Excel: Ctrl+V into any cell. Word/PPT: paste into Excel first, select range, copy, paste as table.")

```

- [ ] **Step 2.4: Manual smoke test — start the app and verify**

```bash
streamlit run src/ui/dashboard.py
```

1. Add 2–3 tickers (e.g. `SAP.DE, ASML.AS`)
2. Click **COPY TICKERS** → amber code block appears with tickers on separate lines, copy icon top-right
3. Click copy icon → paste into Notepad — verify newline-separated
4. Click **COPY PEER TABLE** → tickers export collapses, TSV block appears with header row
5. Copy and paste into Excel → verify columns align correctly
6. Run analysis → switch to Report mode → click **COPY RESULTS TABLE** → TSV with beta/Ke data appears
7. Close the server (Ctrl+C)

- [ ] **Step 2.5: Run full test suite**

```bash
python -m pytest tests/ -q
```

Expected: 246 passed, 0 failed.

- [ ] **Step 2.6: Commit**

```bash
git add src/ui/dashboard.py
git commit -m "feat: add peer table export panels in config and report modes (D27)"
```

---

## Task 3: TDD — Ticker Suggestion Search Wrapper

The pure-function wrapper for `yf.Search` — no Streamlit, fully testable with mocks.

**Files:**
- Modify: `tests/test_dashboard_export.py` (append new tests)
- Modify: `src/ui/dashboard.py` (add `_search_ticker_suggestions`)

---

- [ ] **Step 3.1: Append suggestion engine tests to the test file**

Open `tests/test_dashboard_export.py` and append at the bottom:

```python
# ---------------------------------------------------------------------------
# _search_ticker_suggestions (D28)
# ---------------------------------------------------------------------------

def _import_search_helper():
    import src.ui.dashboard as dash
    return dash._search_ticker_suggestions

_search_ticker_suggestions = _import_search_helper()


def test_search_suggestions_returns_empty_for_dotted_ticker():
    # Tickers with "." already have a suffix — skip search immediately
    result = _search_ticker_suggestions("SAP.DE")
    assert result == []


def test_search_suggestions_filters_non_equity(monkeypatch):
    mock_quotes = [
        {"symbol": "ABBN.SW", "shortname": "ABB Ltd", "exchange": "EBS", "quoteType": "EQUITY"},
        {"symbol": "ABBN-ETF.DE", "shortname": "Some ETF", "exchange": "GER", "quoteType": "ETF"},
        {"symbol": "ABBN-IDX", "shortname": "Index", "exchange": "IDX", "quoteType": "INDEX"},
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("ABBN")
    assert len(result) == 1
    assert result[0]["symbol"] == "ABBN.SW"


def test_search_suggestions_caps_at_five(monkeypatch):
    mock_quotes = [
        {"symbol": f"CO{i}.DE", "shortname": f"Company {i}", "exchange": "GER", "quoteType": "EQUITY"}
        for i in range(10)
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("CO")
    assert len(result) == 5


def test_search_suggestions_returns_empty_on_exception(monkeypatch):
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", MagicMock(side_effect=Exception("network error")))
    result = _search_ticker_suggestions("ABBN")
    assert result == []


def test_search_suggestions_result_shape(monkeypatch):
    mock_quotes = [
        {"symbol": "ABBN.SW", "shortname": "ABB Ltd", "exchange": "EBS", "quoteType": "EQUITY"},
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("ABBN")
    assert result[0] == {"symbol": "ABBN.SW", "shortname": "ABB Ltd", "exchange": "EBS"}


def test_search_suggestions_handles_missing_shortname(monkeypatch):
    mock_quotes = [
        {"symbol": "ABBN.SW", "longname": "ABB Ltd Long", "exchange": "EBS", "quoteType": "EQUITY"},
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("ABBN")
    assert result[0]["shortname"] == "ABB Ltd Long"


def test_search_suggestions_skips_entries_without_symbol(monkeypatch):
    mock_quotes = [
        {"symbol": "", "shortname": "Ghost", "exchange": "GER", "quoteType": "EQUITY"},
        {"symbol": "REAL.DE", "shortname": "Real Co", "exchange": "GER", "quoteType": "EQUITY"},
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("REAL")
    assert len(result) == 1
    assert result[0]["symbol"] == "REAL.DE"
```

- [ ] **Step 3.2: Run new tests — verify they FAIL**

```bash
python -m pytest tests/test_dashboard_export.py -k "search" -v
```

Expected: `AttributeError: module 'src.ui.dashboard' has no attribute '_search_ticker_suggestions'`

- [ ] **Step 3.3: Add `_search_ticker_suggestions` to `dashboard.py`**

In `src/ui/dashboard.py`, find the export helpers block added in Task 1 (the three `_build_*` functions). Add this function immediately after `_build_results_tsv`:

```python
def _search_ticker_suggestions(bare_ticker: str) -> list[dict]:
    """
    Returns up to 5 equity suggestions from yfinance.Search for bare tickers.
    
    Only called when the ticker has no '.' suffix and direct enrichment failed.
    Never raises — returns [] on any error.
    """
    if "." in bare_ticker:
        return []
    try:
        import yfinance as yf
        results = yf.Search(bare_ticker, news_count=0).quotes
        equities = [
            {
                "symbol": r.get("symbol", ""),
                "shortname": r.get("shortname") or r.get("longname") or "",
                "exchange": r.get("exchange", ""),
            }
            for r in results
            if r.get("quoteType", "").upper() == "EQUITY" and r.get("symbol")
        ]
        return equities[:5]
    except Exception:
        return []
```

- [ ] **Step 3.4: Run new tests — verify they PASS**

```bash
python -m pytest tests/test_dashboard_export.py -k "search" -v
```

Expected: 7 tests pass.

- [ ] **Step 3.5: Run full suite**

```bash
python -m pytest tests/ -q
```

Expected: 253 passed, 0 failed.

- [ ] **Step 3.6: Commit**

```bash
git add tests/test_dashboard_export.py src/ui/dashboard.py
git commit -m "feat: add _search_ticker_suggestions yfinance.Search wrapper (D28)"
```

---

## Task 4: Suggestion UI — Session State + _add_peers_batch + Resolution Panel

Wire the search wrapper into the batch fetch flow and render the resolution panel.

**Files:**
- Modify: `src/ui/dashboard.py`

---

- [ ] **Step 4.1: Add `pending_suggestions` to session state initialisation**

In the session state block (top of `dashboard.py`, around line 40–70), in the same area where the D27 toggles were added in Task 2, add:

```python
# D28 — Ticker suggestion engine
if "pending_suggestions" not in st.session_state:
    st.session_state["pending_suggestions"] = {}
```

- [ ] **Step 4.2: Modify `_add_peers_batch` to route failed bare tickers to suggestions**

Find `_add_peers_batch` (around line 633). Inside the results-processing loop, find this exact block:

```python
    for i, future in enumerate(futures):
        res = future.result()
        if res["success"]:
            results.append(res)
        else:
            logger.warning(f"Failed to fetch {res['ticker']}: {res['error']}")
        bar.progress((i + 1) / len(new_tickers), text=f"Processed {res['ticker']}...")
```

Replace it with:

```python
    for i, future in enumerate(futures):
        res = future.result()
        if res["success"]:
            results.append(res)
        else:
            logger.warning(f"Failed to fetch {res['ticker']}: {res['error']}")
            t = res["ticker"]
            if "." not in t:
                suggestions = _search_ticker_suggestions(t)
                st.session_state["pending_suggestions"][t] = suggestions
        bar.progress((i + 1) / len(new_tickers), text=f"Processed {res['ticker']}...")
```

- [ ] **Step 4.3: Add the `_render_suggestions_panel` function**

In `src/ui/dashboard.py`, find the export helpers block (the `_build_*` and `_search_ticker_suggestions` functions added in Tasks 1 and 3). Add this function immediately after `_search_ticker_suggestions`:

```python
def _render_suggestions_panel():
    """
    Renders the amber resolution panel for tickers that failed direct enrichment
    and have yfinance.Search suggestions pending analyst confirmation (D28).
    """
    pending = st.session_state.get("pending_suggestions", {})
    if not pending:
        return

    st.markdown(
        '<div style="border-left:3px solid #FFB000; padding-left:0.75rem; margin-bottom:0.75rem;">'
        '<span style="color:#FFB000; font-family:monospace; font-size:0.8rem; letter-spacing:0.05em;">'
        '⚠ RESOLVE UNRECOGNIZED TICKERS</span></div>',
        unsafe_allow_html=True,
    )

    to_remove: list[str] = []
    confirmed_map: dict[str, str] = {}  # orig_ticker → confirmed_symbol

    for ticker, suggestions in list(pending.items()):
        if not suggestions:
            st.markdown(
                f'<span style="color:#FF6B6B; font-family:monospace; font-size:0.78rem;">'
                f'{ticker} — not recognized. No suggestions found. '
                f'Verify exchange suffix (e.g. .DE, .SW, .ST, .PA, .L).</span>',
                unsafe_allow_html=True,
            )
            if st.button("✕ Dismiss", key=f"dismiss_ns_{ticker}"):
                to_remove.append(ticker)
            continue

        st.markdown(
            f'<span style="color:#FFB000; font-family:monospace; font-size:0.78rem;">'
            f'{ticker} — not recognized. Did you mean:</span>',
            unsafe_allow_html=True,
        )
        n = min(len(suggestions), 5)
        btn_cols = st.columns([2] * n + [1])
        for j, sugg in enumerate(suggestions[:5]):
            label = f"{sugg['symbol']} · {(sugg.get('shortname') or '')[:18]} · {sugg.get('exchange', '')}"
            if btn_cols[j].button(label, key=f"sugg_{ticker}_{j}", use_container_width=True):
                confirmed_map[ticker] = sugg["symbol"]
                to_remove.append(ticker)
        if btn_cols[-1].button("Dismiss", key=f"dismiss_{ticker}", use_container_width=True):
            if ticker not in to_remove:
                to_remove.append(ticker)

    # Enrich and add confirmed tickers
    if confirmed_map:
        from src.data.providers.yfinance_provider import YFinancePriceProvider
        provider = YFinancePriceProvider()
        existing = {p["ticker"] for p in st.session_state["peer_data"]}
        for orig_ticker, confirmed_symbol in confirmed_map.items():
            if confirmed_symbol in existing:
                continue
            try:
                info = provider.fetch_ticker_info(confirmed_symbol)
                meta = detect_peer_metadata(info, confirmed_symbol)
                st.session_state["peer_data"].append({
                    "ticker": confirmed_symbol,
                    "name": info.get("long_name") or info.get("short_name") or confirmed_symbol,
                    "index_ticker": meta["index_ticker"],
                    "index_name": meta["index_name"],
                    "country_code": meta["country_code"],
                    "market_cap": info.get("market_cap"),
                    "industry": info.get("gics_industry"),
                    "currency": info.get("currency"),
                })
            except Exception as exc:
                st.error(f"Failed to enrich {confirmed_symbol}: {exc}")
                if orig_ticker in to_remove:
                    to_remove.remove(orig_ticker)

    for t in to_remove:
        st.session_state["pending_suggestions"].pop(t, None)

    if to_remove or confirmed_map:
        st.rerun()
```

- [ ] **Step 4.4: Call `_render_suggestions_panel()` in `render_config_mode`**

In `render_config_mode()`, find the peer section — specifically the block that checks `if not st.session_state["peer_data"]:` (around line 320). Insert the call to `_render_suggestions_panel()` **immediately before** that `if not st.session_state["peer_data"]:` check:

```python
    _render_suggestions_panel()

    if not st.session_state["peer_data"]:
        st.markdown(...)  # existing empty-state message
```

- [ ] **Step 4.5: Manual smoke test — verify suggestions flow**

```bash
streamlit run src/ui/dashboard.py
```

1. In the "Add Ticker(s)" field, type `ABBN` (no suffix) and click **ADD & ENRICH**
2. Expect: amber "RESOLVE UNRECOGNIZED TICKERS" panel appears above the peer table
3. Panel should show: `ABBN — not recognized. Did you mean:` with suggestion buttons including `ABBN.SW · ABB Ltd · EBS`
4. Click the `ABBN.SW` suggestion → peer enriches and appears in the table; panel disappears
5. Type `FAKEXYZ999` and click **ADD & ENRICH** → panel shows red "No suggestions found" message
6. Click **✕ Dismiss** → panel entry disappears
7. Type `SIE.DE` directly → enriches normally (no suggestion panel shown)
8. Close the server.

- [ ] **Step 4.6: Run full test suite**

```bash
python -m pytest tests/ -q
```

Expected: 253 passed, 0 failed.

- [ ] **Step 4.7: Commit**

```bash
git add src/ui/dashboard.py
git commit -m "feat: add ticker suggestion engine — yf.Search panel with manual confirmation (D28)"
```

---

## Task 5: Update Vibe Files and Final Verification

- [ ] **Step 5.1: Update TODO.md — mark all Phase 7 tasks COMPLETE**

In `.vibe/TODO.md`, change every `PENDING` status in Phase 7A and Phase 7B to `COMPLETE`. Update the Session Log to record today's session.

Add to the Session Log table:
```
| 2026-05-12 | Phase 7 Implementation | D27 export panels (COPY TICKERS, COPY PEER TABLE, COPY RESULTS TABLE) + D28 ticker suggestion engine (yf.Search, resolution panel, no auto-select). 253/253 tests passing. |
```

- [ ] **Step 5.2: Final full test run**

```bash
python -m pytest tests/ -v --tb=short 2>&1 | tail -20
```

Expected: `253 passed` in the summary line.

- [ ] **Step 5.3: Final commit**

```bash
git add .vibe/TODO.md
git commit -m "docs: mark Phase 7 tasks complete — 253 tests passing"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| COPY TICKERS button → newline-separated `st.code` | Task 2, Step 2.2 |
| COPY PEER TABLE button → TSV with 7 headers | Task 1 + Task 2, Step 2.2 |
| COPY RESULTS TABLE button in report mode | Task 2, Step 2.3 |
| Word/PPT caption under TSV | Task 2, Steps 2.2, 2.3 |
| Toggle visibility (buttons collapse on second click) | Task 2, Step 2.2 |
| `_search_ticker_suggestions` wraps yf.Search | Task 3 |
| Filter to EQUITY, cap at 5 | Task 3, Step 3.3 |
| Never raises | Task 3, Step 3.3 |
| Bare ticker without `.` triggers suggestion | Task 4, Step 4.2 |
| Tickers with `.` that fail → not a suggestion case | Task 3 (function returns [] immediately) |
| `pending_suggestions` session state dict | Task 4, Step 4.1 |
| Amber resolution panel above peer table | Task 4, Steps 4.3, 4.4 |
| Suggestion buttons with symbol/name/exchange | Task 4, Step 4.3 |
| Dismiss button | Task 4, Step 4.3 |
| Confirming suggestion calls `_fetch_one` logic | Task 4, Step 4.3 (`_render_suggestions_panel` enriches via `provider.fetch_ticker_info`) |
| Zero results → amber warning | Task 4, Step 4.3 |
| Never auto-select | Architecture: suggestions only stored, never applied without button click |
| Test: TSV header rows | Task 1, tests `test_config_tsv_header_row`, `test_results_tsv_header` |
| Test: market cap formatting | Task 1, `test_config_tsv_market_cap_formatting` |
| Test: missing values → em dash | Task 1, `test_config_tsv_missing_market_cap_shows_em_dash`, `test_results_tsv_none_values_em_dash` |
| Test: suggestion filtering | Task 3, `test_search_suggestions_filters_non_equity` |
| Test: cap at 5 | Task 3, `test_search_suggestions_caps_at_five` |
| Test: exception safety | Task 3, `test_search_suggestions_returns_empty_on_exception` |

**No gaps found.**

**Placeholder scan:** No TBD, TODO, or incomplete steps found.

**Type consistency:** `_build_ticker_list(peers: list[dict])`, `_build_config_tsv(peers: list[dict])`, `_build_results_tsv(peers: list)` — consistent across Task 1 definitions and Task 2 call sites. `_search_ticker_suggestions(bare_ticker: str) -> list[dict]` — consistent across Task 3 definition and Task 4 call site. `_render_suggestions_panel()` — defined in Task 4, called in Task 4. All consistent.
