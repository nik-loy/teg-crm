"""Shared test fixtures for GoodArts backend."""
import pytest
import pytest_asyncio
import aiosqlite
from unittest.mock import AsyncMock, MagicMock
from src.backend.database.migrations import SCHEMA


@pytest_asyncio.fixture
async def db():
    """In-memory SQLite database with full schema."""
    async with aiosqlite.connect(":memory:") as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.executescript(SCHEMA)
        await conn.commit()
        yield conn


@pytest.fixture
def mock_httpx_client():
    """Configurable mock for httpx.AsyncClient context manager."""
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    def configure(json_response, status_code=200):
        mock_resp = MagicMock()
        mock_resp.json.return_value = json_response
        mock_resp.status_code = status_code
        mock_resp.raise_for_status = MagicMock()
        if status_code >= 400:
            mock_resp.raise_for_status.side_effect = Exception(f"HTTP {status_code}")
        mock_client.get.return_value = mock_resp
        mock_client.post.return_value = mock_resp

    mock_client.configure = configure
    return mock_client
