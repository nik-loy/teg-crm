import pytest
from unittest.mock import AsyncMock, MagicMock, patch

_ULAN_RESPONSE = {
    "results": {
        "bindings": [{
            "id": {"value": "http://vocab.getty.edu/ulan/500021166"},
            "bio": {"value": "French Neo-Impressionist painter, known for Pointillism."},
            "birth": {"value": "1859"},
            "death": {"value": "1891"},
            "nationality": {"value": "French"},
        }]
    }
}


def _mock_client(response_data):
    mock_resp = MagicMock()
    mock_resp.json.return_value = response_data
    mock_resp.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return mock_client


@pytest.mark.asyncio
async def test_fetch_artist_dossier_returns_dict():
    from src.backend.clients.getty_ulan import fetch_artist_dossier

    with patch("src.backend.clients.getty_ulan.httpx.AsyncClient", return_value=_mock_client(_ULAN_RESPONSE)):
        result = await fetch_artist_dossier("Georges Seurat")

    assert result is not None
    assert result["nationality"] == "French"
    assert result["birth_year"] == 1859
    assert result["death_year"] == 1891
    assert "Pointillism" in result["bio"]


@pytest.mark.asyncio
async def test_fetch_artist_dossier_returns_none_on_empty():
    from src.backend.clients.getty_ulan import fetch_artist_dossier

    empty = {"results": {"bindings": []}}
    with patch("src.backend.clients.getty_ulan.httpx.AsyncClient", return_value=_mock_client(empty)):
        result = await fetch_artist_dossier("Unknown Artist XYZ")

    assert result is None


@pytest.mark.asyncio
async def test_fetch_artist_dossier_returns_none_on_error():
    from src.backend.clients.getty_ulan import fetch_artist_dossier

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.side_effect = Exception("Timeout")

    with patch("src.backend.clients.getty_ulan.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_artist_dossier("Van Gogh")

    assert result is None
