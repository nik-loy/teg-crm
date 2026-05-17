"""yfinance DataSource adapter.

Wraps the blocking yfinance.download() call in asyncio.to_thread() so it
never stalls the event loop. Normalizes timestamps from bar-start (yfinance
native) to bar-close UTC by adding the interval duration.

Timestamp normalization rule (from docs/data-model.md):
    yfinance native: bar-START timestamp
    canonical:       bar-START + interval_seconds → bar-CLOSE UTC
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pandas as pd
import yfinance as yf

from nexusalpha.core.models import StandardBar

# ---------------------------------------------------------------------------
# Interval mapping: yfinance interval string → duration in seconds
# ---------------------------------------------------------------------------

_INTERVAL_SECONDS: dict[str, int] = {
    "1m": 60,
    "2m": 120,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
    "1wk": 604800,
}

# Maximum download period per interval (yfinance enforces these limits).
_INTERVAL_PERIOD: dict[str, str] = {
    "1m": "7d",    # yfinance hard limit for 1m granularity
    "2m": "60d",
    "5m": "60d",
    "15m": "60d",
    "30m": "60d",
    "1h": "730d",
    "4h": "730d",
    "1d": "3y",
    "1wk": "10y",
}


class YFinanceSource:
    """DataSource adapter for Yahoo Finance via the yfinance library.

    All returned bars carry:
        source   = "yfinance"
        is_filled = False  (gap filling is the ingestion agent's responsibility)
        timestamp = bar-close UTC (bar-start + interval_seconds)
    """

    source_name: str = "yfinance"

    # ------------------------------------------------------------------
    # Public async API
    # ------------------------------------------------------------------

    async def fetch(
        self,
        symbol: str,
        interval: str,
        limit: int,
    ) -> list[StandardBar]:
        """Fetch up to *limit* bars and return them as normalized StandardBars.

        Raises:
            ValueError: if *interval* is not in _INTERVAL_SECONDS.
        """
        if interval not in _INTERVAL_SECONDS:
            raise ValueError(
                f"Unsupported interval '{interval}'. Supported: {sorted(_INTERVAL_SECONDS)}"
            )
        df = await asyncio.to_thread(self._download, symbol, interval, limit)
        return self._to_bars(df, symbol, interval)

    async def supports_symbol(self, symbol: str) -> bool:
        """yfinance supports all US equity, ETF, and major index symbols."""
        return True

    # ------------------------------------------------------------------
    # Blocking helper — runs inside asyncio.to_thread()
    # ------------------------------------------------------------------

    def _download(self, symbol: str, interval: str, limit: int) -> pd.DataFrame:
        """Call yfinance.download() synchronously.

        This method is intended to be called via asyncio.to_thread() only.
        Never call it directly from an async context.
        """
        period = _INTERVAL_PERIOD.get(interval, "60d")
        return yf.download(
            symbol,
            period=period,
            interval=interval,
            progress=False,
            auto_adjust=True,
        )

    # ------------------------------------------------------------------
    # Normalization
    # ------------------------------------------------------------------

    def _to_bars(
        self,
        df: pd.DataFrame,
        symbol: str,
        interval: str,
    ) -> list[StandardBar]:
        """Convert a yfinance DataFrame to a list of StandardBar objects.

        Handles both flat column DataFrames (single ticker) and MultiIndex
        column DataFrames (yfinance sometimes wraps columns as (field, ticker)).

        Timestamp shift: add interval_seconds to each bar-start index entry so
        that the resulting timestamp represents bar-close UTC.
        """
        if df.empty:
            return []

        # Flatten MultiIndex columns if present (e.g., ("Open", "AAPL") → "Open")
        if isinstance(df.columns, pd.MultiIndex):
            df = df.droplevel(level=1, axis=1)

        interval_delta = timedelta(seconds=_INTERVAL_SECONDS[interval])
        bars: list[StandardBar] = []

        for bar_start, row in df.iterrows():
            # bar_start is a pandas Timestamp — convert to UTC-aware datetime
            if hasattr(bar_start, "tzinfo") and bar_start.tzinfo is not None:
                bar_start_utc = bar_start.to_pydatetime().astimezone(UTC)
            else:
                # Treat naive timestamps as UTC (yfinance sometimes omits tz)
                bar_start_utc = bar_start.to_pydatetime().replace(tzinfo=UTC)

            bar_close_utc: datetime = bar_start_utc + interval_delta

            bars.append(
                StandardBar(
                    symbol=symbol,
                    timestamp=bar_close_utc,
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=float(row["Volume"]),
                    source=self.source_name,
                    is_filled=False,
                )
            )

        return bars
