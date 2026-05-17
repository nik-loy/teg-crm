"""NexusAlpha main entry point.

Usage:
    python -m nexusalpha
    python -m nexusalpha --config /path/to/config.yaml
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
from datetime import UTC, datetime

from nexusalpha.agents.alerting import AlertingAgent
from nexusalpha.agents.guardian import GuardianAgent
from nexusalpha.agents.ingestion import IngestionAgent
from nexusalpha.agents.orchestrator import OrchestratorAgent
from nexusalpha.agents.scanner import ScannerAgent
from nexusalpha.agents.semantic import SemanticAgent
from nexusalpha.agents.statistical import StatisticalAgent
from nexusalpha.core.config import load_config
from nexusalpha.core.database import NexusDatabase
from nexusalpha.core.event_bus import AsyncEventBus
from nexusalpha.sources.yfinance_source import YFinanceSource

logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="NexusAlpha lead-lag signal detector")
    p.add_argument("--config", default=None, help="Path to config.yaml")
    p.add_argument("--log-level", default="INFO", help="Logging level")
    return p.parse_args()


async def run(config_path: str | None = None) -> None:
    """Start all agents and run until interrupted."""
    config = load_config(config_path)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    db = NexusDatabase(config.database.path)
    await db.initialize()

    # Seed instrument records so FK constraints pass when signals are written
    _now = datetime.now(UTC).isoformat()
    for _sym in (config.universe.phase1_symbols or []):
        await db.write(
            "INSERT OR IGNORE INTO instruments "
            "(symbol, name, asset_class, data_source, is_active, created_at) "
            "VALUES (?, ?, 'equity', 'yfinance', 1, ?)",
            (_sym, _sym, _now),
        )

    bus = AsyncEventBus()

    symbols = config.universe.phase1_symbols or [
        "SPY", "QQQ", "IWM", "XLF", "XLE", "XLK", "ARKK", "SMH",
        "GLD", "SLV", "USO", "GDX", "NVDA", "AAPL", "MSFT", "AMD",
        "AVGO", "JPM", "GS", "XOM", "NEM", "FCX", "TLT", "HYG",
    ]
    # Symbols outside the active universe that ScannerAgent evaluates as candidates.
    _scanner_watchlist = [
        "DIA", "XLV", "XLI", "GOOGL", "AMZN", "META",
        "BAC", "CVX", "LMT", "CAT", "TSLA", "WPM",
    ]
    yf_source = YFinanceSource()

    # Instantiate agents
    ingestion = IngestionAgent(bus, config, sources=[yf_source], symbols=symbols)
    statistical = StatisticalAgent(bus, config)
    orchestrator = OrchestratorAgent(bus, config, db)
    alerting = AlertingAgent(bus, config)
    guardian = GuardianAgent(bus, config, db)
    scanner = ScannerAgent(bus, config, watchlist=_scanner_watchlist, active_universe=symbols)
    semantic = SemanticAgent(bus, config)

    # Start agents (subscribe to events)
    await ingestion.start()
    await statistical.start()
    await orchestrator.start()
    await alerting.start()
    await guardian.start()
    await scanner.start()
    await semantic.start()

    # Start event bus dispatch tasks
    await bus.start()

    logger.info("NexusAlpha started — monitoring %d symbols", len(symbols))

    # Graceful shutdown on SIGINT/SIGTERM
    stop_event = asyncio.Event()

    def _handle_signal(sig: int, frame: object) -> None:
        logger.info("Received signal %d — shutting down", sig)
        stop_event.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    await stop_event.wait()

    logger.info("Stopping NexusAlpha...")
    await ingestion.stop()
    await statistical.stop()
    await orchestrator.stop()
    await alerting.stop()
    await guardian.stop()
    await scanner.stop()
    await semantic.stop()
    await bus.stop()
    await db.close()

    logger.info("NexusAlpha stopped cleanly")


def main() -> None:
    args = _parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper(), logging.INFO))
    try:
        asyncio.run(run(args.config))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
