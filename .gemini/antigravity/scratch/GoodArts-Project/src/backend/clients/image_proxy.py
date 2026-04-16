"""GoodArts — Image Proxy & Disk Cache. Fetches remote images, caches to disk, generates thumbnails."""
import hashlib
from pathlib import Path
from typing import Optional
import httpx
from PIL import Image
from src.backend.config import settings


def cache_key_for_url(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


def get_cached_path(key: str, cache_dir: str = None) -> Optional[str]:
    d = Path(cache_dir or str(settings.IMAGE_CACHE_DIR))
    for ext in [".jpg", ".png", ".webp"]:
        p = d / f"{key}{ext}"
        if p.exists():
            return str(p)
    return None


def get_dominant_color(image_path: str) -> str:
    try:
        img = Image.open(image_path).convert("RGB").resize((1, 1))
        r, g, b = img.getpixel((0, 0))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return "#2a2826"


def generate_thumbnail(image_path: str, key: str) -> str:
    thumb_dir = Path(str(settings.IMAGE_CACHE_DIR)) / "thumbs"
    thumb_dir.mkdir(exist_ok=True)
    thumb_path = thumb_dir / f"{key}_thumb.jpg"
    if thumb_path.exists():
        return str(thumb_path)
    try:
        img = Image.open(image_path)
        ratio = settings.THUMBNAIL_WIDTH / img.width
        new_size = (settings.THUMBNAIL_WIDTH, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
        img.convert("RGB").save(str(thumb_path), "JPEG", quality=80)
    except Exception:
        return image_path
    return str(thumb_path)


async def fetch_and_cache(url: str) -> dict:
    key = cache_key_for_url(url)
    existing = get_cached_path(key)
    if existing:
        thumb = generate_thumbnail(existing, key)
        color = get_dominant_color(existing)
        return {"path": existing, "thumbnail_path": thumb, "dominant_color": color, "key": key}
    cache_dir = Path(str(settings.IMAGE_CACHE_DIR))
    cache_dir.mkdir(parents=True, exist_ok=True)
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "GoodArts/0.1"})
            resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        ext = ".png" if "png" in content_type else (".webp" if "webp" in content_type else ".jpg")
        file_path = cache_dir / f"{key}{ext}"
        file_path.write_bytes(resp.content)
        thumb = generate_thumbnail(str(file_path), key)
        color = get_dominant_color(str(file_path))
        return {"path": str(file_path), "thumbnail_path": thumb, "dominant_color": color, "key": key}
    except Exception as e:
        return {"path": None, "thumbnail_path": None, "dominant_color": "#2a2826", "key": key, "error": str(e)}
