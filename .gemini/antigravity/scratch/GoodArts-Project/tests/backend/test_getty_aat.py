import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

_AAT_RESPONSE = {
    "results": {
        "bindings": [{
            "id": {"value": "http://vocab.getty.edu/aat/300178684"},
            "definition": {"value": "A technique of applying thick paint to canvas"},
            "broader": {"value": "painting techniques"},
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
async def test_get_technique_definition_returns_dict():
    from src.backend.clients.getty_aat import get_technique_definition

    with patch("src.backend.clients.getty_aat.httpx.AsyncClient", return_value=_mock_client(_AAT_RESPONSE)):
        result = await get_technique_definition("impasto")

    assert result is not None
    assert "aat_id" in result
    assert result["definition"] == "A technique of applying thick paint to canvas"
    assert result["broader"] == "painting techniques"


@pytest.mark.asyncio
async def test_get_technique_definition_returns_none_on_empty():
    from src.backend.clients.getty_aat import get_technique_definition

    empty = {"results": {"bindings": []}}
    with patch("src.backend.clients.getty_aat.httpx.AsyncClient", return_value=_mock_client(empty)):
        result = await get_technique_definition("unknownterm")

    assert result is None


@pytest.mark.asyncio
async def test_get_technique_definition_returns_none_on_error():
    from src.backend.clients.getty_aat import get_technique_definition

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.side_effect = Exception("Network error")

    with patch("src.backend.clients.getty_aat.httpx.AsyncClient", return_value=mock_client):
        result = await get_technique_definition("impasto")

    assert result is None


@pytest.mark.asyncio
async def test_enrich_techniques_returns_json_dict():
    from src.backend.clients.getty_aat import enrich_techniques

    with patch("src.backend.clients.getty_aat.httpx.AsyncClient", return_value=_mock_client(_AAT_RESPONSE)):
        result = await enrich_techniques(json.dumps(["impasto", "glazing"]))

    assert result is not None
    parsed = json.loads(result)
    assert len(parsed) > 0


@pytest.mark.asyncio
async def test_enrich_techniques_returns_none_for_empty_input():
    from src.backend.clients.getty_aat import enrich_techniques

    assert await enrich_techniques(None) is None
    assert await enrich_techniques("[]") is None
