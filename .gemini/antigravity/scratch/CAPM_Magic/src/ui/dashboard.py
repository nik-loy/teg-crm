"""
CAPM Magic — Peer Group Analysis Dashboard.

Mode "config"  → dark technical cockpit; unified peer group table with auto-enrichment.
Mode "report"  → white executive presentation; median unlevered beta focus.

State machine:
    session_state["mode"]      : "config" | "report"
    session_state["result"]    : CAPMResult | None
    session_state["peer_data"]  : List of dicts {ticker, name, index_ticker, index_name, ...}
    session_state["inputs"]    : dict of last submitted config inputs
"""
from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal

import streamlit as st

from src.ui.styles import CONFIG_MODE_CSS, REPORT_MODE_CSS
from src.ui.export_helpers import (
    build_ticker_list as _build_ticker_list,
    build_config_tsv as _build_config_tsv,
    build_results_tsv as _build_results_tsv,
    search_ticker_suggestions as _search_ticker_suggestions,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="CAPM Magic",
    page_icon="▶",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------
if "mode" not in st.session_state:
    st.session_state["mode"] = "config"
if "result" not in st.session_state:
    st.session_state["result"] = None
if "peer_data" not in st.session_state:
    st.session_state["peer_data"] = []
# D25 — Force-include overrides
if "force_include" not in st.session_state:
    st.session_state["force_include"] = {}
if "force_include_justification" not in st.session_state:
    st.session_state["force_include_justification"] = {}
# D21 — Cost of Debt (Kd) / WACC configuration
if "kd_method" not in st.session_state:
    st.session_state["kd_method"] = "statement_based"
if "kd_credit_rating" not in st.session_state:
    st.session_state["kd_credit_rating"] = ""
if "kd_manual_value" not in st.session_state:
    st.session_state["kd_manual_value"] = 0.04
if "capm_tax_for_wacc" not in st.session_state:
    st.session_state["capm_tax_for_wacc"] = False
# D22 — CAPM-Tax toggle
if "capm_tax_enabled" not in st.session_state:
    st.session_state["capm_tax_enabled"] = False
if "abgeltungsteuer_rate" not in st.session_state:
    st.session_state["abgeltungsteuer_rate"] = 26.375
# D23 — beta_debt for Fernandez
if "beta_debt" not in st.session_state:
    st.session_state["beta_debt"] = 0.0
# D27 — Export panel visibility toggles
if "show_ticker_export" not in st.session_state:
    st.session_state["show_ticker_export"] = False
if "show_table_export" not in st.session_state:
    st.session_state["show_table_export"] = False
if "show_results_export" not in st.session_state:
    st.session_state["show_results_export"] = False
# D28 — Ticker suggestion engine
if "pending_suggestions" not in st.session_state:
    st.session_state["pending_suggestions"] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

INDEX_MAPPING = {
    "DE": ("^GDAXI", "DAX Performance-Index"),
    "PA": ("^FCHI", "CAC 40"),
    "L": ("^FTSE", "FTSE 100 Index"),
    "AS": ("^AEX", "AEX-Index"),
    "MI": ("FTSEMIB.MI", "FTSE MIB Index"),
    "MC": ("^IBEX", "IBEX 35"),
    "SW": ("^SSMI", "SMI PR"),
    "CH": ("^SSMI", "SMI PR"),
    "BR": ("^BFX", "BEL 20"),
    "OL": ("^OSEAX", "Oslo Børs All-Share Index"),
    "ST": ("^OMX", "OMX Stockholm 30 Index"),
    "CO": ("^OMXC20", "OMX Copenhagen 20 Index"),
    "HE": ("^OMXH25", "OMX Helsinki 25 Index"),
    "VI": ("^ATX", "Austrian Traded Index"),
    "US": ("^GSPC", "S&P 500"),
}

def get_market_index_for_ticker(ticker: str) -> tuple[str, str]:
    if "." in ticker:
        suffix = ticker.split(".")[-1].upper()
        if suffix in INDEX_MAPPING:
            return INDEX_MAPPING[suffix]
    return INDEX_MAPPING.get("US")

def parse_tickers(input_str: str) -> list[str]:
    """Robustly parse tickers from multi-delimiter strings (Excel, comma, space)."""
    # Split by common delimiters: comma, semicolon, tab, newline
    tokens = re.split(r'[,\t\n;]+', input_str)
    final_tickers = []
    for t in tokens:
        # Sub-split by spaces (handles "SAP.DE AAPL MSFT")
        parts = t.split()
        for p in parts:
            clean = p.strip().upper()
            if clean:
                # Remove common accidentally included symbols like parens, quotes
                clean = re.sub(r'[^A-Z0-9.\-]', '', clean)
                if clean:
                    final_tickers.append(clean)
    return list(dict.fromkeys(final_tickers))

def detect_peer_metadata(info: dict, ticker: str) -> dict:
    """Determine market index and country based on metadata."""
    exchange = info.get("exchange", "").upper()
    country = info.get("country", "").upper()
    
    # Map country names to ISO codes if yfinance gives full names
    COUNTRY_NAME_MAP = {
        "GERMANY": "DE", "UNITED STATES": "US", "UNITED KINGDOM": "GB",
        "FRANCE": "FR", "SWITZERLAND": "CH", "ITALY": "IT",
        "SPAIN": "ES", "NETHERLANDS": "NL", "DENMARK": "DK",
        "SWEDEN": "SE", "FINLAND": "FI", "AUSTRIA": "AT",
        "NORWAY": "NO", "BELGIUM": "BE", "JAPAN": "JP", "CANADA": "CA"
    }
    iso_country = COUNTRY_NAME_MAP.get(country, country)
    if not iso_country or len(iso_country) != 2:
        # Fallback to suffix
        if "." in ticker:
            suffix = ticker.split(".")[-1].upper()
            iso_country = suffix if suffix in INDEX_MAPPING else "US"
        else:
            iso_country = "US"

    # Map high-confidence exchanges to indices
    EXCHANGE_MAP = {
        "GER": "^GDAXI", "FRA": "^GDAXI", "XETR": "^GDAXI",
        "PAR": "^FCHI", "LSE": "^FTSE", "EBS": "^SSMI",
        "AMS": "^AEX", "MIL": "FTSEMIB.MI", "MAD": "^IBEX",
        "BRU": "^BFX", "OSL": "^OSEAX", "STO": "^OMX",
        "CPH": "^OMXC20", "HEL": "^OMXH25", "VIE": "^ATX",
        "NMS": "^GSPC", "NYQ": "^GSPC", "NGM": "^GSPC",
    }
    
    idx_ticker = EXCHANGE_MAP.get(exchange)
    idx_name = ""
    if idx_ticker:
        for _, (t, n) in INDEX_MAPPING.items():
            if t == idx_ticker:
                idx_name = n
                break
    
    return {
        "index_ticker": idx_ticker or "",
        "index_name": idx_name or "",
        "country_code": iso_country
    }

def _render_suggestions_panel():
    """
    Renders the amber resolution panel for tickers that failed direct enrichment
    and have yfinance.Search suggestions pending analyst confirmation (D28).
    Never auto-selects — every suggestion requires an explicit button click.
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
    confirmed_map: dict[str, str] = {}

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
                if ticker not in to_remove:
                    to_remove.append(ticker)
        if btn_cols[-1].button("Dismiss", key=f"dismiss_{ticker}", use_container_width=True):
            if ticker not in to_remove:
                to_remove.append(ticker)

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


# ---------------------------------------------------------------------------
# Lazy heavy imports
# ---------------------------------------------------------------------------

def _load_modules() -> dict:
    from src.domain.audit import AuditLedger
    from src.domain.market_data import CapitalStructure
    from src.domain.methodology import MethodologyConfig
    from src.domain.results import CAPMResult, PeerEligibility, PeerResult
    from src.domain.subject import SubjectProfile
    return {
        "AuditLedger": AuditLedger,
        "CapitalStructure": CapitalStructure,
        "MethodologyConfig": MethodologyConfig,
        "CAPMResult": CAPMResult,
        "PeerEligibility": PeerEligibility,
        "PeerResult": PeerResult,
        "SubjectProfile": SubjectProfile,
    }


def _load_engine_modules() -> dict:
    from src.engine.capm import build_capm_result, is_financial_sector
    from src.engine.svensson import get_rf_idw
    from src.engine.beta import compute_ols_beta
    from src.engine.hamada import unlever_beta
    from src.data.bundesbank import BundesbankRfProvider  # noqa: F401
    from src.data.providers.rf_registry import get_rf_provider
    from src.data.fetcher import DataFetcher
    from src.data.cleaner import clean_returns
    from src.data.financials import FinancialsService
    from src.data.peers import PeerService
    from src.reports.excel_builder import build_workbook
    return {
        "build_capm_result": build_capm_result,
        "is_financial_sector": is_financial_sector,
        "get_rf_idw": get_rf_idw,
        "get_rf_provider": get_rf_provider,
        "DataFetcher": DataFetcher,
        "clean_returns": clean_returns,
        "FinancialsService": FinancialsService,
        "PeerService": PeerService,
        "compute_ols_beta": compute_ols_beta,
        "unlever_beta": unlever_beta,
        "build_workbook": build_workbook,
    }


# ---------------------------------------------------------------------------
# Preset definitions
# ---------------------------------------------------------------------------

PRESETS = {
    "idw_s1_standard": {
        "label": "IDW S1 Standard",
        "desc": "German Wirtschaftsprüfer · Svensson Rf · FAUB ERP",
        "rf_method": "svensson_bundesbank",
        "erp_source": "faub_current",
        "erp_value": 7.0,
        "erp_range_low": 5.5,
        "erp_range_high": 8.0,
        "beta_lookback_years": 5,
        "beta_frequency": "weekly",
        "beta_adjustment": "blume",
        "market_index": "^GDAXI",
        "unlever_formula": "hamada",
        "tax_rate_method": "effective_auto",
        "rf_horizon_years": 30.0,
        "damodaran_crp_lambda": 1.0,
        "peer_currency_policy": "local_index_per_peer",
        "financial_peer_policy": "exclude_with_override",
        "target_de_policy": "current",
    },
    "bloomberg_default": {
        "label": "Bloomberg Default",
        "desc": "Anglo-American · US 10Y · Damodaran ERP · 5Y",
        "rf_method": "fred_10y",
        "erp_source": "damodaran_implied",
        "erp_value": 4.6,
        "erp_range_low": 3.5,
        "erp_range_high": 6.0,
        "beta_lookback_years": 5,
        "beta_frequency": "weekly",
        "beta_adjustment": "blume",
        "market_index": "^GSPC",
        "unlever_formula": "hamada",
        "tax_rate_method": "statutory",
        "rf_horizon_years": 10.0,
        "damodaran_crp_lambda": 1.0,
        "peer_currency_policy": "local_index_per_peer",
        "financial_peer_policy": "exclude_with_override",
        "target_de_policy": "current",
    },
    "custom": {
        "label": "Custom",
        "desc": "All parameters editable",
        "rf_method": "svensson_bundesbank",
        "erp_source": "faub_current",
        "erp_value": 7.0,
        "erp_range_low": 5.5,
        "erp_range_high": 8.0,
        "beta_lookback_years": 5,
        "beta_frequency": "weekly",
        "beta_adjustment": "blume",
        "market_index": "^GDAXI",
        "unlever_formula": "hamada",
        "tax_rate_method": "effective_auto",
        "rf_horizon_years": 30.0,
        "damodaran_crp_lambda": 1.0,
        "peer_currency_policy": "local_index_per_peer",
        "financial_peer_policy": "exclude_with_override",
        "target_de_policy": "current",
    },
}


# ===========================================================================
# CONFIG MODE
# ===========================================================================

def render_config_mode():
    st.markdown(f"<style>{CONFIG_MODE_CSS}</style>", unsafe_allow_html=True)

    # Bloomberg Status Bar
    st.markdown(
        '<div class="cm-header">'
        '<span class="cm-header-title">CAPM MAGIC <span style="color:#666">|</span> PEER ANALYTICS COCKPIT</span>'
        f'<span class="cm-header-meta">SYS: OK <span style="color:#666">|</span> {date.today().isoformat()} <span style="color:#666">|</span> PORT: 8501</span>'
        '</div>',
        unsafe_allow_html=True,
    )

    st.markdown('<div class="cm-content-wrapper">', unsafe_allow_html=True)

    # ── 02 Peer Group ────────────────────────────────────────────────────────
    st.markdown('<div class="cm-section">02 <span style="opacity:0.3">/</span> Peer Group (Unified Valuation Table)</div>', unsafe_allow_html=True)
    
    # Inline adding logic
    if st.session_state.pop("_reset_ticker_batch", False):
        st.session_state["ticker_batch_entry"] = ""

    add_col1, add_col2, add_col3 = st.columns([3, 1, 1])
    with add_col1:
        batch_input = st.text_area(
            "Add Ticker(s)",
            placeholder="SAP.DE, AAPL, MSFT...",
            key="ticker_batch_entry",
            height=68,
            label_visibility="collapsed"
        ).strip()
    with add_col2:
        if st.button("ADD & ENRICH", use_container_width=True, type="secondary"):
            if batch_input:
                _add_peers_batch(batch_input)
    with add_col3:
        if st.button("CLEAR ALL", use_container_width=True, help="Remove all peers"):
            st.session_state["peer_data"] = []
            st.rerun()

    _render_suggestions_panel()

    if not st.session_state["peer_data"]:
        st.markdown("<div style='color:#FFB000; padding: 2rem; border:1px dashed #333; text-align:center;'>NO PEERS LOADED. USE TERMINAL INPUT ABOVE.</div>", unsafe_allow_html=True)
    else:
        st.markdown("""
            <table class="terminal-table">
                <thead>
                    <tr>
                        <th style="width:10%">Ticker</th>
                        <th style="width:30%">Company Name</th>
                        <th style="width:15%">Index</th>
                        <th style="width:10%">Country</th>
                        <th style="width:30%">Market Cap / Industry</th>
                        <th style="width:5%">Cmd</th>
                    </tr>
                </thead>
            </table>
        """, unsafe_allow_html=True)

        for i, peer in enumerate(st.session_state["peer_data"]):
            r1, r2, r3, r4, r5, r6 = st.columns([1, 3, 1.5, 1, 3, 0.5])

            ticker = peer["ticker"]
            r1.markdown(f"<div style='padding-top:10px; font-family:monospace; color:#00FF00;'>{ticker}</div>", unsafe_allow_html=True)
            peer["name"] = r2.text_input("Name", value=peer["name"], key=f"name_{i}", label_visibility="collapsed")
            peer["index_ticker"] = r3.text_input("Index", value=peer["index_ticker"], key=f"idx_{i}", label_visibility="collapsed")
            peer["country_code"] = r4.text_input("CC", value=peer["country_code"], key=f"cc_{i}", label_visibility="collapsed")

            mcap = peer.get("market_cap") or 0
            curr = peer.get("currency") or "USD"
            r5.markdown(f"<div style='padding-top:10px; font-size:0.75rem; color:#888;'>{mcap/1e6:,.0f}M {curr} <span style='color:#444'>|</span> {peer.get('industry', '—')}</div>", unsafe_allow_html=True)

            if r6.button("DEL", key=f"rm_{i}"):
                st.session_state["peer_data"].pop(i)
                st.rerun()

            # D25 — Force Include checkbox per peer
            force_include_val = st.checkbox(
                f"Force Include {ticker}",
                key=f"force_include_{ticker}",
                value=st.session_state["force_include"].get(ticker, False),
            )
            st.session_state["force_include"][ticker] = force_include_val
            if force_include_val:
                justification_val = st.text_input(
                    f"Justification for including {ticker} (required)",
                    key=f"justification_{ticker}",
                    value=st.session_state["force_include_justification"].get(ticker, ""),
                    placeholder="e.g. 'Only available energy peer in this sub-industry — discussed with engagement partner'",
                )
                st.session_state["force_include_justification"][ticker] = justification_val

    # ── D27: Export panel ─────────────────────────────────────────────────────
    if st.session_state["peer_data"]:
        exp_col1, exp_col2 = st.columns([1, 1])
        with exp_col1:
            if st.button(
                "COPY TICKERS" if not st.session_state["show_ticker_export"] else "▲ HIDE TICKERS",
                key="toggle_ticker_export", use_container_width=True, type="secondary",
            ):
                st.session_state["show_ticker_export"] = not st.session_state["show_ticker_export"]
                st.session_state["show_table_export"] = False
                st.rerun()
        with exp_col2:
            if st.button(
                "COPY PEER TABLE (Excel/TSV)" if not st.session_state["show_table_export"] else "▲ HIDE TABLE",
                key="toggle_table_export", use_container_width=True, type="secondary",
            ):
                st.session_state["show_table_export"] = not st.session_state["show_table_export"]
                st.session_state["show_ticker_export"] = False
                st.rerun()

        if st.session_state["show_ticker_export"]:
            st.code(_build_ticker_list(st.session_state["peer_data"]), language=None)
            st.caption("Paste into Excel → single column A.  Paste into Word → paragraphs; apply 'List Bullet' on Home tab to convert to a list.")

        if st.session_state["show_table_export"]:
            st.code(_build_config_tsv(st.session_state["peer_data"]), language=None)
            st.caption("Excel: Ctrl+V into any cell — columns auto-fill.  Word/PPT: paste into Excel first, select the range, copy, then paste into Word/PPT as a table.")

    # ── 03 Methodology Preset ────────────────────────────────────────────────
    st.markdown('<div class="cm-section">03 <span style="opacity:0.3">/</span> Methodology Preset</div>', unsafe_allow_html=True)

    preset_key = st.radio(
        "Preset",
        options=list(PRESETS.keys()),
        format_func=lambda k: PRESETS[k]["label"],
        horizontal=True,
        label_visibility="collapsed",
        key="methodology_preset"
    )
    p = PRESETS[preset_key]
    st.caption(p["desc"])

    # ── 04 Methodology Parameters ───────────────────────────────────────────
    st.markdown('<div class="cm-section">04 &nbsp; Methodology Parameters</div>', unsafe_allow_html=True)

    is_custom = preset_key == "custom"
    col1, col2, col3 = st.columns(3)

    with col1:
        rf_country = st.selectbox(
            "Target Country",
            ["DE", "US", "GB", "FR", "CH", "IT", "ES", "NL", "DK", "SE", "CA", "JP"],
            index=0,
            help="Determines the risk-free rate used for the final target Ke calculation.",
        )
        rf_method = st.selectbox(
            "Rf Method",
            ["svensson_bundesbank", "fred_10y", "manual"],
            index=["svensson_bundesbank", "fred_10y", "manual"].index(p["rf_method"]),
            disabled=not is_custom,
        )
        r_col, t_col = st.columns([3, 2])
        with r_col:
            rf_horizon_years = st.number_input(
                "Rf Horizon (years)",
                min_value=1.0, max_value=50.0,
                value=float(p["rf_horizon_years"]), step=1.0,
                disabled=not is_custom,
            )
        with t_col:
            st.markdown('<div class="cm-input-tip">Usually 30Y (Europe) or 10Y (US)</div>', unsafe_allow_html=True)

    with col2:
        st.markdown("**Equity Risk Premium**")
        erp_source = st.selectbox(
            "ERP Source",
            ["faub_current", "damodaran_implied", "manual"],
            index=["faub_current", "damodaran_implied", "manual"].index(p["erp_source"]),
            disabled=not is_custom,
        )
        e_col, et_col = st.columns([3, 2])
        with e_col:
            erp_value = st.number_input(
                "ERP (%)",
                min_value=0.5, max_value=20.0,
                value=float(p["erp_value"]), step=0.1,
            )
        with et_col:
            st.markdown('<div class="cm-input-tip">Rec: 5.5% – 8.0% (FAUB / IDW)</div>', unsafe_allow_html=True)

    with col3:
        st.markdown("**Beta Settings**")
        b_col, bt_col = st.columns([3, 2])
        with b_col:
            beta_lookback_years = st.number_input(
                "Lookback (Y)",
                min_value=1, max_value=10,
                value=int(p["beta_lookback_years"]),
            )
        with bt_col:
            st.markdown('<div class="cm-input-tip">Usually 2Y (EU) or 5Y (US)</div>', unsafe_allow_html=True)
        beta_frequency = st.radio(
            "Return Frequency",
            ["weekly", "monthly"],
            index=["weekly", "monthly"].index(p["beta_frequency"]),
            horizontal=True,
            disabled=not is_custom,
        )
        beta_adjustment = st.radio(
            "Beta Adjustment",
            ["blume", "raw"],
            index=["blume", "raw"].index(p["beta_adjustment"]),
            horizontal=True,
            disabled=not is_custom,
        )

    # D23 — beta_debt when Fernandez is selected
    _effective_unlever_formula = p["unlever_formula"]
    beta_debt_val = 0.0
    if _effective_unlever_formula == "fernandez":
        st.markdown('<div class="cm-section">04b <span style="opacity:0.3">/</span> Fernandez Parameters</div>', unsafe_allow_html=True)
        beta_debt_val = st.number_input(
            "Debt Beta (β_d)",
            min_value=0.0, max_value=2.0,
            value=float(st.session_state["beta_debt"]),
            step=0.01,
            help="Default 0.0 = investment-grade approximation. Increase for high-yield issuers.",
        )
        st.session_state["beta_debt"] = beta_debt_val

    # D22 — CAPM-Tax toggle
    st.markdown('<div class="cm-section">04c <span style="opacity:0.3">/</span> CAPM-Tax (IDW S1 Phase 2)</div>', unsafe_allow_html=True)
    capm_tax_enabled = st.checkbox(
        "Enable CAPM-Tax (IDW S1 Phase 2 — Abgeltungsteuer)",
        value=st.session_state["capm_tax_enabled"],
        key="capm_tax_enabled_widget",
    )
    st.session_state["capm_tax_enabled"] = capm_tax_enabled
    abgeltungsteuer_rate_val = 26.375
    capm_tax_for_wacc_val = False
    if capm_tax_enabled:
        abgeltungsteuer_rate_val = st.number_input(
            "Abgeltungsteuer Rate (%)",
            min_value=0.0, max_value=50.0,
            value=float(st.session_state["abgeltungsteuer_rate"]),
            step=0.001,
            format="%.3f",
            help="Standard: 25% + 5.5% Soli = 26.375%. Configurable — Soli is politically variable.",
        )
        st.session_state["abgeltungsteuer_rate"] = abgeltungsteuer_rate_val
        capm_tax_for_wacc_val = st.checkbox(
            "Use Ke_tax in WACC denominator",
            value=st.session_state["capm_tax_for_wacc"],
            key="capm_tax_for_wacc_widget",
        )
        st.session_state["capm_tax_for_wacc"] = capm_tax_for_wacc_val

    # Target Capital Structure
    st.markdown('<div class="cm-section">04d <span style="opacity:0.3">/</span> Target Capital Structure (Private Company)</div>', unsafe_allow_html=True)
    target_de_ratio_val = st.number_input(
        "Verschuldungsgrad (Target D/E Ratio)",
        min_value=0.0, max_value=20.0,
        value=0.0,
        step=0.1,
        help="Manual input for the private company's debt-to-equity ratio used to re-lever the beta.",
    )


    # D21 — Cost of Debt (Kd) / WACC configuration
    with st.expander("Cost of Debt (Kd) — WACC Configuration", expanded=False):
        kd_method_options = ["Statement-Based", "YTM Spread", "Manual"]
        kd_method_map = {
            "Statement-Based": "statement_based",
            "YTM Spread": "ytm_spread",
            "Manual": "manual",
        }
        kd_method_reverse_map = {v: k for k, v in kd_method_map.items()}
        current_kd_label = kd_method_reverse_map.get(st.session_state["kd_method"], "Statement-Based")
        kd_method_label = st.radio(
            "Kd Method",
            options=kd_method_options,
            index=kd_method_options.index(current_kd_label),
            horizontal=True,
        )
        st.session_state["kd_method"] = kd_method_map[kd_method_label]
        kd_credit_rating_val = ""
        kd_manual_value_val = st.session_state["kd_manual_value"]
        if st.session_state["kd_method"] == "ytm_spread":
            kd_credit_rating_val = st.text_input(
                "Credit Rating",
                value=st.session_state["kd_credit_rating"],
                placeholder="e.g. Baa2, A3, BBB",
            )
            st.session_state["kd_credit_rating"] = kd_credit_rating_val
        elif st.session_state["kd_method"] == "manual":
            kd_manual_value_val = st.number_input(
                "Manual Kd (%)",
                min_value=0.01, max_value=30.0,
                value=float(st.session_state["kd_manual_value"]) * 100.0,
                step=0.1,
                format="%.3f",
                help="Enter the pre-tax cost of debt as a percentage (e.g. 4.0 for 4%).",
            ) / 100.0
            st.session_state["kd_manual_value"] = kd_manual_value_val
        wacc_capm_tax_for_wacc = st.checkbox(
            "Use CAPM-Tax Ke in WACC denominator",
            value=st.session_state["capm_tax_for_wacc"],
            key="kd_capm_tax_for_wacc_widget",
        )
        if wacc_capm_tax_for_wacc != st.session_state["capm_tax_for_wacc"]:
            st.session_state["capm_tax_for_wacc"] = wacc_capm_tax_for_wacc

    # ── 05 Engagement ────────────────────────────────────────────────────────
    st.markdown('<div class="cm-section">05 <span style="opacity:0.3">/</span> Engagement</div>', unsafe_allow_html=True)
    eng_col1, eng_col2 = st.columns(2)
    with eng_col1:
        analyst_name = st.text_input("Analyst Name", value="Analyst", key="analyst_name")
    with eng_col2:
        engagement_ref = st.text_input("Engagement Reference", value="", key="engagement_ref", placeholder="e.g. 2026-ENR-001")

    # ── 06 Run ──────────────────────────────────────────────────────────────
    st.markdown('<div class="cm-section">06 <span style="opacity:0.3">/</span> Execution</div>', unsafe_allow_html=True)

    if st.button("RUN ANALYSIS", type="primary", use_container_width=True):
        if not st.session_state["peer_data"]:
            st.error("Add at least one ticker to the group before analyzing.")
        else:
            # D25 — Validate force-include justifications before running
            force_include_errors = []
            for peer in st.session_state["peer_data"]:
                t = peer["ticker"]
                if st.session_state["force_include"].get(t, False):
                    justification = st.session_state["force_include_justification"].get(t, "").strip()
                    if not justification:
                        force_include_errors.append(t)
            if force_include_errors:
                st.error(
                    f"Force Include is enabled for {', '.join(force_include_errors)} but no justification "
                    f"was provided. Please enter a justification for each force-included peer before running."
                )
            else:
                inputs = {
                    "preset_key": preset_key,
                    "peer_data": st.session_state["peer_data"],
                    "country_code": rf_country,
                    "analyst_name": analyst_name or "Analyst",
                    "engagement_ref": engagement_ref,
                    "erp": erp_value / 100.0,
                    "rf_method": rf_method,
                    "erp_source": erp_source,
                    "erp_range_low": p["erp_range_low"] / 100.0,
                    "erp_range_high": p["erp_range_high"] / 100.0,
                    "beta_lookback_years": beta_lookback_years,
                    "beta_frequency": beta_frequency,
                    "beta_adjustment": beta_adjustment,
                    "rf_horizon_years": rf_horizon_years,
                    "unlever_formula": p["unlever_formula"],
                    "tax_rate_method": p["tax_rate_method"],
                    "damodaran_crp_lambda": p["damodaran_crp_lambda"],
                    "peer_currency_policy": p["peer_currency_policy"],
                    "financial_peer_policy": p["financial_peer_policy"],
                    "target_de_policy": "target" if target_de_ratio_val > 0 else p["target_de_policy"],
                    "target_de_ratio": target_de_ratio_val if target_de_ratio_val > 0 else None,
                    # D21 — Kd / WACC config
                    "kd_method": st.session_state["kd_method"],
                    "kd_credit_rating": st.session_state["kd_credit_rating"],
                    "kd_manual_value": st.session_state["kd_manual_value"],
                    "capm_tax_for_wacc": st.session_state["capm_tax_for_wacc"],
                    # D22 — CAPM-Tax
                    "capm_tax_enabled": st.session_state["capm_tax_enabled"],
                    "abgeltungsteuer_rate": st.session_state["abgeltungsteuer_rate"] / 100.0,
                    # D23 — Fernandez beta_debt
                    "beta_debt": st.session_state["beta_debt"],
                    # D25 — Force-include overrides
                    "force_include": dict(st.session_state["force_include"]),
                    "force_include_justification": dict(st.session_state["force_include_justification"]),
                }
                st.session_state["inputs"] = inputs
                with st.spinner("QUERYING MARKET DATA..."):
                    try:
                        result = _run_valuation(inputs)
                        st.session_state["result"] = result
                        st.session_state["mode"] = "report"
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Analysis failed: {exc}")
                        logger.exception("Analysis failed")

    st.markdown('</div>', unsafe_allow_html=True) # End cm-content-wrapper

def _add_peers_batch(batch_str: str):
    """Parses, enriches in parallel, and adds multiple tickers to state."""
    from src.data.providers.yfinance_provider import YFinancePriceProvider
    provider = YFinancePriceProvider()
    
    tickers = parse_tickers(batch_str)
    # Filter out existing
    existing = {p["ticker"] for p in st.session_state["peer_data"]}
    new_tickers = [t for t in tickers if t not in existing]
    
    if not new_tickers:
        return

    progress_text = f"Enriching {len(new_tickers)} tickers..."
    bar = st.progress(0, text=progress_text)
    
    results = []
    
    def _fetch_one(t):
        try:
            info = provider.fetch_ticker_info(t)
            meta = detect_peer_metadata(info, t)
            return {
                "ticker": t,
                "name": info.get("long_name") or info.get("short_name") or t,
                "index_ticker": meta["index_ticker"],
                "index_name": meta["index_name"],
                "country_code": meta["country_code"],
                "market_cap": info.get("market_cap"),
                "industry": info.get("gics_industry"),
                "currency": info.get("currency"),
                "success": True
            }
        except Exception as e:
            return {"ticker": t, "success": False, "error": str(e)}

    with ThreadPoolExecutor(max_workers=min(len(new_tickers), 10)) as executor:
        futures = {executor.submit(_fetch_one, t): t for t in new_tickers}
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

    bar.empty()
    if results:
        st.session_state["peer_data"].extend(results)
        st.session_state["_reset_ticker_batch"] = True
        st.rerun()
    else:
        st.error("No valid ticker data could be retrieved. Please check your input.")


# ---------------------------------------------------------------------------
# Computation pipeline
# ---------------------------------------------------------------------------

def _run_valuation(inputs: dict):
    dom = _load_modules()
    eng = _load_engine_modules()

    from src.data.providers.yfinance_provider import YFinancePriceProvider
    import src.data.bundesbank  # noqa: F401

    MethodologyConfig = dom["MethodologyConfig"]
    SubjectProfile = dom["SubjectProfile"]
    AuditLedger = dom["AuditLedger"]
    CapitalStructure = dom["CapitalStructure"]
    PeerResult = dom["PeerResult"]
    PeerEligibility = dom["PeerEligibility"]

    # Build methodology config
    # Collect D21/D22/D23 overrides from inputs (available for all presets)
    _kd_method = inputs.get("kd_method", "statement_based")
    _kd_credit_rating = inputs.get("kd_credit_rating") or None
    _kd_manual_value = inputs.get("kd_manual_value") if _kd_method == "manual" else None
    _capm_tax_enabled = inputs.get("capm_tax_enabled", False)
    _abgeltungsteuer_rate = inputs.get("abgeltungsteuer_rate", 0.26375)
    _capm_tax_for_wacc = inputs.get("capm_tax_for_wacc", False)
    _beta_debt = inputs.get("beta_debt", 0.0)

    if inputs["preset_key"] == "custom":
        from src.domain.methodology import MethodologyConfig as MC
        config = MC(
            preset="custom",
            rf_method=inputs["rf_method"],
            erp_source=inputs["erp_source"],
            erp_value=inputs["erp"],
            erp_range_low=inputs["erp_range_low"],
            erp_range_high=inputs["erp_range_high"],
            beta_lookback_years=inputs["beta_lookback_years"],
            beta_frequency=inputs["beta_frequency"],
            beta_adjustment=inputs["beta_adjustment"],
            market_index="^GDAXI",
            unlever_formula=inputs["unlever_formula"],
            tax_rate_method=inputs["tax_rate_method"],
            rf_horizon_years=inputs["rf_horizon_years"],
            damodaran_crp_lambda=inputs["damodaran_crp_lambda"],
            peer_currency_policy=inputs["peer_currency_policy"],
            financial_peer_policy=inputs["financial_peer_policy"],
            target_de_policy=inputs.get("target_de_policy", "current"),
            target_de_ratio=inputs.get("target_de_ratio"),
            kd_method=_kd_method,
            kd_credit_rating=_kd_credit_rating,
            kd_manual_value=_kd_manual_value,
            capm_tax_enabled=_capm_tax_enabled,
            abgeltungsteuer_rate=_abgeltungsteuer_rate,
            capm_tax_for_wacc=_capm_tax_for_wacc,
            beta_debt=_beta_debt,
        )
    else:
        config = MethodologyConfig.from_yaml_preset(inputs["preset_key"])
        config = config.model_copy(update={
            "erp_value": inputs["erp"],
            "kd_method": _kd_method,
            "kd_credit_rating": _kd_credit_rating,
            "kd_manual_value": _kd_manual_value,
            "capm_tax_enabled": _capm_tax_enabled,
            "abgeltungsteuer_rate": _abgeltungsteuer_rate,
            "capm_tax_for_wacc": _capm_tax_for_wacc,
            "beta_debt": _beta_debt,
            "target_de_policy": inputs.get("target_de_policy", "current"),
            "target_de_ratio": inputs.get("target_de_ratio"),
        })

    country_code = inputs.get("country_code", "DE")
    provider = YFinancePriceProvider()
    fetcher = eng["DataFetcher"]()
    financials_svc = eng["FinancialsService"]()
    peer_results = []
    ledger = AuditLedger()

    # Placeholder subject for internal consistency
    subject = SubjectProfile(
        company_name="Peer Group Composite",
        company_type="private",
        country_code=country_code,
        primary_currency="EUR",
        capital_structure=CapitalStructure(
            ticker="GROUP_COMPOSITE",
            market_equity=Decimal("1000000000"),
            total_debt=Decimal("0"), 
            as_of_date=date.today(),
            currency="EUR",
            equity_basis="book",
            data_source="manual",
        ),
        effective_tax_rate=0.295,
        tax_rate_source="manual",
    )

    rf_provider = eng["get_rf_provider"](country_code)
    params_series = rf_provider.fetch_params_series()
    rf = eng["get_rf_idw"](params_series, maturity=config.rf_horizon_years)

    # Cache for Rf curves to avoid redundant fetches
    rf_cache = {}

    for peer in inputs["peer_data"]:
        p_country = peer.get("country_code", "US")
        if p_country not in rf_cache:
            try:
                rp = eng["get_rf_provider"](p_country)
                ps = rp.fetch_params_series()
                rf_cache[p_country] = eng["get_rf_idw"](ps, maturity=config.rf_horizon_years)
            except:
                rf_cache[p_country] = rf # Fallback to main target Rf

        peer_results.append(_build_peer_result(
            ticker=peer["ticker"],
            market_index=peer["index_ticker"] or "^GDAXI",
            config=config,
            provider=provider,
            fetcher=fetcher,
            cleaner_fn=eng["clean_returns"],
            financials_svc=financials_svc,
            beta_fn=eng["compute_ols_beta"],
            unlever_fn=eng["unlever_beta"],
            PeerResult=PeerResult,
            PeerEligibility=PeerEligibility,
            is_financial_sector=eng["is_financial_sector"],
            ledger=ledger,
            local_rf=rf_cache[p_country],
            erp=inputs["erp"],
        ))

    return eng["build_capm_result"](
        subject=subject,
        peers=peer_results,
        rf=rf,
        erp=inputs["erp"],
        methodology=config,
        ledger=ledger,
    )


def _build_peer_result(ticker, market_index, config, provider, fetcher, cleaner_fn, financials_svc,
                       beta_fn, unlever_fn, PeerResult, PeerEligibility, is_financial_sector, ledger, local_rf, erp):
    try:
        df, _ = fetcher.fetch_and_cache(
            tickers=[ticker],
            market_index=market_index,
            lookback_years=config.beta_lookback_years,
            frequency=config.beta_frequency,
            provider=provider,
        )
        log_returns, _ = cleaner_fn(df, config.beta_frequency, market_index)
        if ticker not in log_returns.columns:
            raise ValueError(f"Ticker {ticker} not in returns.")
        stock_ret = log_returns[ticker].dropna()
        market_ret = log_returns[market_index].dropna()
        beta_result = beta_fn(
            stock_returns=stock_ret,
            market_returns=market_ret,
            ticker=ticker,
            market_index=market_index,
            period_start=log_returns.index[0].date(),
            period_end=log_returns.index[-1].date(),
            ledger=ledger,
        )
        cap_struct = financials_svc.fetch_capital_structure(ticker, provider)
        tax_rate, tax_source = financials_svc.fetch_tax_rate(ticker, provider)
        info = provider.fetch_ticker_info(ticker)
        gics = info.get("gics_industry")
        if is_financial_sector(gics):
            return PeerResult(
                ticker=ticker,
                eligibility=PeerEligibility(ticker=ticker, eligible=False, reason="financial_sector",
                                            note=f"GICS '{gics}' excluded per D11."),
                beta=beta_result, capital_structure=cap_struct,
                tax_rate=tax_rate, tax_rate_source=tax_source, unlevered_beta=None,
                rf=local_rf, ke=None
            )
        
        u_beta = unlever_fn(beta_result.value, cap_struct.debt_to_equity, tax_rate, ledger)
        # Compute local Ke for this peer
        local_ke = local_rf + beta_result.value * (erp / 100.0)

        return PeerResult(
            ticker=ticker,
            eligibility=PeerEligibility(ticker=ticker, eligible=True, reason="ok"),
            beta=beta_result, capital_structure=cap_struct,
            tax_rate=tax_rate, tax_rate_source=tax_source,
            unlevered_beta=u_beta,
            rf=local_rf,
            ke=local_ke
        )
    except Exception as exc:
        logger.warning("Peer %s failed: %s", ticker, exc)
        return PeerResult(
            ticker=ticker,
            eligibility=PeerEligibility(ticker=ticker, eligible=False, reason="missing_data",
                                        note=str(exc)[:200]),
            beta=None, capital_structure=None,
            tax_rate=None, tax_rate_source=None, unlevered_beta=None,
        )


# ===========================================================================
# REPORT MODE
# ===========================================================================

def render_report_mode():
    st.markdown(f"<style>{REPORT_MODE_CSS}</style>", unsafe_allow_html=True)

    result = st.session_state.get("result")
    inputs = st.session_state.get("inputs", {})
    if result is None:
        st.error("No result found. Return to configuration.")
        if st.button("← Back to Configuration"):
            st.session_state["mode"] = "config"
            st.rerun()
        return

    m = result.methodology
    subject = result.subject

    # ── D26: Audit flag banners — shown at top before anything else ───────────
    if hasattr(result, "audit") and result.audit is not None:
        all_flags = [f for entry in result.audit.entries for f in entry.flags]
        if all_flags:
            st.warning("**Audit Flags Detected** — Review before delivering to client:")
            for flag in all_flags:
                st.warning(f"⚠ {flag}")
        for override in result.audit.overrides:
            st.info(f"ℹ Override applied: {override['rule']} — {override['justification']}")

    # ── Report header ─────────────────────────────────────────────────────────
    st.markdown(
        '<div class="rm-report-header">'
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
        '<div>'
        '<div class="rm-title">Peer Group Analysis</div>'
        f'<div class="rm-company">Composite Analysis Portfolio</div>'
        f'Date: {date.today().isoformat()}'
        '</div>'
        '<div class="rm-confidential">Strictly Confidential<br>CAPM Magic</div>'
        '</div>'
        '</div>',
        unsafe_allow_html=True,
    )

    # ── Hero KPI: Peer Unlevered Beta ──────────────────────────────────────────
    st.markdown(
        '<div class="rm-hero">'
        '<div class="rm-hero-label">Median Unlevered Beta (β<sub>u</sub>)</div>'
        f'<div class="rm-hero-ke">{result.peer_unlevered_beta_median:.4f}</div>'
        f'<div class="rm-hero-formula">'
        f'Derived from &nbsp;<span>{len(result.eligible_peers)}</span>&nbsp; pure-play peers &nbsp;·&nbsp; '
        f'Adjustment: &nbsp;<span>{m.beta_adjustment.title()}</span>'
        '</div>'
        '</div>',
        unsafe_allow_html=True,
    )

    # ── Supporting KPIs ───────────────────────────────────────────────────────
    rf_source = "Svensson/Bundesbank" if m.rf_method == "svensson_bundesbank" else m.rf_method.upper()
    erp_source_label = "FAUB" if m.erp_source == "faub_current" else "Damodaran"

    # D22 — Show both Ke values when CAPM-Tax is enabled
    if result.ke_tax is not None:
        ke_kpi_html = (
            f'<div class="rm-kpi-cell">'
            f'<div class="rm-kpi-label">Cost of Equity — Standard CAPM</div>'
            f'<div class="rm-kpi-value">{result.ke * 100:.2f}%</div>'
            f'<div class="rm-kpi-source">Rf + β<sub>u</sub> × ERP</div>'
            f'</div>'
            f'<div class="rm-kpi-cell">'
            f'<div class="rm-kpi-label">Cost of Equity — CAPM-Tax (s_z={m.abgeltungsteuer_rate*100:.3f}%)</div>'
            f'<div class="rm-kpi-value" style="font-size:1.4rem">{result.ke_tax * 100:.2f}%</div>'
            f'<div class="rm-kpi-source">IDW S1 Phase 2 — Abgeltungsteuer adjusted</div>'
            f'</div>'
        )
    else:
        ke_kpi_html = (
            f'<div class="rm-kpi-cell">'
            f'<div class="rm-kpi-label">Implied Cost of Equity</div>'
            f'<div class="rm-kpi-value">{result.ke * 100:.2f}%</div>'
            f'<div class="rm-kpi-source">Rf + β<sub>u</sub> × ERP</div>'
            f'</div>'
        )

    # D21 — WACC KPI alongside Ke when wacc_result is available
    if result.wacc_result is not None:
        wacc = result.wacc_result
        wacc_kpi_html = (
            f'<div class="rm-kpi-cell">'
            f'<div class="rm-kpi-label">WACC</div>'
            f'<div class="rm-kpi-value" style="font-size:1.4rem">{wacc.wacc * 100:.2f}%</div>'
            f'<div class="rm-kpi-source">(E/V)×Ke + (D/V)×Kd×(1−T)</div>'
            f'</div>'
        )
    else:
        wacc_kpi_html = ""

    st.markdown(
        '<div class="rm-kpi-grid">'
        f'<div class="rm-kpi-cell"><div class="rm-kpi-label">Risk-Free Rate (Rf)</div>'
        f'<div class="rm-kpi-value">{result.rf * 100:.3f}%</div>'
        f'<div class="rm-kpi-source">{rf_source} · {int(m.rf_horizon_years)}Y</div></div>'
        f'<div class="rm-kpi-cell"><div class="rm-kpi-label">Equity Risk Premium</div>'
        f'<div class="rm-kpi-value">{result.erp * 100:.2f}%</div>'
        f'<div class="rm-kpi-source">{erp_source_label} · {m.erp_range_low:.1f}–{m.erp_range_high:.1f}%</div></div>'
        + ke_kpi_html
        + wacc_kpi_html
        + f'<div class="rm-kpi-cell"><div class="rm-kpi-label">Peer Sample Size</div>'
        f'<div class="rm-kpi-value">{len(result.peers)}</div>'
        f'<div class="rm-kpi-source">{len(result.eligible_peers)} eligible peers</div></div>'
        '</div>',
        unsafe_allow_html=True,
    )

    # ── Compliance badges ─────────────────────────────────────────────────────
    badges_html = '<div class="rm-badges">'
    if m.preset == "idw_s1_standard":
        badges_html += '<span class="rm-badge">✓ IDW S1 Compliant</span>'
    badges_html += f'<span class="rm-badge">Rf: {rf_source}</span>'
    badges_html += f'<span class="rm-badge">ERP: {erp_source_label} {result.erp*100:.1f}%</span>'
    badges_html += f'<span class="rm-badge">{m.beta_adjustment.title()} β Adjustment</span>'
    badges_html += f'<span class="rm-badge">{m.unlever_formula.title()} Unlevering</span>'
    for w in m.validation_warnings:
        badges_html += f'<span class="rm-badge warning">⚠ Methodology Warning</span>'
        break
    badges_html += '</div>'
    st.markdown(badges_html, unsafe_allow_html=True)

    # ── Methodology warnings ───────────────────────────────────────────────────
    for w in m.validation_warnings:
        st.markdown(f'<div class="rm-warning">{w}</div>', unsafe_allow_html=True)

    # ── Peer Group Summary ────────────────────────────────────────────────────
    st.markdown('<div class="rm-section">Peer Group Analysis Summary</div>', unsafe_allow_html=True)
    ke_tax_row = ""
    if result.ke_tax is not None:
        ke_tax_row = (
            f'<tr><td>Ke_tax (CAPM-Tax)</td>'
            f'<td>IDW S1 Phase 2 — Abgeltungsteuer s_z={m.abgeltungsteuer_rate*100:.3f}%</td>'
            f'<td class="value">{result.ke_tax * 100:.3f}%</td></tr>'
        )
    st.markdown(
        '<table class="rm-waterfall">'
        '<thead><tr><th>Component</th><th>Description</th><th style="text-align:right">Value</th></tr></thead>'
        '<tbody>'
        f'<tr><td>Median Peer Unlevered Beta (β_u)</td><td>Central estimate for industry risk</td>'
        f'<td class="value">{result.peer_unlevered_beta_median:.4f}</td></tr>'
        f'<tr><td>Risk-Free Rate (Rf)</td><td>{rf_source} · {int(m.rf_horizon_years)}Y</td>'
        f'<td class="value">{result.rf * 100:.3f}%</td></tr>'
        f'<tr><td>Equity Risk Premium (ERP)</td><td>{erp_source_label} · range {m.erp_range_low:.1f}–{m.erp_range_high:.1f}%</td>'
        f'<td class="value">{result.erp * 100:.2f}%</td></tr>'
        '<tr class="total"><td colspan="2"><strong>Implied Unlevered Cost of Equity &nbsp; Ke<sub>u</sub> = Rf + β<sub>u</sub> × ERP</strong></td>'
        f'<td class="value"><strong>{result.ke * 100:.3f}%</strong></td></tr>'
        + ke_tax_row
        + '</tbody></table>',
        unsafe_allow_html=True,
    )

    # ── Peer Group Details ────────────────────────────────────────────────────
    st.markdown('<div class="rm-section">Peer Detail Breakdown</div>', unsafe_allow_html=True)
    _render_peer_table(result)

    # ── D27: Results table export ─────────────────────────────────────────────
    if st.button(
        "COPY RESULTS TABLE (Excel/TSV)" if not st.session_state["show_results_export"] else "▲ HIDE RESULTS TABLE",
        key="toggle_results_export", type="secondary",
    ):
        st.session_state["show_results_export"] = not st.session_state["show_results_export"]
        st.rerun()
    if st.session_state["show_results_export"]:
        st.code(_build_results_tsv(result.peers), language=None)
        st.caption("Excel: Ctrl+V into any cell.  Word/PPT: paste into Excel first, select the range, copy, then paste into Word/PPT as a table.")

    # ── Sensitivity ────────────────────────────────────────────────────────────
    st.markdown('<div class="rm-section">Sensitivity Analysis — Ke<sub>u</sub> vs. ERP × β<sub>u</sub></div>', unsafe_allow_html=True)
    _render_sensitivity(result)

    # ── Methodology parameters ─────────────────────────────────────────────────
    st.markdown('<div class="rm-section">Methodology Parameters</div>', unsafe_allow_html=True)
    _render_methodology_params(result)

    # ── Audit trail ────────────────────────────────────────────────────────────
    st.markdown('<div class="rm-section">Audit Trail</div>', unsafe_allow_html=True)
    _render_audit_trail(result)

    # ── Sticky footer spacer ──────────────────────────────────────────────────
    st.markdown('<div class="rm-page-end"></div>', unsafe_allow_html=True)

    # ── Actions ───────────────────────────────────────────────────────────────
    col_back, col_dl = st.columns([1, 2])
    with col_back:
        if st.button("← Back to Configuration", use_container_width=True):
            st.session_state["mode"] = "config"
            st.rerun()
    with col_dl:
        try:
            eng = _load_engine_modules()
            build_workbook = eng["build_workbook"]
            analyst = st.session_state.get("inputs", {}).get("analyst_name", "Analyst")
            workbook_bytes = build_workbook(result, analyst)
            fname = f"PeerGroup_Analysis_{date.today().isoformat()}.xlsx"
            st.download_button(
                label="↓  Download Excel Workbook",
                data=workbook_bytes,
                file_name=fname,
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                type="primary",
            )
        except Exception as exc:
            st.error(f"Workbook generation failed: {exc}")


# ---------------------------------------------------------------------------
# Report sub-components
# ---------------------------------------------------------------------------

def _render_peer_table(result):
    html = """
    <table class="rm-waterfall">
        <thead>
            <tr>
                <th style="width:10%">Ticker</th>
                <th style="width:12%; text-align:right">Beta (Adj)</th>
                <th style="width:12%; text-align:right">D/E Ratio</th>
                <th style="width:12%; text-align:right">Rf (Local)</th>
                <th style="width:12%; text-align:right">Ke (Local)</th>
                <th style="width:12%; text-align:right">Unlev. Beta</th>
                <th style="width:30%">Status / Reason</th>
            </tr>
        </thead>
        <tbody>
    """
    for peer in sorted(result.peers, key=lambda p: (not p.eligibility.eligible, p.ticker)):
        beta_l = peer.beta.adjusted_beta if peer.beta else None
        de = peer.capital_structure.de_ratio if peer.capital_structure else None
        ub = peer.unlevered_beta
        rf_l = peer.rf
        ke_l = peer.ke
        status = "Eligible" if peer.eligibility.eligible else f"Excluded: {peer.eligibility.reason}"
        
        row_style = "" if peer.eligibility.eligible else "opacity: 0.5; background: #FDFDFD;"
        
        html += f"""
            <tr style="{row_style}">
                <td style="font-weight:700">{peer.ticker}</td>
                <td class="value">{f"{beta_l:.4f}" if beta_l is not None else "—"}</td>
                <td class="value">{f"{de:.3f}" if de is not None else "—"}</td>
                <td class="value">{f"{rf_l*100:.2f}%" if rf_l is not None else "—"}</td>
                <td class="value">{f"{ke_l*100:.2f}%" if ke_l is not None else "—"}</td>
                <td class="value" style="font-weight:700; color:#1A1C1E">{f"{ub:.4f}" if ub is not None else "—"}</td>
                <td style="font-size:0.75rem; color:#606770">{status}</td>
            </tr>
        """
    html += "</tbody></table>"
    st.markdown(html, unsafe_allow_html=True)


def _render_sensitivity(result):
    beta_central = result.relevered_beta
    erp_central = result.erp
    beta_steps = [beta_central - 0.10, beta_central - 0.05, beta_central, beta_central + 0.05, beta_central + 0.10]
    erp_steps = [0.055, 0.060, 0.065, 0.070, 0.075, 0.080]

    header = '<table class="rm-waterfall"><thead><tr><th style="border-right:2px solid #1A1C1E">Beta / ERP</th>'
    for e in erp_steps:
        header += f'<th style="text-align:right">{e*100:.1f}%</th>'
    header += '</tr></thead><tbody>'
    rows_html = ""
    for b in beta_steps:
        rows_html += f'<tr><td style="font-weight:800; border-right:2px solid #1A1C1E">{b:.4f}</td>'
        for e in erp_steps:
            ke = result.rf + b * e
            is_central = abs(b - beta_central) < 0.001 and abs(e - erp_central) < 0.001
            
            # Highlight central and outliers
            cell_style = "text-align:right; font-family:monospace;"
            if is_central:
                cell_style += "background:#1A1C1E; color:#FFF; font-weight:800;"
            
            rows_html += f'<td style="{cell_style}">{ke*100:.2f}%</td>'
        rows_html += '</tr>'
    st.markdown(header + rows_html + '</tbody></table>', unsafe_allow_html=True)


def _render_methodology_params(result):
    m = result.methodology
    params = [
        ("Preset", m.preset.replace("_", " ").title()),
        ("Rf Method", m.rf_method),
        ("Rf Horizon", f"{m.rf_horizon_years:.0f}Y"),
        ("ERP Source", m.erp_source),
        ("ERP Value", f"{m.erp_value:.2f}%"),
        ("ERP Range", f"{m.erp_range_low:.1f}% – {m.erp_range_high:.1f}%"),
        ("Beta Lookback", f"{m.beta_lookback_years}Y"),
        ("Beta Frequency", m.beta_frequency),
        ("Beta Adjustment", m.beta_adjustment),
        ("Unlever Formula", m.unlever_formula),
        ("Tax Rate Method", m.tax_rate_method),
        ("Peer Currency Policy", m.peer_currency_policy),
        ("Financial Peer Policy", m.financial_peer_policy),
    ]
    html = '<table class="rm-waterfall"><tbody>'
    for label, val in params:
        html += f'<tr><td style="font-weight:700; width:40%">{label}</td><td class="value">{val}</td></tr>'
    html += '</tbody></table>'
    st.markdown(html, unsafe_allow_html=True)


def _render_audit_trail(result):
    if not hasattr(result, "audit") or result.audit is None:
        st.caption("No audit entries available.")
        return
    entries = getattr(result.audit, "entries", [])
    if not entries:
        st.caption("Audit ledger is empty.")
        return
    html = (
        '<table class="rm-waterfall">'
        '<thead><tr><th>Step</th><th>Formula</th><th style="text-align:right">Output</th><th>Source</th></tr></thead>'
        '<tbody>'
    )
    for entry in entries:
        out = entry.output.scalar if hasattr(entry.output, "scalar") else str(entry.output)
        html += (
            f'<tr><td style="font-weight:700">{entry.step}</td><td style="font-family:monospace; font-size:0.75rem">{entry.formula}</td>'
            f'<td class="value">{out}</td><td style="font-size:0.7rem">{entry.source}</td></tr>'
        )
    html += '</tbody></table>'
    st.markdown(html, unsafe_allow_html=True)


# ===========================================================================
# Entry point
# ===========================================================================

if st.session_state["mode"] == "config":
    render_config_mode()
else:
    render_report_mode()
