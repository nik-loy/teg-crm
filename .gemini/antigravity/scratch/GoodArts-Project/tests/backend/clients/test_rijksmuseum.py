"""Test Rijksmuseum API client."""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from src.backend.clients.rijksmuseum import search_rijksmuseum, _parse_artwork


def test_parse_artwork_extracts_fields():
    raw = {
        "objectNumber": "SK-C-5",
        "title": "The Night Watch",
        "principalOrFirstMaker": "Rembrandt van Rijn",
        "dating": {"sortingDate": 1642},
        "webImage": {"url": "https://example.com/img.jpg"},
        "classification": {"iconClassDescription": ["militia"]},
    }
    result = _parse_artwork(raw)
    assert result["title"] == "The Night Watch"
    assert result["artist"] == "Rembrandt van Rijn"
    assert result["year"] == 1642
    assert result["source"] == "rijksmuseum"
    assert result["source_id"] == "SK-C-5"
    assert result["image_url"] == "https://example.com/img.jpg"


def test_parse_artwork_handles_missing_image():
    raw = {"objectNumber": "X-1", "title": "No Image", "principalOrFirstMaker": "Unknown"}
    result = _parse_artwork(raw)
    assert result["image_url"] is None


@pytest.mark.asyncio
async def test_search_rijksmuseum_with_mock():
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "artObjects": [
            {
                "objectNumber": "SK-A-1",
                "title": "Test Art",
                "principalOrFirstMaker": "Artist",
                "webImage": {"url": "http://img.jpg"},
            }
        ]
    }
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.return_value = mock_resp

    with patch("src.backend.clients.rijksmuseum.httpx.AsyncClient", return_value=mock_client):
        # We need to make sure settings has an API key for the mock to run
        with patch("src.backend.clients.rijksmuseum.settings.RIJKSMUSEUM_API_KEY", "test-key"):
            results = await search_rijksmuseum("test")
    assert len(results) == 1
    assert results[0]["title"] == "Test Art"
