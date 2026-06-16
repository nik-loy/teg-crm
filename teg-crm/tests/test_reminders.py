from unittest.mock import MagicMock, patch

import pytest

from src.config import TeamMember
from src.reminders.follow_up_bot import (
    OverdueContact,
    OwnerSummary,
    _format_email_body,
    fetch_overdue_contacts,
    group_by_owner,
    run_reminders,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _overdue_page(name: str = "Alice", due: str = "2020-01-01", owner_ids: list[str] | None = None) -> dict:
    people = [{"id": uid} for uid in (owner_ids or [])]
    return {
        "id": f"page_{name}",
        "url": f"https://notion.so/{name.lower()}",
        "properties": {
            "Name": {"title": [{"plain_text": name}]},
            "Follow-Up Owner": {"people": people},
            "Follow-Up Due Date": {"date": {"start": due}},
            "Follow-Up Complete": {"checkbox": False},
            "Company": {"relation": []},
        },
    }


# ── fetch_overdue_contacts ────────────────────────────────────────────────────

def test_fetch_uses_contacts_db_id(mock_config, mock_notion_client) -> None:
    mock_notion_client.databases.query.return_value = {"results": [], "has_more": False}
    fetch_overdue_contacts(mock_notion_client, mock_config)
    kwargs = mock_notion_client.databases.query.call_args.kwargs
    assert kwargs["database_id"] == mock_config.contacts_db_id


def test_fetch_filter_targets_incomplete_and_overdue(mock_config, mock_notion_client) -> None:
    mock_notion_client.databases.query.return_value = {"results": [], "has_more": False}
    fetch_overdue_contacts(mock_notion_client, mock_config)
    conditions = mock_notion_client.databases.query.call_args.kwargs["filter"]["and"]
    props = {c["property"] for c in conditions}
    assert "Follow-Up Complete" in props
    assert "Follow-Up Due Date" in props


# ── group_by_owner ────────────────────────────────────────────────────────────

def test_group_assigns_to_correct_member(mock_config) -> None:
    summaries = group_by_owner([_overdue_page("Alice", owner_ids=["uid1"])], mock_config)
    assert "uid1" in summaries
    assert summaries["uid1"].contacts[0].name == "Alice"


def test_group_unassigned_notifies_all_members(mock_config) -> None:
    summaries = group_by_owner([_overdue_page("Alice", owner_ids=[])], mock_config)
    assert "uid1" in summaries
    assert "uid2" in summaries


def test_group_unknown_uid_is_silently_skipped(mock_config) -> None:
    summaries = group_by_owner([_overdue_page("Alice", owner_ids=["uid_unknown"])], mock_config)
    assert summaries == {}


def test_group_multiple_contacts_same_owner(mock_config) -> None:
    contacts = [
        _overdue_page("Alice", owner_ids=["uid1"]),
        _overdue_page("Bob", owner_ids=["uid1"]),
        _overdue_page("Clara", owner_ids=["uid2"]),
    ]
    summaries = group_by_owner(contacts, mock_config)
    assert len(summaries["uid1"].contacts) == 2
    assert len(summaries["uid2"].contacts) == 1


def test_group_preserves_due_date(mock_config) -> None:
    summaries = group_by_owner([_overdue_page("Alice", due="2024-03-15", owner_ids=["uid1"])], mock_config)
    assert summaries["uid1"].contacts[0].due_date == "2024-03-15"


def test_group_preserves_page_url(mock_config) -> None:
    summaries = group_by_owner([_overdue_page("Alice", owner_ids=["uid1"])], mock_config)
    assert "notion.so" in summaries["uid1"].contacts[0].page_url


# ── _format_email_body ────────────────────────────────────────────────────────

def test_format_body_includes_member_name() -> None:
    member = TeamMember(notion_id="uid1", name="Alice", email="alice@teg.de")
    summary = OwnerSummary(
        member=member,
        contacts=[OverdueContact(name="Dr. Müller", company="BMW", due_date="2020-01-01", page_url="")],
    )
    body = _format_email_body(summary)
    assert "Alice" in body


def test_format_body_includes_contact_name() -> None:
    member = TeamMember(notion_id="uid1", name="Alice", email="alice@teg.de")
    summary = OwnerSummary(
        member=member,
        contacts=[OverdueContact(name="Dr. Müller", company="", due_date="2020-01-01", page_url="")],
    )
    assert "Dr. Müller" in _format_email_body(summary)


def test_format_body_includes_due_date() -> None:
    member = TeamMember(notion_id="uid1", name="Alice", email="alice@teg.de")
    summary = OwnerSummary(
        member=member,
        contacts=[OverdueContact(name="X", company="", due_date="2024-06-01", page_url="")],
    )
    assert "2024-06-01" in _format_email_body(summary)


def test_format_body_mentions_count() -> None:
    member = TeamMember(notion_id="uid1", name="Alice", email="alice@teg.de")
    contacts = [
        OverdueContact(name="A", company="", due_date="2020-01-01", page_url=""),
        OverdueContact(name="B", company="", due_date="2020-01-02", page_url=""),
    ]
    body = _format_email_body(OwnerSummary(member=member, contacts=contacts))
    assert "2" in body


# ── run_reminders ─────────────────────────────────────────────────────────────

def test_run_reminders_returns_zero_when_no_overdue(mock_config) -> None:
    client = MagicMock()
    client.databases.query.return_value = {"results": [], "has_more": False}
    assert run_reminders(client, mock_config) == 0


def test_run_reminders_sends_email_per_owner(mock_config) -> None:
    client = MagicMock()
    client.databases.query.return_value = {
        "results": [_overdue_page("Alice", owner_ids=["uid1"])],
        "has_more": False,
    }
    with patch("src.reminders.follow_up_bot.send_email_reminder") as mock_send:
        count = run_reminders(client, mock_config)
    mock_send.assert_called_once()
    assert count == 1


def test_run_reminders_skips_email_when_no_api_key(mock_config) -> None:
    mock_config.resend_api_key = ""
    client = MagicMock()
    client.databases.query.return_value = {
        "results": [_overdue_page("Alice", owner_ids=["uid1"])],
        "has_more": False,
    }
    with patch("src.reminders.follow_up_bot.send_email_reminder") as mock_send:
        run_reminders(client, mock_config)
    mock_send.assert_not_called()
