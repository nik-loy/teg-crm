import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

ARTIC_RESPONSE = {
    "data": [{
        "id": 111628,
        "title": "A Sunday on La Grande Jatte",
        "technique_titles": ["painting", "pointillism"],
        "style_titles": ["Post-Impressionism", "Neo-Impressionism"],
        "subject_titles": ["people", "leisure", "parks"],
        "classification_titles": ["painting"],
        "medium_display": "Oil on canvas",
        "dimensions": "207.5 × 308.1 cm (81 11/16 × 121 1/4 in.)",
        "inscriptions": "Signed lower right: Seurat",
        "color": {"h": 48, "s": 19, "l": 56, "percentage": 0.22, "population": 1456},
    }]
}


@pytest.mark.asyncio
async def test_find_artic_artwork_returns_best_match():
    from src.backend.clients.artic_dossier import find_artic_artwork

    mock_resp = MagicMock()
    mock_resp.json.return_value = ARTIC_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.return_value = mock_resp

    with patch("src.backend.clients.artic_dossier.httpx.AsyncClient", return_value=mock_client):
        result = await find_artic_artwork("A Sunday on La Grande Jatte", "Georges Seurat")

    assert result is not None
    assert result["id"] == 111628


@pytest.mark.asyncio
async def test_find_artic_artwork_returns_none_on_low_similarity():
    from src.backend.clients.artic_dossier import find_artic_artwork

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"data": [{"id": 1, "title": "Completely Unrelated Work"}]}
    mock_resp.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.return_value = mock_resp

    with patch("src.backend.clients.artic_dossier.httpx.AsyncClient", return_value=mock_client):
        result = await find_artic_artwork("A Sunday on La Grande Jatte", "Georges Seurat")

    assert result is None


@pytest.mark.asyncio
async def test_find_artic_artwork_returns_none_on_http_error():
    from src.backend.clients.artic_dossier import find_artic_artwork

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.side_effect = Exception("Network error")

    with patch("src.backend.clients.artic_dossier.httpx.AsyncClient", return_value=mock_client):
        result = await find_artic_artwork("anything", "anyone")

    assert result is None


def test_extract_dossier_fields_parses_all_fields():
    from src.backend.clients.artic_dossier import extract_dossier_fields

    result = extract_dossier_fields(ARTIC_RESPONSE["data"][0])

    assert result["artic_id"] == "111628"
    assert result["medium_display"] == "Oil on canvas"
    assert json.loads(result["technique_titles"]) == ["painting", "pointillism"]
    assert result["physical_dimensions"] == "207.5 × 308.1 cm (81 11/16 × 121 1/4 in.)"
    assert result["inscriptions"] == "Signed lower right: Seurat"
    assert result["color_palette"] is not None
    palette = json.loads(result["color_palette"])
    assert palette[0]["hue"] == 48


def test_extract_dossier_fields_handles_empty_lists():
    from src.backend.clients.artic_dossier import extract_dossier_fields

    result = extract_dossier_fields({"id": 1, "title": "Test", "technique_titles": []})
    assert result["technique_titles"] is None
