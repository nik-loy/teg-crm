"""Tests for outreach queue grouping logic."""
from datetime import date, timedelta
import pytest


def _page(name: str, status: str | None, owner: str = "niklas", days_ago: int = 1) -> dict:
    created = (date.today() - timedelta(days=days_ago)).isoformat() + "T10:00:00.000Z"
    props: dict = {
        "Name": {"title": [{"text": {"content": name}}]},
        "Outreach Owner": {"rich_text": [{"text": {"content": owner}}]},
    }
    if status:
        props["LinkedIn Outreach Status"] = {"select": {"name": status}}
    return {"properties": props, "created_time": created}


def test_group_contacts_by_status():
    from src.linkedin.outreach_queue import group_by_status
    contacts = [
        _page("Alice", "Request Sent"),
        _page("Bob", "Connected"),
        _page("Clara", "Messaged"),
        _page("David", None),
    ]
    groups = group_by_status(contacts)
    assert len(groups["Request Sent"]) == 1
    assert len(groups["Connected"]) == 1
    assert len(groups["Messaged"]) == 1
    assert len(groups["No Status"]) == 1


def test_stale_requests_flagged():
    from src.linkedin.outreach_queue import get_stale_requests
    contacts = [
        _page("Old Alice", "Request Sent", days_ago=5),
        _page("Recent Bob", "Request Sent", days_ago=1),
    ]
    stale = get_stale_requests(contacts, stale_after_days=3)
    assert len(stale) == 1
    assert stale[0]["properties"]["Name"]["title"][0]["text"]["content"] == "Old Alice"


def test_extract_contact_name():
    from src.linkedin.outreach_queue import extract_name
    page = _page("Anna Schmidt", "Connected")
    assert extract_name(page) == "Anna Schmidt"


def test_extract_owner():
    from src.linkedin.outreach_queue import extract_owner
    page = _page("Test", "Connected", owner="jonas")
    assert extract_owner(page) == "jonas"
