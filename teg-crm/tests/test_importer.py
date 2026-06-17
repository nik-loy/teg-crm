from pathlib import Path
import pytest
from crm.contacts.models import Contact, Event, Attendance
from src.importer.csv_importer import (
    AttendeeRow,
    _owner_name_from_email,
    parse_csv,
    run_import,
)

pytestmark = pytest.mark.django_db


def _row(
    name: str = "Alice",
    email: str = "alice@teg.de",
    company: str = "",
    **kwargs,
) -> AttendeeRow:
    defaults = dict(
        phone="", linkedin_url=f"https://linkedin.com/in/{name.lower()}", job_title="", industry="",
        tier="Tier 3", tags=[], notes="", referred_by="",
        follow_up_due="", follow_up_owner_email="",
    )
    defaults.update(kwargs)
    return AttendeeRow(name=name, email=email, company=company, **defaults)


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


def test_owner_name_found(mock_config) -> None:
    assert _owner_name_from_email(mock_config, "alice@teg.de") == "Alice"


def test_owner_name_returns_none_for_unknown_email(mock_config) -> None:
    assert _owner_name_from_email(mock_config, "nobody@x.com") is None


def test_owner_name_is_case_insensitive(mock_config) -> None:
    assert _owner_name_from_email(mock_config, "ALICE@TEG.DE") == "Alice"


def test_run_import_skips_linkedin_duplicate(mock_config) -> None:
    Contact.objects.create(name="Alice", linkedin_url="https://linkedin.com/in/alice")
    result = run_import(mock_config, [_row("Alice", linkedin_url="https://linkedin.com/in/alice")], event_id=None)
    assert result.skipped == 1
    assert result.created == 0


def test_run_import_creates_new_contact(mock_config) -> None:
    result = run_import(mock_config, [_row("Bob", "bob@x.com")], event_id=None)
    assert result.created == 1
    assert result.skipped == 0
    assert result.errors == []
    assert Contact.objects.filter(name="Bob").exists()


def test_run_import_creates_attendance_record_when_event_id_given(mock_config) -> None:
    event = Event.objects.create(name="TUM Forum", slug="tum-forum")
    run_import(mock_config, [_row("Bob", "bob@x.com")], event_id=event.id)
    assert Contact.objects.filter(name="Bob").exists()
    assert Attendance.objects.filter(event=event).exists()


def test_run_import_handles_multiple_rows(mock_config) -> None:
    rows = [_row("Alice", "a@x.com"), _row("Bob", "b@x.com"), _row("Clara", "c@x.com")]
    result = run_import(mock_config, rows, event_id=None)
    assert result.created == 3
