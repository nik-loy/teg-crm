"""
GoodArts - Exhibition Sync Job
Polls Artsy and Museum RSS feeds for exhibitions.
"""
import aiosqlite
import feedparser
import httpx
from src.backend.config import settings
from src.backend.database import crud
from src.backend.clients.artsy import fetch_exhibitions


async def sync_exhibitions(db: aiosqlite.Connection, city: str = None):
    """Fetch exhibitions from Artsy for a city or the user's configured cities."""
    if city:
        cities = [city]
    else:
        s = await crud.get_settings(db)
        cities = [s.get("home_city", settings.DEFAULT_CITY)]
        if s.get("temp_city"):
            cities.append(s["temp_city"])

    new_count = 0
    for city_name in cities:
        shows = await fetch_exhibitions(city=city_name, status="current")
        for show in shows:
            existing = await db.execute(
                "SELECT id FROM exhibitions WHERE source='artsy' AND source_id=?",
                (show.get("source_id"),),
            )
            if await existing.fetchone():
                continue
            
            # Create the exhibition
            await crud.create_exhibition(db, show)
            new_count += 1

    # Also sync RSS feeds if doing a full sync
    if not city:
        new_count += await sync_rss_feeds(db)

    if not city:
        await crud.update_settings(db, {"last_exhibition_sync": "CURRENT_TIMESTAMP"})
    
    return new_count


# Known city for each configured RSS feed domain
_RSS_FEED_CITY: dict[str, tuple[str, str]] = {
    "tate.org.uk":         ("London",   "UK"),
    "moma.org":            ("New York",  "USA"),
    "britishmuseum.org":   ("London",   "UK"),
    "metmuseum.org":       ("New York",  "USA"),
    "louvre.fr":           ("Paris",    "France"),
    "rijksmuseum.nl":      ("Amsterdam","Netherlands"),
    "guggenheim.org":      ("New York",  "USA"),
}


def _city_for_feed_url(url: str) -> tuple[str | None, str | None]:
    """Return (city, country) for a feed URL, or (None, None) if unknown."""
    for domain, (city, country) in _RSS_FEED_CITY.items():
        if domain in url:
            return city, country
    return None, None


async def sync_rss_feeds(db: aiosqlite.Connection) -> int:
    """Fetch exhibitions from configured museum RSS feeds."""
    new_count = 0
    for url in settings.MUSEUM_RSS_FEEDS:
        feed_city, feed_country = _city_for_feed_url(url)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                feed = feedparser.parse(resp.text)

            for entry in feed.entries:
                source_id = entry.get("id") or entry.get("link")
                if not source_id:
                    continue

                existing = await db.execute(
                    "SELECT id FROM exhibitions WHERE source='rss' AND source_id=?",
                    (source_id,),
                )
                if await existing.fetchone():
                    continue

                show = {
                    "title": entry.get("title", "Untitled Show"),
                    "description": entry.get("summary", ""),
                    "venue_name": feed.feed.get("title", "Museum"),
                    "city": feed_city,      # now populated from mapping
                    "country": feed_country,
                    "start_date": None,
                    "end_date": None,
                    "image_url": None,
                    "source": "rss",
                    "source_id": source_id,
                    "url": entry.get("link"),
                }

                # Attempt to find images in common RSS locations
                if "media_content" in entry:
                    show["image_url"] = entry["media_content"][0].get("url")
                elif "links" in entry:
                    for link in entry.links:
                        if "image" in link.get("type", ""):
                            show["image_url"] = link.href
                            break

                await crud.create_exhibition(db, show)
                new_count += 1
        except Exception as e:
            print(f"Error syncing RSS feed {url}: {e}")

    return new_count
