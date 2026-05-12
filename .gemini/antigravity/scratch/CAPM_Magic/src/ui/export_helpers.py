"""
Pure-function export helpers for the CAPM Magic dashboard (D27, D28).
No Streamlit dependency — fully testable in isolation.
"""
from __future__ import annotations


# ---------------------------------------------------------------------------
# D27 — Copy/export format builders
# ---------------------------------------------------------------------------

def build_ticker_list(peers: list[dict]) -> str:
    """Newline-separated ticker list for Bloomberg/Excel column/Word list paste."""
    return "\n".join(p["ticker"] for p in peers)


def build_config_tsv(peers: list[dict]) -> str:
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


def build_results_tsv(peers: list) -> str:
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


# ---------------------------------------------------------------------------
# D28 — Ticker suggestion engine
# ---------------------------------------------------------------------------

def search_ticker_suggestions(bare_ticker: str) -> list[dict]:
    """
    Returns up to 5 equity suggestions from yfinance.Search for bare tickers.
    Only called when ticker has no '.' suffix and direct enrichment failed.
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
