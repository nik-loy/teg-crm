"""Data Ingestion Agent for NexusAlpha.

Polls DataSource adapters, validates incoming bars, forward-fills short gaps,
and publishes PriceUpdate events. Tracks consecutive failures per source and
publishes SourceDegraded / SourceRecovered events accordingly.

Publishes:  PriceUpdate, SourceDegraded, SourceRecovered, HealthAlert
Subscribes: (none — pipeline entry point)
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from nexusalpha.core.config import Config
from nexusalpha.core.event_bus import AsyncEventBus
from nexusalpha.core.models import (
    HealthAlert,
    PriceUpdate,
    SourceDegraded,
    SourceRecovered,
    StandardBar,
)
from nexusalpha.sources.protocol import DataSource

logger = logging.getLogger(__name__)


class IngestionAgent:
    """Polls data sources and publishes validated PriceUpdate events.

    Usage::

        agent = IngestionAgent(bus, config, sources=[yfinance_src], symbols=["SPY"])
        await agent.start()
        ...
        await agent.stop()
    """

    def __init__(
        self,
        bus: AsyncEventBus,
        config: Config,
        sources: list[DataSource],
        symbols: list[str] | None = None,
    ) -> None:
        self._bus = bus
        self._config = config
        self._sources = sources
        self._cfg = config.agents.ingestion
        self._symbols: list[str] = symbols if symbols is not None else []

        # Per-source consecutive failure counter
        self._failure_counts: dict[str, int] = {}
        # Sources currently in degraded state
        self._degraded_sources: set[str] = set()
        # Last valid bar per (source, symbol) for gap-fill
        self._last_bar: dict[tuple[str, str], StandardBar] = {}

        self._running = False
        self._tasks: list[asyncio.Task[None]] = []

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Begin polling all data sources on their schedules."""
        self._running = True
        if self._symbols and self._sources:
            task = asyncio.create_task(self._poll_all_sources())
            self._tasks.append(task)

    async def stop(self) -> None:
        """Stop all polling loops."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()

    # ------------------------------------------------------------------
    # Background polling
    # ------------------------------------------------------------------

    async def _poll_all_sources(self) -> None:
        """Fetch bars for every symbol from every source, publish PriceUpdates.

        Deduplicates by skipping bars whose timestamp is at or before the last
        seen bar for that (source, symbol) pair. Runs until stop() is called.
        """
        interval = "1m"
        interval_seconds = 60

        while self._running:
            for source in self._sources:
                for symbol in self._symbols:
                    if not self._running:
                        return
                    try:
                        if not await source.supports_symbol(symbol):
                            continue
                        bars = await source.fetch(
                            symbol, interval, self._config.gates.price_window_depth
                        )
                        key = (source.source_name, symbol)
                        last = self._last_bar.get(key)
                        if last is not None:
                            bars = [b for b in bars if b.timestamp > last.timestamp]
                        await self.handle_fetch_success(source.source_name, self._symbols)
                        if bars:
                            await self.process_bars(bars, source.source_name, symbol, interval_seconds)
                    except Exception:
                        logger.exception(
                            "Poll failed: source=%s symbol=%s", source.source_name, symbol
                        )
                        await self.handle_fetch_failure(source.source_name, self._symbols)

            # Sleep in 1-second increments so stop() is responsive
            for _ in range(self._cfg.poll_interval_seconds):
                if not self._running:
                    return
                await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # Bar validation
    # ------------------------------------------------------------------

    def validate_bar(self, bar: StandardBar) -> bool:
        """Return True if bar passes all validation rules.

        Rules:
        - All price fields non-negative
        - high >= max(open, close)
        - low <= min(open, close)
        - volume non-negative
        """
        if bar.open < 0 or bar.high < 0 or bar.low < 0 or bar.close < 0:
            logger.debug("validate_bar: negative price field in %s @ %s", bar.symbol, bar.timestamp)
            return False
        if bar.volume < 0:
            logger.debug("validate_bar: negative volume in %s @ %s", bar.symbol, bar.timestamp)
            return False
        if bar.high < max(bar.open, bar.close):
            logger.debug(
                "validate_bar: high < max(open,close) in %s @ %s", bar.symbol, bar.timestamp
            )
            return False
        if bar.low > min(bar.open, bar.close):
            logger.debug(
                "validate_bar: low > min(open,close) in %s @ %s", bar.symbol, bar.timestamp
            )
            return False
        return True

    # ------------------------------------------------------------------
    # Gap filling
    # ------------------------------------------------------------------

    def forward_fill(
        self,
        last_bar: StandardBar,
        next_timestamp: datetime,
        interval_seconds: int,
    ) -> list[StandardBar]:
        """Generate forward-filled bars to bridge a gap.

        Returns up to max_forward_fill filled bars between last_bar.timestamp
        and next_timestamp. If the gap exceeds max_forward_fill bars, returns
        an empty list (caller must publish a HealthAlert).

        All filled bars carry: is_filled=True, volume=0.0, and OHLCV all equal
        to last_bar.close.
        """
        delta = timedelta(seconds=interval_seconds)
        filled: list[StandardBar] = []
        ts = last_bar.timestamp + delta

        while ts < next_timestamp:
            if len(filled) >= self._cfg.max_forward_fill:
                # Gap too large — signal caller to alert
                return []
            filled.append(
                StandardBar(
                    symbol=last_bar.symbol,
                    timestamp=ts,
                    open=last_bar.close,
                    high=last_bar.close,
                    low=last_bar.close,
                    close=last_bar.close,
                    volume=0.0,
                    source=last_bar.source,
                    is_filled=True,
                )
            )
            ts += delta

        return filled

    # ------------------------------------------------------------------
    # Core bar processing
    # ------------------------------------------------------------------

    async def process_bars(
        self,
        bars: list[StandardBar],
        source_name: str,
        symbol: str,
        interval_seconds: int,
    ) -> None:
        """Validate, gap-fill, and publish each bar.

        Skips publishing if the source is currently degraded.
        """
        if source_name in self._degraded_sources:
            logger.debug(
                "process_bars: source %s is degraded — skipping %d bars for %s",
                source_name,
                len(bars),
                symbol,
            )
            return

        key = (source_name, symbol)

        for bar in bars:
            # Check for gap using this bar's timestamp BEFORE validation,
            # so a large gap triggers a HealthAlert even if the new bar is invalid.
            last = self._last_bar.get(key)
            if last is not None and bar.timestamp > last.timestamp + timedelta(
                seconds=interval_seconds
            ):
                gap_bars = self.forward_fill(last, bar.timestamp, interval_seconds)
                if not gap_bars:
                    # Gap exceeds max_forward_fill — alert
                    gap_count = (
                        int((bar.timestamp - last.timestamp).total_seconds() / interval_seconds) - 1
                    )
                    await self._bus.publish(
                        HealthAlert(
                            agent_name="ingestion",
                            event_type="warning",
                            message=(
                                f"Large gap ({gap_count} bars) detected for {symbol} "
                                f"between {last.timestamp} and {bar.timestamp}"
                            ),
                            timestamp=datetime.now(UTC),
                        )
                    )
                else:
                    for filled_bar in gap_bars:
                        await self._bus.publish(PriceUpdate(bar=filled_bar))

            if not self.validate_bar(bar):
                logger.warning(
                    "process_bars: invalid bar dropped for %s @ %s",
                    bar.symbol,
                    bar.timestamp,
                )
                continue

            self._last_bar[key] = bar
            await self._bus.publish(PriceUpdate(bar=bar))

    # ------------------------------------------------------------------
    # Failure / recovery tracking
    # ------------------------------------------------------------------

    async def handle_fetch_failure(
        self,
        source_name: str,
        symbols: list[str],
    ) -> None:
        """Record a fetch failure; degrade source after threshold consecutive failures."""
        count = self._failure_counts.get(source_name, 0) + 1
        self._failure_counts[source_name] = count
        logger.warning(
            "handle_fetch_failure: source=%s consecutive_failures=%d", source_name, count
        )

        threshold = self._cfg.consecutive_failures_to_degrade
        if count >= threshold and source_name not in self._degraded_sources:
            self._degraded_sources.add(source_name)
            logger.error("handle_fetch_failure: degrading source %s", source_name)
            await self._bus.publish(
                SourceDegraded(
                    source=source_name,
                    affected_symbols=list(symbols),
                    timestamp=datetime.now(UTC),
                )
            )

    async def handle_fetch_success(
        self,
        source_name: str,
        symbols: list[str],
    ) -> None:
        """Record a successful fetch; recover source if it was degraded."""
        was_degraded = source_name in self._degraded_sources
        self._failure_counts[source_name] = 0
        self._degraded_sources.discard(source_name)

        if was_degraded:
            logger.info("handle_fetch_success: source %s recovered", source_name)
            await self._bus.publish(
                SourceRecovered(
                    source=source_name,
                    recovered_symbols=list(symbols),
                    timestamp=datetime.now(UTC),
                )
            )
