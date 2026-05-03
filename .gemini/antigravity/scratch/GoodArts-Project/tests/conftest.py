"""Shared test fixtures for GoodArts backend."""
import pytest
import pytest_asyncio
import aiosqlite
from unittest.mock import AsyncMock, MagicMock
from src.backend.database.migrations import SCHEMA


@pytest_asyncio.fixture
async def db():
    """In-memory SQLite database with full schema (mirrors run_migrations)."""
    async with aiosqlite.connect(":memory:") as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.executescript(SCHEMA)

        # Mirror all procedural ALTER TABLE steps from run_migrations()

        # 1. Add normalized_city to exhibitions
        try:
            await conn.execute("ALTER TABLE exhibitions ADD COLUMN normalized_city TEXT")
        except Exception:
            pass

        # 2. Add unique index to user_exhibitions(exhibition_id)
        try:
            await conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_exh_eid_unique "
                "ON user_exhibitions(exhibition_id)"
            )
        except Exception:
            pass

        # 3. Add extra taste_profile columns
        for col, typ in [
            ("last_rating_at", "TIMESTAMP"),
            ("sentiment_sum", "REAL DEFAULT 0.0"),
        ]:
            try:
                await conn.execute(f"ALTER TABLE taste_profile ADD COLUMN {col} {typ}")
            except Exception:
                pass

        # 4. Extra artworks columns
        for col, typ in [
            ("thumbnail_path", "TEXT"),
            ("dominant_color", "TEXT"),
            ("source_id", "TEXT"),
        ]:
            try:
                await conn.execute(f"ALTER TABLE artworks ADD COLUMN {col} {typ}")
            except Exception:
                pass

        # 5. user_settings extra column
        try:
            await conn.execute(
                "ALTER TABLE user_settings ADD COLUMN cma_fetch_offset INTEGER DEFAULT 0"
            )
        except Exception:
            pass

        # 6. (Deferred) Populate normalized_city — mirrors run_migrations() post-seed step
        import unicodedata
        def _norm(s: str) -> str:
            if not s:
                return ""
            return "".join(
                c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn"
            ).lower().strip()

        async with conn.execute(
            "SELECT id, city FROM exhibitions WHERE normalized_city IS NULL AND city IS NOT NULL"
        ) as cur:
            rows = await cur.fetchall()
            for eid, city in rows:
                await conn.execute(
                    "UPDATE exhibitions SET normalized_city=? WHERE id=?", (_norm(city), eid)
                )

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
