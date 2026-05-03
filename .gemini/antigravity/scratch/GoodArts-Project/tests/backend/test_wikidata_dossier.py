import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

_MOVEMENT_RESPONSE = {
    "results": {
        "bindings": [
            {
                "movement": {"value": "http://www.wikidata.org/entity/Q207687"},
                "movementLabel": {"value": "Post-Impressionism"},
                "broaderLabel": {"value": "Modern art"},
                "desc": {"value": "Late-19th-century art movement"},
            }
        ]
    }
}

_INFLUENCES_RESPONSE = {
    "results": {
        "bindings": [
            {
                "artist": {"value": "http://www.wikidata.org/entity/Q5582"},
                "influencedByLabel": {"value": "Jean-François Millet"},
                "influencedLabel": {"value": "Paul Gauguin"},
            }
        ]
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
async def test_get_movement_hierarchy_returns_json_string():
    from src.backend.clients.wikidata import get_movement_hierarchy

    with patch("src.backend.clients.wikidata.httpx.AsyncClient", return_value=_mock_client(_MOVEMENT_RESPONSE)):
        result = await get_movement_hierarchy("Post-Impressionism")

    assert result is not None
    parsed = json.loads(result)
    assert "broader" in parsed
    assert "Modern art" in parsed["broader"]


@pytest.mark.asyncio
async def test_get_movement_hierarchy_returns_none_on_empty():
    from src.backend.clients.wikidata import get_movement_hierarchy

    empty = {"results": {"bindings": []}}
    with patch("src.backend.clients.wikidata.httpx.AsyncClient", return_value=_mock_client(empty)):
        result = await get_movement_hierarchy("UnknownMovement")

    assert result is None


@pytest.mark.asyncio
async def test_get_movement_hierarchy_returns_none_on_error():
    from src.backend.clients.wikidata import get_movement_hierarchy

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.side_effect = Exception("Timeout")

    with patch("src.backend.clients.wikidata.httpx.AsyncClient", return_value=mock_client):
        result = await get_movement_hierarchy("Impressionism")

    assert result is None


@pytest.mark.asyncio
async def test_get_artist_influences_returns_dict():
    from src.backend.clients.wikidata import get_artist_influences

    with patch("src.backend.clients.wikidata.httpx.AsyncClient", return_value=_mock_client(_INFLUENCES_RESPONSE)):
        result = await get_artist_influences("Vincent van Gogh")

    assert result is not None
    assert "influenced_by" in result
    assert "influenced" in result
    assert isinstance(result["influenced_by"], list)
    assert "Jean-François Millet" in result["influenced_by"]


@pytest.mark.asyncio
async def test_get_artist_influences_returns_none_on_empty():
    from src.backend.clients.wikidata import get_artist_influences

    empty = {"results": {"bindings": []}}
    with patch("src.backend.clients.wikidata.httpx.AsyncClient", return_value=_mock_client(empty)):
        result = await get_artist_influences("Unknown Artist")

    assert result is None
