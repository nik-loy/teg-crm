from unittest.mock import MagicMock, patch
import pytest

from src.notion_helpers import (
    paginated_query,
    with_retry,
    title_prop,
    rich_text_prop,
    select_prop,
    multi_select_prop,
    date_prop,
    relation_prop,
    email_prop,
    url_prop,
    phone_prop,
    checkbox_prop,
)


# ── paginated_query ────────────────────────────────────────────────────────────

def test_paginated_query_single_page():
    client = MagicMock()
    client.databases.query.return_value = {
        "results": [{"id": "p1"}, {"id": "p2"}],
        "has_more": False,
    }
    with patch("time.sleep"):
        results = paginated_query(client, "db_id")
    assert len(results) == 2
    assert client.databases.query.call_count == 1


def test_paginated_query_two_pages():
    client = MagicMock()
    client.databases.query.side_effect = [
        {"results": [{"id": "p1"}], "has_more": True, "next_cursor": "cur1"},
        {"results": [{"id": "p2"}], "has_more": False},
    ]
    with patch("time.sleep"):
        results = paginated_query(client, "db_id")
    assert len(results) == 2
    second_call_kwargs = client.databases.query.call_args_list[1][1]
    assert second_call_kwargs["start_cursor"] == "cur1"


def test_paginated_query_passes_filter():
    client = MagicMock()
    client.databases.query.return_value = {"results": [], "has_more": False}
    f = {"property": "Stage", "select": {"equals": "Engaged"}}
    with patch("time.sleep"):
        paginated_query(client, "db_id", filter=f)
    assert client.databases.query.call_args[1]["filter"] == f


def test_paginated_query_sleeps_between_pages():
    client = MagicMock()
    client.databases.query.side_effect = [
        {"results": [{"id": "p1"}], "has_more": True, "next_cursor": "c1"},
        {"results": [{"id": "p2"}], "has_more": False},
    ]
    with patch("time.sleep") as mock_sleep:
        paginated_query(client, "db_id")
    mock_sleep.assert_called()


def test_paginated_query_empty_database():
    client = MagicMock()
    client.databases.query.return_value = {"results": [], "has_more": False}
    with patch("time.sleep"):
        results = paginated_query(client, "db_id")
    assert results == []


# ── with_retry ─────────────────────────────────────────────────────────────────

def test_with_retry_returns_on_first_attempt():
    fn = MagicMock(return_value="ok")
    assert with_retry(fn) == "ok"
    fn.assert_called_once()


def _api_err(status: int) -> "APIResponseError":
    import httpx
    from notion_client.errors import APIResponseError
    return APIResponseError(
        code="rate_limited" if status == 429 else "validation_error",
        status=status,
        message="test error",
        headers=httpx.Headers({}),
        raw_body_text="",
    )


def test_with_retry_retries_on_429_then_succeeds():
    err = _api_err(429)
    fn = MagicMock(side_effect=[err, err, "ok"])
    with patch("time.sleep"):
        result = with_retry(fn, max_attempts=5)
    assert result == "ok"
    assert fn.call_count == 3


def test_with_retry_raises_after_max_attempts():
    fn = MagicMock(side_effect=_api_err(429))
    with patch("time.sleep"), pytest.raises(Exception):
        with_retry(fn, max_attempts=3)
    assert fn.call_count == 3


def test_with_retry_does_not_retry_non_429():
    fn = MagicMock(side_effect=_api_err(400))
    with pytest.raises(Exception):
        with_retry(fn)
    fn.assert_called_once()


# ── Property builders ──────────────────────────────────────────────────────────

def test_title_prop():
    assert title_prop("Alice") == {"title": [{"text": {"content": "Alice"}}]}


def test_rich_text_prop():
    assert rich_text_prop("a note") == {"rich_text": [{"text": {"content": "a note"}}]}


def test_select_prop():
    assert select_prop("Tier 1") == {"select": {"name": "Tier 1"}}


def test_multi_select_prop():
    result = multi_select_prop(["alumni-TUM", "potential-speaker"])
    assert result == {"multi_select": [{"name": "alumni-TUM"}, {"name": "potential-speaker"}]}


def test_date_prop():
    assert date_prop("2026-01-15") == {"date": {"start": "2026-01-15"}}


def test_relation_prop_single():
    assert relation_prop(["id1"]) == {"relation": [{"id": "id1"}]}


def test_relation_prop_multiple():
    assert relation_prop(["id1", "id2"]) == {"relation": [{"id": "id1"}, {"id": "id2"}]}


def test_email_prop():
    assert email_prop("a@b.com") == {"email": "a@b.com"}


def test_url_prop():
    assert url_prop("https://linkedin.com/in/x") == {"url": "https://linkedin.com/in/x"}


def test_phone_prop():
    assert phone_prop("+49 89 123456") == {"phone_number": "+49 89 123456"}


def test_checkbox_prop_true():
    assert checkbox_prop(True) == {"checkbox": True}


def test_checkbox_prop_false():
    assert checkbox_prop(False) == {"checkbox": False}
