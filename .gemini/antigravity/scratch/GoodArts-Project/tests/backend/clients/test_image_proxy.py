"""Test image proxy cache key generation and thumbnail logic."""
from src.backend.clients.image_proxy import cache_key_for_url, get_cached_path


def test_cache_key_deterministic():
    url = "https://example.com/image.jpg"
    assert cache_key_for_url(url) == cache_key_for_url(url)


def test_cache_key_different_for_different_urls():
    k1 = cache_key_for_url("https://a.com/1.jpg")
    k2 = cache_key_for_url("https://a.com/2.jpg")
    assert k1 != k2


def test_get_cached_path_returns_none_for_missing(tmp_path):
    result = get_cached_path("nonexistent_key", str(tmp_path))
    assert result is None
