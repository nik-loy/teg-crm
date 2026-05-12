# CAPM Magic — CONTEXT (Binding Decisions Log)

> All architectural and methodology decisions locked before first line of code.
> Do NOT re-open these decisions without user confirmation.
> Last Updated: 2026-05-09 (Phase 6 decisions D21–D26 added)

---

## Project Background

**Goal**: Programmatic, audit-ready Cost of Equity engine. Compete with PwC/KPMG Big 4 Excel models.
**Target client**: Siemens Energy (ENR.DE) — MDAX, EUR-denominated, post-spin-off restructuring history.
**Analyst profile**: Financial professional, institutional valuation context, Excel-native workflow.

---

## D1 — IDW S1 Compliance (HARD REQUIREMENT)

German professional valuations require compliance with IDW S1 (Institut der Wirtschaftsprüfer Standard 1).

**Concrete implications**:
- Rf must use **Svensson parametric method** on German Bund curve (NOT simple 10Y spot rate)
- ERP must follow **IDW FAUB guidance**: currently 5.5–8.0% range
- Standard CAPM-Tax model (personal investor tax on dividends) deferred to post-MVP (too complex for Phase 1)
- Anglo-American Damodaran approach is explicitly **not sufficient** for German WP sign-off

**Why it matters**: A German Wirtschaftsprüfer reviewing the output will check the Rf methodology first. Svensson is the gate.

---

## D2 — Tax Rate: Effective TTM with Auto-Fetch + Manual Override

- **Auto-fetch**: TTM effective rate = `income_tax_expense / pretax_income` from `yfinance`
- **Anomaly flags**: Pydantic validator flags rate if <5% or >60% — forces manual confirmation
- **Manual override**: Always visible in UI, never hidden
- **Rationale**: Siemens Energy had restructuring losses post-spin-off; their effective rate has been anomalous. Statutory rate (German ~30%) is the fallback when effective rate is flagged.

---

## D3 — Beta: 2-Year Weekly, Blume-Adjusted

- Lookback: **2 years** (IDW S1 + Bloomberg DE standard)
- Frequency: **weekly returns** (reduces daily noise, IDW standard)
- Adjustment: **Blume formula**: `β_adj = (2/3 × β_OLS) + (1/3 × 1.0)`
- Market index: **GDAXI** (DAX) for German companies; configurable per methodology preset
- All parameters user-adjustable via Streamlit sidebar (presets: IDW S1, Bloomberg, Custom)

---

## D4 — D/E Ratio: Market Equity + Book Debt

- Market equity: `price × shares_outstanding` (from yfinance)
- Debt: `total_debt` from balance sheet (yfinance financials)
- Rationale: Most defensible in professional valuation contexts; book debt is audited; market equity reflects current value

---

## D5 — Peer Group: Auto-Suggest from GICS

- Auto-populate from `config/gics_peers.yaml` keyed by GICS sub-industry
- Fetch GICS via `yfinance ticker.info["industry"]`
- Return top 8 most liquid peers (by trailing avg volume)
- User can add/remove tickers in UI before running
- YAML must be updated periodically (flag last-updated date in UI)

---

## D6 — Primary Deliverable: Excel Workbook (7 Sheets)

- **Streamlit** = analyst cockpit only (not client-facing)
- **Excel** = client deliverable (send directly after download)
- Built with `openpyxl`, formatted PwC-style
- 7 sheets defined in PRIMER §5
- Must be structured so a Big 4 auditor can trace every number back to a source

---

## D7 — Deployment: Local-First

- Phase 1: `streamlit run src/ui/dashboard.py` on analyst laptop
- No cloud dependency; financial data never leaves analyst machine
- Scale-up path: deploy to client's Azure/AWS tenant (per engagement)
- Streamlit Community Cloud explicitly rejected (public — unsuitable for client data)

---

## D8 — Svensson Risk-Free Rate (IDW S1 Implementation)

- Deutsche Bundesbank publishes daily Svensson parameters via public API
- `src/engine/svensson.py` fits the Nelson-Siegel-Svensson model to produce spot rates
- Use "long-run" extrapolation (~30Y horizon) per IDW FAUB guidance on normalized Rf
- **Fallback**: If Bundesbank API unavailable → FRED `IRLTLT01DEM156N` (German Bund 10Y) with visible warning in UI
- This is the highest-complexity component. Unit-test against known Bundesbank published values.

---

## D9 — ERP: FAUB Range (IDW S1), Exposed as Slider

- Base: **7.0%** (midpoint of FAUB 5.5–8.0% range)
- UI: slider between 5.5–8.0% for sensitivity
- Damodaran implied ERP available as alternative under "Bloomberg Default" preset
- Every output must record which ERP source and value was used

---

## Known Risks

| Risk | Mitigation |
|---|---|
| Bundesbank API changes / unavailable | FRED fallback + visible warning + AuditLedger flag (D26) |
| Negative effective tax rates (Siemens Energy) | Anomaly flag + statutory fallback + flag in AuditLedger (D26) |
| yfinance data gaps/stale prices | PriceProvider ABC (swap to Bloomberg) |
| GICS peer YAML becomes stale | last-updated date shown in UI |
| IDW FAUB ERP range changes annually | Config-driven; update methodology.yaml |
| CAPM-Tax model not implemented | IMPLEMENTED in Phase 6 as optional toggle (D22) |
| Sensitivity table misses base case | Fixed in Phase 6 with dynamic bounds (D24) |
| All peers are financial sector → crash | Fixed in Phase 6 with min-count validation + override UI (D25) |

---

## D10 — Peer Currency Policy (BINDING — 2026-05-07)

Default: **`local_index_per_peer`** — each peer regressed against its own primary market index
in its local currency (e.g. `SIE.DE` vs `^GDAXI`, `ABB` vs `^GSPC`).

This matches Bloomberg/practitioner convention and is audit-defensible (each beta is measured
against the market most relevant to that company's investors).

**Configurable options**: `local_index_per_peer` | `same_currency_only` | `global_index`
(exposed as `peer_currency_policy` on `MethodologyConfig`; stamped into AuditLedger).

**Limitation acknowledged**: unlevered betas from different market contexts are aggregated
in the peer median. This is standard Big-4 practice; must be disclosed in Sheet 7.

---

## D11 — Financial-Sector Peer Exclusion (BINDING — 2026-05-07)

Default: **`exclude_with_override`** — banks and insurers are filtered out before Hamada/Fernández
unlevering. Their leverage is operational (deposits, technical reserves), not financing.

Override path: analyst can force-include a financial-sector peer via UI checkbox. Override
is hard-stamped into `AuditLedger.overrides` with analyst justification text — no silent overrides.

Implementation: `PeerEligibilityRule.exclude_financials` applied before any unlevering step.
GICS/Yahoo "Banks", "Insurance", "Diversified Financials" map to this filter.

---

## D12 — Relever Target D/E (BINDING — 2026-05-07)

Default: **subject's current D/E** (`market_equity × book_debt` from live yfinance fetch).

Optional: `target_de_ratio: Decimal | None` on `MethodologyConfig`. When `None`, engine uses
current D/E. When set, engine uses supplied ratio (M&A / post-deal scenarios).

Field exists in schema now; UI does not expose it until Phase 5 (post-MVP override).

---

## D13 — Damodaran ERP + Germany Country Risk Premium (BINDING — 2026-05-07)

When `erp_source == "damodaran_implied"` for a non-US engagement:

`ERP_effective = US_implied_ERP + λ × Germany_CRP`

where `Germany_CRP` is fetched from Damodaran's `ctryprem.xls` and `λ` defaults to **1.0**.

**λ interpretation**: revenue-exposure coefficient (1.0 = full Germany exposure). Future:
derive from yfinance segment revenue if available.

**Data source**: `https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctryprem.xls`
Fetch + schema-validate at parse time; fail loudly if column layout shifts (changes annually).

**IDW S1 guard**: `MethodologyConfig` validator prevents `preset="idw_s1_standard"` +
`erp_source="damodaran_implied"` — IDW S1 requires FAUB ERP.

---

## D14 — Svensson Rf Horizon (BINDING — 2026-05-07)

Default: **30Y** — FAUB Basiszinssatz convention for perpetuity-style going-concern DCFs.

Configurable: `rf_horizon_years: float` on `MethodologyConfig` (range 1–50Y).
Always stamped into AuditLedger so the exact Rf point can be reproduced.

---

## D15 — Numeric Types (BINDING — 2026-05-07)

- **`Decimal`**: all monetary fields — `market_equity`, `total_debt`, `pretax_income`, `tax_expense`
- **`float`**: rates, ratios, coefficients — `tax_rate`, `de_ratio`, `beta`, `rf`, `erp`, `ke`
- All `Decimal` fields round to 2 decimal places at the **presentation layer only**; intermediate
  math keeps full precision.
- Prevents IEEE-754 rounding artifacts appearing as $0.01 discrepancies in Excel cells.

---

## D16 — Private Company Support (BINDING — 2026-05-07)

Engine supports both public (ticker-based) and large international private companies
(e.g. Robert Bosch GmbH, Festo, Heraeus, Bertelsmann).

**Key insight**: IDW S1 already requires pure-play peer beta methodology. Private companies
lose NOTHING methodologically — the peer regression is identical. Only the subject's
own capital structure input changes.

**Public company workflow**: ticker → yfinance auto-fetch market equity, total_debt, tax_rate.

**Private company workflow**:
- `SubjectProfile.ticker = None`
- `capital_structure.equity_basis = "book"` (from Jahresabschluss / IFRS group accounts)
- `capital_structure.data_source = "manual"` or `"bundesanzeiger"`
- `effective_tax_rate` set manually from annual accounts
- `tax_rate_source = "manual"` (not `"effective_auto"` — enforced by Pydantic validator)
- `revenue_exposures` list drives `suggested_crp_lambda` for D13 (Damodaran ERP adjustment)

**Multi-segment private companies** (e.g. Bosch: auto + industrial + consumer):
- Run separate peer beta analyses per segment with segment revenue weights
- Weighted-average β_u = Σ(segment_weight × segment_β_u)
- Document segment weights in Sheet 7 (Methodology & Sources)
- Phase 1 scope: single peer group; multi-segment as post-MVP

**Data sources for German private company accounts**:
- Bundesanzeiger (bundesanzeiger.de) — mandatory HGB/IFRS filing, publicly accessible
- Northdata.de — structured financial data from Bundesanzeiger (API available)
- Manual PDF extraction as fallback
- Phase 1 scope: manual input only; Northdata integration as post-MVP

**Capital structure note**: For relevering, D12 uses `target_de_policy="current"` (subject's
book D/E). For private companies this is the only available basis. Override with
`target_de_ratio` for transaction-specific capital structures (LBO, refinancing).

---

## D18 — UI: Two-Vibe Architecture (BINDING — 2026-05-07)

Single-page Streamlit app controlled by `session_state["mode"]` (`"config"` | `"report"`).

**Config mode** (pre-calculation): Dark technical cockpit. All methodology parameters are exposed
as UI inputs — nothing hardcoded. Analyst can override every D1–D17 decision in Custom preset.
Peer group editor supports GICS auto-suggest, manual entry, or both merged.

**Report mode** (post-calculation): White executive presentation. Ke displayed as hero figure in
brand orange. Every number in the report is traceable to source via audit trail section.
"Back to Configuration" transitions back without losing parameter state.

**Design rationale**: The two modes serve different audiences and mindsets:
- Config mode = analyst mindset (precision, options, control)
- Report mode = partner/board mindset (clarity, confidence, answerability)

**Key implementation files**:
- `src/ui/dashboard.py` — state machine + all rendering
- `src/ui/styles.py` — `CONFIG_MODE_CSS` + `REPORT_MODE_CSS`
- `.streamlit/config.toml` — dark base theme

---

## D19 — Peer Group Input (BINDING — 2026-05-07)

The peer group is always analyst-controlled in the UI. Three modes:
- `"gics"` — auto-populated from `config/gics_peers.yaml` by subject GICS industry
- `"manual"` — analyst pastes comma-separated or line-separated tickers
- `"both"` — GICS list merged with manual additions (deduped)

The subject ticker is always excluded from the peer list automatically.
Peers are displayed as removable chips in the UI for visual confirmation before calculating.

---

## D20 — Pydantic `extra="forbid"` + YAML metadata (BINDING — 2026-05-07)

`MethodologyConfig` uses `ConfigDict(extra="forbid")` — this is intentional and must NOT be
relaxed. It prevents accidental YAML keys from silently polluting the config model.

The `description` key in `config/methodology.yaml` presets is human-readable metadata only.
It is explicitly popped from `preset_data` before the constructor call in `from_yaml_preset()`.
Any future human-readable metadata keys added to YAML presets must be similarly popped.

---

## D17 — Multi-Country Rf Architecture (BINDING — 2026-05-07)

The engine supports 17 countries covering all gics_peers.yaml markets plus major global peers.
Peer groups span DE, US, FR, CH, JP, IT, ES, DK, SE, CA, NL, IE, GB, NO, AU, KR, CN.

**Principle**: Rf always belongs to the **subject company's home currency**, not the peers.
When valuing a German company, Rf = EUR Bundesbank regardless of peer nationalities.
When comparing Ke across companies (ENR.DE vs. GEV vs. ABB), each uses its own sovereign curve.

**Three-tier data quality model** (recorded in AuditLedger, shown in Sheet 7):

| Tier | Method | Countries | Quality |
|------|--------|-----------|---------|
| 1 | Central bank publishes β₀–β₃, τ₁, τ₂ natively | DE, GB, DK, SE | Highest — no fitting error |
| 2 | Daily yield curve (≥ 6 maturities); scipy fits NSS | US, CH, CA, JP, FR, IT, ES, NL, IE | Good — fitting RMSE < 10 bp |
| 3 | Single FRED long-term rate (flat curve proxy) | NO, AU, KR, CN | Limited — flagged in UI |

**Implementation files**:
- `src/domain/market_data.SvenssonParams` — added `country_iso2` and `currency` fields
- `src/data/providers/rf_base.py` — `RfProvider` ABC + `CountryRfConfig` dataclass
- `src/data/providers/rf_registry.py` — canonical country registry + `get_rf_provider()` factory
- `src/engine/svensson_fit.py` — scipy L-BFGS-B Svensson fitting for Tier-2 providers

**Concrete providers to build in Phase 1** (all Tier-2/3 use `svensson_fit.py`):
1. `src/data/bundesbank.py` → `BundesbankRfProvider` — Task 1.7 (already planned)
2. `src/data/providers/rf_fred_us.py` → `FredTreasuryRfProvider` — NEW Task 1.12
3. `src/data/providers/rf_boe.py` → `BoERfProvider` — NEW Task 1.13
4. `src/data/providers/rf_ecb_sdw.py` → `EcbSdwRfProvider` (handles FR/IT/ES/NL/IE) — NEW Task 1.14
5. `src/data/providers/rf_fred_fallback.py` → `FredFallbackRfProvider` (all others) — NEW Task 1.15

**Data source URLs**:
- Bundesbank: `https://api.bundesbank.de/service/data/BBDB/`
- BoE NSS params: `https://www.bankofengland.co.uk/statistics/yield-curves`
- US Treasury (FRED): `DGS1MO, DGS3MO, DGS6MO, DGS1, DGS2, DGS3, DGS5, DGS7, DGS10, DGS20, DGS30`
- ECB SDW: `https://data-api.ecb.europa.eu/service/data/YC/`
- FRED fallback pattern: `IRLTLT01XXM156N` (monthly; monthly average, not daily)

---

## D21 — WACC Module (BINDING — 2026-05-09)

The engine is extended from a Ke-only tool to a full WACC calculator. This is the primary Phase 6 addition.

**Formula**: `WACC = (E/V) × Ke + (D/V) × Kd × (1 − T)`

Where:
- `E` = market equity (from CapitalStructure.market_equity)
- `D` = total debt (from CapitalStructure.total_debt)
- `V = E + D`
- `Ke` = cost of equity from existing CAPM engine
- `T` = tax rate (from MethodologyConfig, same as used in Hamada)

**Kd estimation** — three methods, analyst selects via `kd_method` in MethodologyConfig:
- `"statement_based"` — `Kd_pretax = TTM interest expense / total debt` (auto-fetched via yfinance)
- `"ytm_spread"` — `Kd_pretax = Rf + credit spread` (analyst inputs credit rating; spread from Damodaran rating table `src/data/damodaran_spreads.py`)
- `"manual"` — analyst enters pre-tax Kd directly

**New fields on MethodologyConfig**: `kd_method`, `kd_manual_value: float | None`, `kd_credit_rating: str | None`

**New domain model**: `WACCResult(ke, kd_pretax, kd_aftertax, equity_weight, debt_weight, wacc, tax_shield)` — added to `src/domain/results.py`; embedded in `CAPMResult`

**New engine function**: `compute_wacc(ke, kd_pretax, tax_rate, de_ratio) -> WACCResult` in `src/engine/capm.py`

**New Excel sheet**: Sheet 8 "8 WACC Waterfall" — E/V, D/V, Ke, Kd pre-tax, Kd after-tax, tax shield, WACC. Added to `src/reports/excel_builder.py`.

**Audit requirements**:
- Kd source stamped into AuditLedger (method + raw value before tax adjustment)
- Flag if `kd_pretax < rf` (Kd below risk-free — data anomaly)
- Flag if `debt_weight > 0.80` (extreme leverage)
- WACC and both Ke variants (standard + CAPM-Tax if enabled) shown in report hero section

---

## D22 — CAPM-Tax Optional Toggle (BINDING — 2026-05-09)

Standard CAPM ignores personal investor taxes. IDW S1 Phase 2 allows CAPM-Tax, which adjusts Rf and ERP for the German flat capital gains tax (Abgeltungsteuer).

**Formula**:
```
Ke_tax = Rf × (1 − s_z) + β_L × ERP × (1 − s_z)
       = (1 − s_z) × (Rf + β_L × ERP)
```
Where `s_z = 0.26375` (25% Abgeltungsteuer + 5.5% Solidaritätszuschlag, effective rate).

**New fields on MethodologyConfig**: `capm_tax_enabled: bool = False`, `abgeltungsteuer_rate: float = 0.26375`

`abgeltungsteuer_rate` is configurable — the Soli surcharge has been politically variable; do not hardcode.

**When enabled**:
- Ke_standard and Ke_tax both computed and displayed (report mode shows both)
- Ke_tax is always ≤ Ke_standard for positive ERP (this invariant is unit-tested)
- For WACC: analyst selects which Ke to use via `capm_tax_for_wacc: bool` config field
- Excel Sheet 2 shows both Ke variants in adjacent rows

**When disabled (default)**:
- Sheet 7 must state: "Standard CAPM applied — CAPM-Tax not applied per analyst selection"
- This disclaimer is mandatory for IDW S1 engagements to prevent WP compliance questions

---

## D23 — Fernandez (2004) Unleveraging Formula (BINDING — 2026-05-09)

The config has accepted `unlever_formula: "fernandez"` since Phase 2 but the engine silently fell back to Hamada. This is a broken config option — a critical audit defect. Phase 6 fully implements Fernandez.

**Hamada (existing default)**:
```
β_u = β_L / [1 + (1 − T) × D/E]   # Tax shield discounted at Rf (Miles-Modigliani)
β_L = β_u × [1 + (1 − T) × D/E]
```

**Fernandez (2004) — new implementation**:
```
β_u = (β_L × E + β_d × D × (1 − T)) / (E + D × (1 − T))
β_L = β_u × (E + D × (1 − T)) / E − β_d × D × (1 − T) / E
```
Where `β_d` = debt beta (defaults to 0.0 for investment-grade; analyst configurable).

**New field on MethodologyConfig**: `beta_debt: float = 0.0` (used only when `unlever_formula = "fernandez"`)

**File change**: `src/engine/hamada.py` → rename to `src/engine/unlevering.py`; add `unlever_fernandez()` and `relever_fernandez()` alongside existing Hamada functions. Router in `src/engine/capm.py` dispatches based on `methodology.unlever_formula`.

**Audit**: Excel Sheet 3 must show which formula was used per peer. If Fernandez with `beta_debt = 0.0`, flag: "Debt beta approximated as 0.0 — validate against bond yield data."

**IDW S1 default remains Hamada** — Fernandez is available for M&A/LBO scenarios where target leverage ratio is specified.

---

## D24 — Dynamic Sensitivity Bounds (BINDING — 2026-05-09)

The sensitivity heatmap (Sheet 5) previously used hardcoded ERP range [5.5%, 6.0%, 6.5%, 7.0%, 7.5%, 8.0%] and fixed beta scale factors [0.7×–1.3×]. This caused the base-case Ke to be outside the highlighted grid when analysts used non-default ERP inputs.

**New rule**: The sensitivity grid is always constructed to guarantee the base-case intersection cell exists.

**ERP axis**: 6 evenly-spaced steps from `max(0.001, erp_value − erp_range_spread)` to `erp_value + erp_range_spread`, where `erp_range_spread = (erp_range_high − erp_range_low) / 2`. The base-case `erp_value` is always one of the 6 steps.

**Beta axis**: 7 steps: `[0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]` × `beta_levered`. Base-case `1.0×` is always step 4 (index 3).

**Assertion**: Build function must assert that the intersection of actual ERP and 1.0× beta produces the gold-highlighted cell. If not, raise `SensitivityBoundsError` (developer error, not user error).

---

## D25 — Peer Robustness: Minimum Count + Override UI (BINDING — 2026-05-09)

**Minimum eligible peers**: The pipeline requires ≥ 2 eligible peers after financial-sector filtering before computing median β_u. Fewer than 2 raises `InsufficientPeersError` with a message listing: how many were supplied, how many were excluded and why, and the suggestion to use force-include or expand the peer group.

**Override UI**: Config mode peer table gains a "Force Include" checkbox per row. When checked, a mandatory "Justification" text input appears. The analyst cannot run the calculation if Force Include is checked but justification is empty.

**Audit**: `AuditLedger.record_override(rule="financial_peer_include", justification=..., analyst=..., ticker=...)` is called for each force-included peer. This appears in Sheet 7 Analyst Overrides section and is shown in the peer's eligibility note in Sheet 4.

**Test coverage**: `tests/test_pipeline.py` must cover: (a) all-financial peer group → `InsufficientPeersError`; (b) single eligible peer → `InsufficientPeersError`; (c) force-include path → override stamped in AuditLedger.

---

## D27 — Peer Table Export / Copy Functionality (BINDING — 2026-05-12)

Config mode: two export buttons below the peer table — "COPY TICKERS" (newline-separated symbol list) and "COPY PEER TABLE" (TSV). Report mode: "COPY RESULTS TABLE" (TSV). All use `st.code(text, language=None)` which renders Streamlit's native copy-to-clipboard button — no JS injection required.

**Ticker format**: newline-separated (pastes as Excel column, Word paragraph list, Bloomberg terminal input).

**TSV config columns**: Ticker, Company Name, Index, Country, Market Cap (M), Currency, Industry.

**TSV report columns**: Ticker, Beta (Adj), D/E Ratio, Rf (Local)%, Ke (Local)%, Unlevered Beta, Status.

**Word/PPT workflow**: Paste TSV into Excel first → select range → copy → paste into Word/PPT as formatted table. Documented as `st.caption` under the TSV block.

**Toggle behaviour**: Each button flips a session_state bool to show/hide the `st.code` block. Buttons only render when `peer_data` is non-empty.

---

## D28 — Ticker Suggestion Engine (BINDING — 2026-05-12)

When a bare ticker (no `.` suffix) fails direct yfinance enrichment, call `yf.Search(ticker, news_count=0).quotes`, filter to `quoteType == "EQUITY"`, cap at 5. Store in `session_state["pending_suggestions"]` dict. Render an amber-bordered "RESOLVE UNRECOGNIZED TICKERS" panel above the peer table.

**Hard rules**: Never auto-select. Never modify the user's input ticker without an explicit button click. Tickers that already contain `.` and fail are treated as data errors (not suggestion candidates).

**Resolution panel**: Each unresolved ticker shows suggestion buttons labeled `{symbol}  {shortname}  {exchange}` plus a "Dismiss" button. Clicking a suggestion runs `_fetch_one(full_symbol)` and adds to `peer_data` on success. Dismiss removes from pending without adding.

**Zero results**: Amber warning: `"[TICKER] — not recognized. No suggestions found. Verify exchange suffix (e.g. .DE, .SW, .ST)."`.

**New function**: `_search_ticker_suggestions(bare_ticker: str) -> list[dict]` — wraps yf.Search, never raises.

---

## D26 — Audit Trail Hardening (BINDING — 2026-05-09)

The `AuditEntry.flags: list[str]` field has been underutilized. Phase 6 requires these specific flag-writing events to be active, all routed through `AuditLedger.add()` (not just Python logging):

| Event | Flag text | File |
|-------|-----------|------|
| Beta R² < 0.30 | `"LOW_R2: {ticker} R²={val:.2f} (<0.30 threshold)"` | `src/engine/beta.py` |
| Beta n < 52 weekly obs | `"FEW_OBS: {ticker} n={n} (<52 = less than 1Y)"` | `src/engine/beta.py` |
| Bundesbank fallback to FRED | `"RF_FALLBACK: Bundesbank unavailable; using FRED IRLTLT01DEM156N"` | `src/data/bundesbank.py` |
| Tax rate < 5% or > 60% | `"TAX_ANOMALY: {ticker} effective_rate={val:.1%} outside [5%,60%]"` | `src/data/financials.py` |
| Hamada denominator < 0.001 | `"HAMADA_DENOMINATOR_NEAR_ZERO: {ticker}"` — raise after flagging | `src/engine/unlevering.py` |
| Kd < Rf (anomaly) | `"KD_BELOW_RF: kd={kd:.2%} < rf={rf:.2%}"` | `src/engine/kd.py` |
| Debt weight > 80% | `"HIGH_LEVERAGE: D/V={w:.1%} (>80%)"` | `src/engine/capm.py` |

**Excel Sheet 7**: Flags column rendered in bold red if non-empty. Bundesbank fallback event rendered as a gold warning box in the Sheet 7 footer.

**UI**: Report mode surfaces any non-empty flags as `st.warning` banners above the download button, listed per peer and per step.
