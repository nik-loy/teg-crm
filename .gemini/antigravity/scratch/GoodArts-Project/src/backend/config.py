"""
GoodArts — Configuration
Loads environment variables from .env and exposes typed settings.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent.parent
load_dotenv(ROOT / ".env")


class Settings:
    # -- Paths ---------------------------------------------------------
    ROOT_DIR: Path = ROOT
    DATA_DIR: Path = ROOT / "data"
    DB_PATH: Path = ROOT / "data" / "artlog.db"
    FRONTEND_DIR: Path = ROOT / "src" / "frontend"
    IMAGE_CACHE_DIR: Path = ROOT / "data" / "image_cache"
    UPLOAD_DIR: Path = ROOT / "data" / "uploads"
    THUMBNAIL_WIDTH: int = 300

    # -- API Keys ------------------------------------------------------
    EUROPEANA_API_KEY: str = os.getenv("EUROPEANA_API_KEY", "")
    RIJKSMUSEUM_API_KEY: str = os.getenv("RIJKSMUSEUM_API_KEY", "")
    HARVARD_API_KEY: str = os.getenv("HARVARD_API_KEY", "")
    SMITHSONIAN_API_KEY: str = os.getenv("SMITHSONIAN_API_KEY", "")
    ARTSY_CLIENT_ID: str = os.getenv("ARTSY_CLIENT_ID", "")
    ARTSY_CLIENT_SECRET: str = os.getenv("ARTSY_CLIENT_SECRET", "")

    # -- API Endpoints -------------------------------------------------
    WIKIDATA_SPARQL_URL: str = "https://query.wikidata.org/sparql"
    EUROPEANA_API_URL: str = "https://api.europeana.eu/record/v2/search.json"
    RIJKSMUSEUM_API_URL: str = "https://www.rijksmuseum.nl/api/en/collection"
    HARVARD_API_URL: str = "https://api.harvardartmuseums.org/object"
    ARTIC_API_URL: str = "https://api.artic.edu/api/v1/artworks"
    MET_SEARCH_URL: str = "https://collectionapi.metmuseum.org/public/collection/v1/search"
    MET_OBJECT_URL: str = "https://collectionapi.metmuseum.org/public/collection/v1/objects"
    SMITHSONIAN_API_URL: str = "https://api.si.edu/openaccess/api/v1.0/search"
    ARTSY_API_URL: str = "https://api.artsy.net/api"
    WIKIPEDIA_API_URL: str = "https://en.wikipedia.org/api/rest_v1"
    MEDIAWIKI_API_URL: str = "https://en.wikipedia.org/w/api.php"

    # -- Cache ---------------------------------------------------------
    CACHE_TTL_DAYS: int = 30

    # -- Taste Engine --------------------------------------------------
    BASE_HALF_LIFE_DAYS: int = 90
    CONFIDENCE_THRESHOLD: int = 20
    DIMENSION_WEIGHTS: dict = {
        "movement": 3.0,
        "artist": 2.5,
        "era": 2.0,
        "geography": 1.5,
        "medium": 1.0,
    }

    # -- Interaction Signals -------------------------------------------
    SIGNAL_SWIPE_LEFT: int = -1
    SIGNAL_SKIP: int = 0
    SIGNAL_LONG_PRESS: int = 1
    SIGNAL_SWIPE_RIGHT: int = 3
    SIGNAL_SWIPE_UP: int = 5

    # -- Feed Composition (fractions of batch) -------------------------
    FEED_BATCH_SIZE: int = 20
    FEED_TASTE_MATCHED: float = 0.35
    FEED_POPULAR: float = 0.20
    FEED_UNEXPLORED: float = 0.20
    FEED_PROBES: float = 0.15
    FEED_DIVERSE: float = 0.10

    # -- Recommendations -----------------------------------------------
    RECOMMEND_TOP_N: int = 20
    ONBOARDING_POOL_SIZE: int = 30

    # -- Exhibition Sync -----------------------------------------------
    DEFAULT_CITY: str = "São Paulo"
    EXHIBITION_SYNC_INTERVAL: int = 86400

    def ensure_data_dir(self):
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_data_dir()
