"""Test Art Institute of Chicago API client."""
from src.backend.clients.artic import _iiif_url, _parse_artwork


def test_iiif_url_constructs_correctly():
    url = _iiif_url("abc-123-def")
    assert url == "https://www.artic.edu/iiif/2/abc-123-def/full/843,/0/default.jpg"


def test_iiif_url_hd():
    url = _iiif_url("abc-123-def", full_res=True)
    assert url == "https://www.artic.edu/iiif/2/abc-123-def/full/max/0/default.jpg"


def test_parse_artwork():
    raw = {
        "id": 12345,
        "title": "A Sunday on La Grande Jatte",
        "artist_title": "Georges Seurat",
        "date_end": 1886,
        "image_id": "img-abc",
        "medium_display": "Oil on canvas",
        "style_title": "Pointillism",
        "place_of_origin": "France",
    }
    result = _parse_artwork(raw)
    assert result["title"] == "A Sunday on La Grande Jatte"
    assert result["artist"] == "Georges Seurat"
    assert result["source"] == "artic"
    assert "img-abc" in result["image_url"]
