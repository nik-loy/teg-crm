# CAPM Magic — TODO Tracker

> **Last Updated:** 2026-05-12
> **Session Protocol:** Read PRIMER.md → find first `PENDING` task below → implement → mark `COMPLETE`
> **Legend:** `PENDING` | `WORKING` | `COMPLETE` | `BLOCKED`

---

## ⚡ CURRENT STATUS

**ALL PHASES COMPLETE (0–6). 226 tests passing.**
**Last verified:** 2026-05-10 — `python -m pytest tests/ -q` → 226 passed in 2.71s.
**Phase 6 delivered:** WACC engine (D21) + CAPM-Tax toggle (D22) + Fernandez unleveraging (D23) + dynamic sensitivity bounds (D24) + peer robustness + InsufficientPeersError (D25) + full audit trail hardening (D26).

---

## Phase 0: Project Skeleton — `COMPLETE`

| # | Task | File | Status |
|---|------|------|--------|
| 0.1 | Create `.vibe/` infrastructure | `.vibe/*.md` | `COMPLETE` |
| 0.2 | Create directory structure | all dirs | `COMPLETE` |
| 0.3 | `requirements.txt` | `requirements.txt` | `COMPLETE` |
| 0.4 | `config/methodology.yaml` | `config/methodology.yaml` | `COMPLETE` |
| 0.5 | `config/gics_peers.yaml` | `config/gics_peers.yaml` | `COMPLETE` |
| 0.6a | `src/domain/audit.py` | `src/domain/audit.py` | `COMPLETE` |
| 0.6b | `src/domain/methodology.py` + Pydantic bug fix | `src/domain/methodology.py` | `COMPLETE` |
| 0.6c | `src/domain/market_data.py` | `src/domain/market_data.py` | `COMPLETE` |
| 0.6d | `src/domain/results.py` | `src/domain/results.py` | `COMPLETE` |
| 0.6e | `src/domain/subject.py` | `src/domain/subject.py` | `COMPLETE` |
| 0.7 | `.gitignore` | `.gitignore` | `COMPLETE` |
| 0.8 | `.env.example` | `.env.example` | `COMPLETE` |
| 0.9 | `run.py` one-command launcher | `run.py` | `COMPLETE` |

---

## Phase 0.5: UI Dual-Mode Redesign — `COMPLETE`

| # | Task | File | Status |
|---|------|------|--------|
| U.1 | `.streamlit/config.toml` — dark base theme | `.streamlit/config.toml` | `COMPLETE` |
| U.2 | `src/ui/styles.py` — CONFIG_MODE_CSS + REPORT_MODE_CSS | `src/ui/styles.py` | `COMPLETE` |
| U.3 | Full dashboard rewrite — two-vibe state machine | `src/ui/dashboard.py` | `COMPLETE` |
| U.4 | Peer-centric refactor: Remove Subject section | `src/ui/dashboard.py` | `COMPLETE` |
| U.5 | Unified Valuation Table with editable index | `src/ui/dashboard.py` | `COMPLETE` |
| U.6 | Bulk Ticker Entry (RegEx parser + Parallel fetch) | `src/ui/dashboard.py` | `COMPLETE` |

---

## Phase 1: Data Layer — `COMPLETE`

| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | `PriceProvider` ABC | `src/data/providers/base.py` | `COMPLETE` |
| 1.2 | yfinance implementation | `src/data/providers/yfinance_provider.py` | `COMPLETE` |
| 1.3 | Fetcher + parquet cache | `src/data/fetcher.py` | `COMPLETE` |
| 1.4 | Cleaner (adj-close, log returns, gap-fill) | `src/data/cleaner.py` | `COMPLETE` |
| 1.5 | Effective tax rate + D/E auto-fetch | `src/data/financials.py` | `COMPLETE` |
| 1.6 | FRED API client (German Bund fallback Rf) | `src/data/market_rates.py` | `COMPLETE` |
| 1.7 | Bundesbank Svensson params API | `src/data/bundesbank.py` | `COMPLETE` |
| 1.8 | Damodaran ERP download + parse | `src/data/damodaran.py` | `COMPLETE` |
| 1.9 | GICS peer auto-suggestion | `src/data/peers.py` | `COMPLETE` |
| 1.10 | Unit tests: financials (mock yfinance) | `tests/test_financials.py` | `COMPLETE` |
| 1.11 | Unit tests: FRED + Bundesbank (mock requests) | `tests/test_market_rates.py` | `COMPLETE` |
| 1.12 | US Treasury Rf provider | `src/data/providers/rf_fred_us.py` | `COMPLETE` |
| 1.13 | Bank of England Rf provider | `src/data/providers/rf_boe.py` | `COMPLETE` |
| 1.14 | ECB SDW Rf provider (FR/IT/ES/NL/IE) | `src/data/providers/rf_ecb_sdw.py` | `COMPLETE` |
| 1.15 | FRED fallback provider | `src/data/providers/rf_fred_fallback.py` | `COMPLETE` |

---

## Phase 2: Engine Core — `COMPLETE`

| # | Task | File | Status |
|---|------|------|--------|
| 2.1 | Svensson yield curve formula | `src/engine/svensson.py` | `COMPLETE` |
| 2.2 | `get_rf_idw()` — long-run Rf (IDW S1) | `src/engine/svensson.py` | `COMPLETE` |
| 2.3 | OLS beta regression (scipy.stats) | `src/engine/beta.py` | `COMPLETE` |
| 2.4 | Blume adjustment | `src/engine/beta.py` | `COMPLETE` |
| 2.5 | Hamada unlever formula | `src/engine/hamada.py` | `COMPLETE` |
| 2.6 | Hamada relever formula | `src/engine/hamada.py` | `COMPLETE` |
| 2.7 | Peer beta aggregation (median β_u) | `src/engine/capm.py` | `COMPLETE` |
| 2.8 | Final Ke calculation | `src/engine/capm.py` | `COMPLETE` |
| 2.10 | Unit test: Svensson at known maturities | `tests/test_svensson.py` | `COMPLETE` |
| 2.11 | Unit test: Hamada algebraic identity | `tests/test_hamada.py` | `COMPLETE` |
| 2.12 | Unit test: Blume formula | `tests/test_beta.py` | `COMPLETE` |
| 2.13 | Integration test: full pipeline (mocked data) | `tests/test_pipeline.py` | `COMPLETE` |

---

## Phase 3: GICS Peer Database — `COMPLETE`

| # | Task | File | Status |
|---|------|------|--------|
| 3.1 | Energy sector peers | `config/gics_peers.yaml` | `COMPLETE` |
| 3.2 | Industrials sector peers | `config/gics_peers.yaml` | `COMPLETE` |
| 3.3 | Utilities sector peers | `config/gics_peers.yaml` | `COMPLETE` |
| 3.4 | Peer liquidity filter (avg volume) | `src/data/peers.py` | `COMPLETE` |
| 3.5 | `get_gics_peers()` function | `src/data/peers.py` | `COMPLETE` |

---

## Phase 4: Excel Workbook Generator — `COMPLETE`

| # | Task | File | Status |
|---|------|------|--------|
| 4.1 | Workbook scaffolding (7 sheets) | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.2 | Sheet 1: Cover page | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.3 | Sheet 2: CAPM Build-Up waterfall | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.4 | Sheet 3: Beta Regression + scatter chart | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.5 | Sheet 4: Peer Group Analysis table | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.6 | Sheet 5: Sensitivity Analysis heat map | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.7 | Sheet 6: Raw price data (audit source) | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.8 | Sheet 7: Methodology & Sources table | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.9 | PwC-style formatting (fonts, colors, borders) | `src/reports/excel_builder.py` | `COMPLETE` |
| 4.10 | `build_workbook()` returns bytes | `src/reports/excel_builder.py` | `COMPLETE` |

---

## Phase 5: Hardening — `COMPLETE`

| # | Task | File | Status |
|---|------|------|--------|
| 5.1 | End-to-end test: ENR.DE (Siemens Energy) | `tests/test_e2e.py` | `COMPLETE` |
| 5.2 | Bundesbank API fallback → FRED with warning | `src/data/bundesbank.py` | `COMPLETE` |
| 5.3 | Error handling: delisted tickers, API timeouts | multiple | `COMPLETE` |
| 5.4 | `README.md` with run instructions | `README.md` | `COMPLETE` |
| 5.5 | Parquet cache for price data (perf) | `src/data/fetcher.py` | `COMPLETE` |

---

---

## Phase 6A: Critical Bug Fixes — `COMPLETE`

| # | Task | File | Status | Decision |
|---|------|------|--------|----------|
| 6A.1 | Dynamic sensitivity bounds — replace hardcoded ERP/beta arrays | `src/reports/excel_builder.py` | `COMPLETE` | D24 |
| 6A.2 | `InsufficientPeersError` — require ≥2 eligible peers | `src/engine/capm.py` | `COMPLETE` | D25 |
| 6A.3 | Force-include UI — checkbox + mandatory justification per peer | `src/ui/dashboard.py` | `COMPLETE` | D25 |
| 6A.4 | Hamada denominator guard — assert `(1+(1-T)×D/E) > 0.001` | `src/engine/unlevering.py` | `COMPLETE` | D26 |
| 6A.5 | Sensitivity bounds test — parametrize over ERP 4%, 7%, 8.5% | `tests/test_excel.py` | `COMPLETE` | D24 |
| 6A.6 | Peer robustness tests — all-financial, single-peer, force-include | `tests/test_pipeline.py` | `COMPLETE` | D25 |

---

## Phase 6B: WACC Module — `COMPLETE`

| # | Task | File | Status | Decision |
|---|------|------|--------|----------|
| 6B.1 | `WACCResult` Pydantic model | `src/domain/results.py` | `COMPLETE` | D21 |
| 6B.2 | Kd fields on `MethodologyConfig` (`kd_method`, `kd_manual_value`, `kd_credit_rating`) | `src/domain/methodology.py` | `COMPLETE` | D21 |
| 6B.3 | `src/data/damodaran_spreads.py` — Damodaran default spread table by credit rating | `src/data/damodaran_spreads.py` | `COMPLETE` | D21 |
| 6B.4 | `src/engine/kd.py` — statement_based, ytm_spread, manual Kd + `compute_kd()` | `src/engine/kd.py` | `COMPLETE` | D21 |
| 6B.5 | `compute_wacc()` in capm.py — calls compute_kd + WACC formula | `src/engine/capm.py` | `COMPLETE` | D21 |
| 6B.6 | Kd flags (kd < rf, debt weight > 80%) written to AuditLedger | `src/engine/kd.py`, `src/engine/capm.py` | `COMPLETE` | D26 |
| 6B.7 | Excel Sheet 8 "8 WACC Waterfall" — E/V, D/V, Ke, Kd pre/post-tax, WACC | `src/reports/excel_builder.py` | `COMPLETE` | D21 |
| 6B.8 | UI — Kd config section in config mode; WACC hero KPI in report mode | `src/ui/dashboard.py` | `COMPLETE` | D21 |
| 6B.9 | Update `config/methodology.yaml` — add Kd fields to all three presets | `config/methodology.yaml` | `COMPLETE` | D21 |
| 6B.10 | `tests/test_kd.py` — unit tests for both Kd methods + WACC aggregation formula | `tests/test_kd.py` | `COMPLETE` | D21 |
| 6B.11 | Integration test — ENR.DE full WACC run (verify WACC < Ke) | `tests/test_pipeline.py` | `COMPLETE` | D21 |

---

## Phase 6C: CAPM-Tax Toggle — `COMPLETE`

| # | Task | File | Status | Decision |
|---|------|------|--------|----------|
| 6C.1 | Add `capm_tax_enabled`, `abgeltungsteuer_rate`, `capm_tax_for_wacc` to `MethodologyConfig` | `src/domain/methodology.py` | `COMPLETE` | D22 |
| 6C.2 | `compute_ke_tax(rf, beta, erp, s_z)` function | `src/engine/capm.py` | `COMPLETE` | D22 |
| 6C.3 | Update `CAPMResult` to carry `ke_tax: float | None` | `src/domain/results.py` | `COMPLETE` | D22 |
| 6C.4 | Excel Sheet 2 — add CAPM-Tax row when enabled; show both Ke variants | `src/reports/excel_builder.py` | `COMPLETE` | D22 |
| 6C.5 | Excel Sheet 7 — disclaimer when disabled; note when enabled | `src/reports/excel_builder.py` | `COMPLETE` | D22 |
| 6C.6 | UI config toggle + report hero shows both Ke values when enabled | `src/ui/dashboard.py` | `COMPLETE` | D22 |
| 6C.7 | `tests/test_capm_tax.py` — verify Ke_tax < Ke_standard; boundary at s_z=0; s_z=1 | `tests/test_capm_tax.py` | `COMPLETE` | D22 |
| 6C.8 | Update `config/methodology.yaml` — add CAPM-Tax fields | `config/methodology.yaml` | `COMPLETE` | D22 |

---

## Phase 6D: Fernandez Unleveraging — `COMPLETE`

| # | Task | File | Status | Decision |
|---|------|------|--------|----------|
| 6D.1 | Rename `src/engine/hamada.py` → `src/engine/unlevering.py`; update all imports | multiple | `COMPLETE` | D23 |
| 6D.2 | Add `unlever_fernandez()` and `relever_fernandez()` to `unlevering.py` | `src/engine/unlevering.py` | `COMPLETE` | D23 |
| 6D.3 | Add `beta_debt: float = 0.0` field to `MethodologyConfig` | `src/domain/methodology.py` | `COMPLETE` | D23 |
| 6D.4 | Router in `capm.py` — dispatch to Hamada or Fernandez based on `methodology.unlever_formula` | `src/engine/capm.py` | `COMPLETE` | D23 |
| 6D.5 | Excel Sheet 3 — show which formula used per peer; Fernandez β_d flag if 0.0 | `src/reports/excel_builder.py` | `COMPLETE` | D23 |
| 6D.6 | UI — show `beta_debt` input when Fernandez selected | `src/ui/dashboard.py` | `COMPLETE` | D23 |
| 6D.7 | `tests/test_unlevering.py` — Hamada algebraic identity + Fernandez known numeric examples | `tests/test_unlevering.py` | `COMPLETE` | D23 |
| 6D.8 | Update `config/methodology.yaml` — add `beta_debt` to all presets | `config/methodology.yaml` | `COMPLETE` | D23 |

---

## Phase 6E: Audit Trail Hardening — `COMPLETE`

| # | Task | File | Status | Decision |
|---|------|------|--------|----------|
| 6E.1 | Write `LOW_R2` and `FEW_OBS` flags to AuditLedger in beta.py | `src/engine/beta.py` | `COMPLETE` | D26 |
| 6E.2 | Write `RF_FALLBACK` flag to AuditLedger in bundesbank.py (not just logger.warning) | `src/data/bundesbank.py` | `COMPLETE` | D26 |
| 6E.3 | Write `TAX_ANOMALY` flag to AuditLedger in financials.py | `src/data/financials.py` | `COMPLETE` | D26 |
| 6E.4 | Excel Sheet 7 — render flags column in bold red; gold warning box for RF_FALLBACK | `src/reports/excel_builder.py` | `COMPLETE` | D26 |
| 6E.5 | UI report mode — surface non-empty flags as `st.warning` banners before download | `src/ui/dashboard.py` | `COMPLETE` | D26 |
| 6E.6 | Test — assert flags written for low R² scenario | `tests/test_pipeline.py` | `COMPLETE` | D26 |
| 6E.7 | Test — assert RF_FALLBACK flag written when Bundesbank mocked to fail | `tests/test_market_rates.py` | `COMPLETE` | D26 |

---

---

## Phase 7: UX Improvements — `PENDING`

### Phase 7A: Peer Table Export (D27)

| # | Task | File | Status |
|---|------|------|--------|
| 7A.1 | Add `show_ticker_export` / `show_table_export` / `show_results_export` session state bools | `src/ui/dashboard.py` | `COMPLETE` |
| 7A.2 | Config mode: COPY TICKERS button + `st.code` newline ticker list | `src/ui/dashboard.py` | `COMPLETE` |
| 7A.3 | Config mode: COPY PEER TABLE button + TSV with headers | `src/ui/dashboard.py` | `COMPLETE` |
| 7A.4 | Report mode: COPY RESULTS TABLE button + TSV with headers | `src/ui/dashboard.py` | `COMPLETE` |
| 7A.5 | Helpers: `build_ticker_list`, `build_config_tsv`, `build_results_tsv` | `src/ui/export_helpers.py` | `COMPLETE` |
| 7A.6 | Unit tests: all three format helpers + edge cases | `tests/test_dashboard_export.py` | `COMPLETE` |

### Phase 7B: Ticker Suggestion Engine (D28)

| # | Task | File | Status |
|---|------|------|--------|
| 7B.1 | Add `pending_suggestions` dict to session state initialisation | `src/ui/dashboard.py` | `COMPLETE` |
| 7B.2 | New function: `search_ticker_suggestions(bare_ticker)` — yf.Search wrapper, filters equity, caps at 5, never raises | `src/ui/export_helpers.py` | `COMPLETE` |
| 7B.3 | Modify `_add_peers_batch`: on bare-ticker failure → call `_search_ticker_suggestions`, store in `pending_suggestions` | `src/ui/dashboard.py` | `COMPLETE` |
| 7B.4 | New function: `_render_suggestions_panel()` — amber panel with suggestion buttons + Dismiss per unresolved ticker | `src/ui/dashboard.py` | `COMPLETE` |
| 7B.5 | Call `_render_suggestions_panel()` at top of peer section in `render_config_mode()` | `src/ui/dashboard.py` | `COMPLETE` |
| 7B.6 | Unit tests: suggestion search (mock yf.Search), filtering, empty result, exception handling | `tests/test_dashboard_export.py` | `COMPLETE` |

---

## Session Log

| Date | Session | Completed |
|---|---|---|
| 2026-05-07 | Planning | Full architecture, all decisions, vibe files, skeleton |
| 2026-05-07 | Audit + Domain Build | Technical audit (R1–R8), binding decisions D10–D17, all 5 domain modules, Svensson engine, private company support |
| 2026-05-07 | UI Dual-Mode Redesign | Pydantic bug fix (description key), .streamlit/config.toml, styles.py (CONFIG_MODE_CSS + REPORT_MODE_CSS), full dashboard.py rewrite — two-vibe state machine: dark technical config cockpit + white executive report mode |
| 2026-05-07 | Full Build (prior session) | Phases 1–5: all data providers, engine (beta/hamada/capm), Excel builder, 132 tests — codebase ran ahead of tracker |
| 2026-05-09 | Tracker Sync | Verified 132/132 tests pass; synced TODO.md to match actual codebase state; only README.md remains |
| 2026-05-09 | Phase 6 Design | Deep audit of full codebase; identified 6 improvement areas; binding decisions D21–D26 added; vibe files updated |
| 2026-05-10 | Phase 6 Full Build | Phases 6A–6E: WACC engine (kd.py, damodaran_spreads.py, compute_wacc), CAPM-Tax toggle, Fernandez unleveraging (unlevering.py), dynamic sensitivity bounds, audit trail hardening (LOW_R2/FEW_OBS/RF_FALLBACK/TAX_ANOMALY flags), Sheet 8 WACC Waterfall, force-include UI. 226/226 tests passing. |
| 2026-05-12 | Phase 7 Implementation | D27 export panels (COPY TICKERS, COPY PEER TABLE, COPY RESULTS TABLE) + D28 ticker suggestion engine (yf.Search, resolution panel, no auto-select). Helpers extracted to src/ui/export_helpers.py. 256/256 tests passing. |
