"""Unit tests for dashboard export helpers (D27) and suggestion engine (D28)."""
from unittest.mock import MagicMock
import pytest

from src.ui.export_helpers import (
    build_ticker_list as _build_ticker_list,
    build_config_tsv as _build_config_tsv,
    build_results_tsv as _build_results_tsv,
    search_ticker_suggestions as _search_ticker_suggestions,
)


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
    assert _build_config_tsv([]) == _CONFIG_HEADER


def test_config_tsv_header_row():
    peers = [{"ticker": "SAP.DE", "name": "SAP SE", "index_ticker": "^GDAXI",
              "country_code": "DE", "market_cap": 100_000_000, "currency": "EUR", "industry": "Software"}]
    lines = _build_config_tsv(peers).split("\n")
    assert lines[0] == _CONFIG_HEADER


def test_config_tsv_market_cap_formatting():
    peers = [{"ticker": "SAP.DE", "name": "SAP SE", "index_ticker": "^GDAXI",
              "country_code": "DE", "market_cap": 1_500_000_000, "currency": "EUR", "industry": "Software"}]
    row = _build_config_tsv(peers).split("\n")[1].split("\t")
    assert row[4] == "1,500"


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


def test_config_tsv_zero_market_cap_shows_zero():
    peers = [{"ticker": "X.DE", "name": "Co", "index_ticker": "", "country_code": "DE",
              "market_cap": 0, "currency": "EUR", "industry": ""}]
    row = _build_config_tsv(peers).split("\n")[1].split("\t")
    # market_cap=0 is falsy → "—"
    assert row[4] == "—"


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


def test_results_tsv_header_only_when_empty():
    assert _build_results_tsv([]) == _RESULTS_HEADER


def test_results_tsv_header_row():
    lines = _build_results_tsv([_make_peer("SAP.DE")]).split("\n")
    assert lines[0] == _RESULTS_HEADER


def test_results_tsv_beta_four_decimals():
    row = _build_results_tsv([_make_peer("SAP.DE", beta=0.8234)]).split("\n")[1].split("\t")
    assert row[1] == "0.8234"


def test_results_tsv_de_ratio_three_decimals():
    row = _build_results_tsv([_make_peer("SAP.DE", de=0.312)]).split("\n")[1].split("\t")
    assert row[2] == "0.312"


def test_results_tsv_rf_percentage_no_symbol():
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


def test_results_tsv_eligible_peers_sorted_first():
    peers = [
        _make_peer("BANK.DE", eligible=False, reason="financial_sector"),
        _make_peer("SAP.DE", eligible=True),
    ]
    lines = _build_results_tsv(peers).split("\n")
    assert lines[1].split("\t")[0] == "SAP.DE"
    assert lines[2].split("\t")[0] == "BANK.DE"


# ---------------------------------------------------------------------------
# _search_ticker_suggestions (D28)
# ---------------------------------------------------------------------------

def test_search_returns_empty_for_dotted_ticker():
    assert _search_ticker_suggestions("SAP.DE") == []


def test_search_filters_non_equity(monkeypatch):
    mock_quotes = [
        {"symbol": "ABBN.SW", "shortname": "ABB Ltd", "exchange": "EBS", "quoteType": "EQUITY"},
        {"symbol": "ABBN-ETF", "shortname": "ETF", "exchange": "NYSE", "quoteType": "ETF"},
        {"symbol": "ABBN-IDX", "shortname": "Idx", "exchange": "IDX", "quoteType": "INDEX"},
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("ABBN")
    assert len(result) == 1
    assert result[0]["symbol"] == "ABBN.SW"


def test_search_caps_at_five(monkeypatch):
    mock_quotes = [
        {"symbol": f"CO{i}.DE", "shortname": f"Co {i}", "exchange": "GER", "quoteType": "EQUITY"}
        for i in range(10)
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    assert len(_search_ticker_suggestions("CO")) == 5


def test_search_returns_empty_on_exception(monkeypatch):
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", MagicMock(side_effect=Exception("network")))
    assert _search_ticker_suggestions("ABBN") == []


def test_search_result_shape(monkeypatch):
    mock_quotes = [{"symbol": "ABBN.SW", "shortname": "ABB Ltd", "exchange": "EBS", "quoteType": "EQUITY"}]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("ABBN")
    assert result[0] == {"symbol": "ABBN.SW", "shortname": "ABB Ltd", "exchange": "EBS"}


def test_search_falls_back_to_longname(monkeypatch):
    mock_quotes = [{"symbol": "ABBN.SW", "longname": "ABB Ltd Long", "exchange": "EBS", "quoteType": "EQUITY"}]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("ABBN")
    assert result[0]["shortname"] == "ABB Ltd Long"


def test_search_skips_entries_without_symbol(monkeypatch):
    mock_quotes = [
        {"symbol": "", "shortname": "Ghost", "exchange": "GER", "quoteType": "EQUITY"},
        {"symbol": "REAL.DE", "shortname": "Real Co", "exchange": "GER", "quoteType": "EQUITY"},
    ]
    import yfinance as yf
    monkeypatch.setattr(yf, "Search", lambda q, **kw: MagicMock(quotes=mock_quotes))
    result = _search_ticker_suggestions("REAL")
    assert len(result) == 1
    assert result[0]["symbol"] == "REAL.DE"
