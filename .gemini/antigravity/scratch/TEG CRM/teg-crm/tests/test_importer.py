from pathlib import Path
from unittest.mock import MagicMock

import pytest

from src.importer.csv_importer import (
    AttendeeRow,
    _build_email_index,
    _build_name_company_index,
    _owner_id_from_email,
    parse_csv,
    run_import,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row(
    name: str = "Alice",
    email: str = "alice@teg.de",
    company: str = "",
    **kwargs,
) -> AttendeeRow:
    defaults = dict(
        phone="", linkedin_url="", job_title="", industry="",
        tier="Tier 3", tags=[], notes="", referred_by="",
        follow_up_due="", follow_up_owner_email="",
    )
    defaults.update(kwargs)
    return AttendeeRow(name=name, email=email, company=company, **defaults)


def _notion_contact(
    name: str = "Alice",
    email: str = "alice@teg.de",
    company_id: str | None = None,
    page_id: str = "page_1",
) -> dict:
    props: dict = {
        "Name": {"title": [{"plain_text": name}]},
        "Email": {"email": email},
        "Company": {"relation": [{"id": company_id}] if company_id else []},
    }
    return {"id": page_id, "properties": props}


# ── parse_csv ─────────────────────────────────────────────────────────────────

def test_parse_csv_reads_all_rows(tmp_path: Path) -> None:
    f = tmp_path / "a.csv"
    f.write_text("name,email\nAlice,alice@x.com\nBob,bob@x.com\n")
    assert len(parse_csv(f)) == 2


def test_parse_csv_skips_rows_without_name(tmp_path: Path) -> None:
    f = tmp_path / "a.csv"
    f.write_text("name,email\nAlice,alice@x.com\n,missing@x.com\n")
    rows = parse_csv(f)
    assert len(rows) == 1
    assert rows[0].name == "Alice"


def test_parse_csv_splits_pipe_tags(tmp_path: Path) -> None:
    f = tmp_path / "a.csv"
    f.write_text("name,email,tags\nAlice,a@x.com,potential-speaker|alumni-TUM\n")
    assert parse_csv(f)[0].tags == ["potential-speaker", "alumni-TUM"]


def test_parse_csv_defaults_tier_when_empty(tmp_path: Path) -> None:
    f = tmp_path / "a.csv"
    f.write_text("name,email\nAlice,a@x.com\n")
    assert parse_csv(f)[0].tier == "Tier 3"


def test_parse_csv_lowercases_email(tmp_path: Path) -> None:
    f = tmp_path / "a.csv"
    f.write_text("name,email\nAlice,Alice@X.COM\n")
    assert parse_csv(f)[0].email == "alice@x.com"


def test_parse_csv_handles_missing_optional_columns(tmp_path: Path) -> None:
    f = tmp_path / "a.csv"
    f.write_text("name,email\nBob,bob@x.com\n")
    row = parse_csv(f)[0]
    assert row.phone == ""
    assert row.tags == []
    assert row.notes == ""


# ── deduplication indexes ─────────────────────────────────────────────────────

def test_email_index_maps_lowercase_email_to_page_id() -> None:
    idx = _build_email_index([_notion_contact("Alice", "alice@teg.de", page_id="p1")])
    assert idx["alice@teg.de"] == "p1"


def test_email_index_skips_contacts_with_no_email() -> None:
    contact = {"id": "p1", "properties": {"Email": {"email": None}}}
    assert _build_email_index([contact]) == {}


def test_name_company_index_uses_lowered_name() -> None:
    idx = _build_name_company_index([_notion_contact("ALICE", "a@x.com", page_id="p1")])
    assert ("alice", "") in idx


def test_name_company_index_uses_company_relation_id() -> None:
    idx = _build_name_company_index([_notion_contact("Alice", "a@x.com", company_id="co_1", page_id="p1")])
    assert ("alice", "co_1") in idx


# ── _owner_id_from_email ──────────────────────────────────────────────────────

def test_owner_id_found(mock_config) -> None:
    assert _owner_id_from_email(mock_config, "alice@teg.de") == "uid1"


def test_owner_id_returns_none_for_unknown_email(mock_config) -> None:
    assert _owner_id_from_email(mock_config, "nobody@x.com") is None


def test_owner_id_is_case_insensitive(mock_config) -> None:
    assert _owner_id_from_email(mock_config, "ALICE@TEG.DE") == "uid1"


# ── run_import ────────────────────────────────────────────────────────────────

def _mock_client_empty() -> MagicMock:
    client = MagicMock()
    client.databases.query.return_value = {"results": [], "has_more": False}
    client.pages.create.return_value = {"id": "new_page"}
    return client


def test_run_import_skips_email_duplicate(mock_config) -> None:
    client = MagicMock()
    client.databases.query.return_value = {
        "results": [_notion_contact("Alice", "alice@teg.de")],
        "has_more": False,
    }
    result = run_import(client, mock_config, [_row("Alice", "alice@teg.de")], event_id=None)
    assert result.skipped == 1
    assert result.created == 0


def test_run_import_creates_new_contact(mock_config) -> None:
    client = _mock_client_empty()
    result = run_import(client, mock_config, [_row("Bob", "bob@x.com")], event_id=None)
    assert result.created == 1
    assert result.skipped == 0
    assert result.errors == []


def test_run_import_creates_attendance_record_when_event_id_given(mock_config) -> None:
    client = _mock_client_empty()
    client.pages.retrieve.return_value = {
        "properties": {"Event Name": {"title": [{"plain_text": "TUM Forum"}]}}
    }
    run_import(client, mock_config, [_row("Bob", "bob@x.com")], event_id="ev_123")
    # pages.create called twice: contact + attendance record
    assert client.pages.create.call_count == 2


def test_run_import_records_errors_without_crashing(mock_config) -> None:
    client = _mock_client_empty()
    client.pages.create.side_effect = Exception("Notion API error")
    result = run_import(client, mock_config, [_row("Bob", "bob@x.com")], event_id=None)
    assert len(result.errors) == 1
    assert result.created == 0


def test_run_import_handles_multiple_rows(mock_config) -> None:
    client = _mock_client_empty()
    rows = [_row("Alice", "a@x.com"), _row("Bob", "b@x.com"), _row("Clara", "c@x.com")]
    result = run_import(client, mock_config, rows, event_id=None)
    assert result.created == 3
