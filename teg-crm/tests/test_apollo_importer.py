"""Tests for Apollo CSV → Notion batch importer."""
from __future__ import annotations

import csv
import io
import pytest
from unittest.mock import MagicMock, call, patch


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_csv(rows: list[dict]) -> str:
    """Builds a CSV string from a list of row dicts."""
    if not rows:
        return ""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def _row(
    first="Anna",
    last="Schmidt",
    title="AI Consultant",
    company="Deloitte",
    linkedin="https://linkedin.com/in/anna-schmidt",
    email="anna@deloitte.de",
    city="Munich",
    country="Germany",
) -> dict:
    return {
        "First Name": first,
        "Last Name": last,
        "Title": title,
        "Company": company,
        "LinkedIn URL": linkedin,
        "Email": email,
        "City": city,
        "Country": country,
    }


# ── parse_apollo_csv ───────────────────────────────────────────────────────────

def test_parse_apollo_csv_returns_rows():
    from src.linkedin.apollo_importer import parse_apollo_csv
    rows = parse_apollo_csv(_make_csv([_row(), _row(first="Ben", last="Müller")]))
    assert len(rows) == 2
    assert rows[0]["name"] == "Anna Schmidt"
    assert rows[0]["company"] == "Deloitte"
    assert rows[0]["linkedin_url"] == "https://linkedin.com/in/anna-schmidt"
    assert rows[0]["email"] == "anna@deloitte.de"
    assert rows[0]["job_title"] == "AI Consultant"


def test_parse_apollo_csv_skips_rows_without_linkedin():
    from src.linkedin.apollo_importer import parse_apollo_csv
    rows = parse_apollo_csv(_make_csv([_row(linkedin=""), _row()]))
    assert len(rows) == 1


def test_parse_apollo_csv_normalises_linkedin_url():
    from src.linkedin.apollo_importer import parse_apollo_csv
    rows = parse_apollo_csv(_make_csv([_row(linkedin="https://www.linkedin.com/in/anna-schmidt/")]))
    assert rows[0]["linkedin_url"] == "https://www.linkedin.com/in/anna-schmidt"


# ── is_blacklisted ─────────────────────────────────────────────────────────────

def test_is_blacklisted_returns_true_for_exact_match():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("Netlight", ["Netlight", "Accenture"]) is True


def test_is_blacklisted_case_insensitive():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("netlight consulting", ["Netlight"]) is True


def test_is_blacklisted_returns_false_for_non_match():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("Deloitte", ["Netlight", "Accenture"]) is False


def test_is_blacklisted_partial_match():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("Oliver Wyman GmbH", ["Oliver Wyman"]) is True


# ── batch_import ───────────────────────────────────────────────────────────────

def test_batch_import_creates_contacts(mock_config, mock_notion_client):
    mock_notion_client.databases.query.return_value = {"results": []}
    mock_notion_client.pages.create.return_value = {"id": "abc", "url": "https://notion.so/abc"}
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Anna Schmidt", "linkedin_url": "https://linkedin.com/in/anna", "email": "anna@d.de", "company": "Deloitte", "job_title": "Consultant"},
    ]
    summary = batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    assert summary["created"] == 1
    assert summary["skipped_blacklist"] == 0
    assert summary["skipped_existing"] == 0


def test_batch_import_skips_blacklisted(mock_config, mock_notion_client):
    mock_config.outreach_blacklist = ["Netlight"]
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Lars Tränkner", "linkedin_url": "https://linkedin.com/in/lars", "email": "lars@netlight.com", "company": "Netlight", "job_title": "Senior Consultant"},
    ]
    summary = batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    assert summary["created"] == 0
    assert summary["skipped_blacklist"] == 1
    mock_notion_client.pages.create.assert_not_called()


def test_batch_import_skips_existing_linkedin_url(mock_config, mock_notion_client):
    mock_notion_client.databases.query.return_value = {
        "results": [{"id": "existing-page"}],
        "has_more": False,
    }
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Anna Schmidt", "linkedin_url": "https://linkedin.com/in/anna", "email": "anna@d.de", "company": "Deloitte", "job_title": "Consultant"},
    ]
    summary = batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    assert summary["created"] == 0
    assert summary["skipped_existing"] == 1


def test_batch_import_sets_request_sent_status(mock_config, mock_notion_client):
    mock_notion_client.databases.query.return_value = {"results": [], "has_more": False}
    mock_notion_client.pages.create.return_value = {"id": "abc", "url": ""}
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Anna Schmidt", "linkedin_url": "https://linkedin.com/in/anna", "email": "", "company": "Deloitte", "job_title": "Consultant"},
    ]
    batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    call_props = mock_notion_client.pages.create.call_args[1]["properties"]
    assert call_props["LinkedIn Outreach Status"]["select"]["name"] == "Request Sent"
    assert call_props["Outreach Owner"]["rich_text"][0]["text"]["content"] == "niklas"
