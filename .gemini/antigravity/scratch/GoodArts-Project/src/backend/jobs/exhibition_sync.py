"""
GoodArts - Exhibition Sync Job
Polls Artsy for exhibitions in user's configured cities.
"""
import aiosqlite
from src.backend.config import settings
from src.backend.database import crud
from src.backend.clients.artsy import fetch_exhibitions


async def sync_exhibitions(db: aiosqlite.Connection):
    """Fetch exhibitions from Artsy for user's home (and temp) city."""
    s = await crud.get_settings(db)
    cities = [s.get("home_city", settings.DEFAULT_CITY)]
    if s.get("temp_city"):
        cities.append(s["temp_city"])

    for city in cities:
        shows = await fetch_exhibitions(city=city, status="current")
        for show in shows:
            existing = await db.execute(
                "SELECT id FROM exhibitions WHERE source='artsy' AND source_id=?",
                (show.get("source_id"),),
            )
            if await existing.fetchone():
                continue
            await crud.create_exhibition(db, show)

    await crud.update_settings(db, {"last_exhibition_sync": "CURRENT_TIMESTAMP"})
