"""Event Attendee CSV Importer.

Takes a CSV from event sign-in sheets, deduplicates against existing contacts,
creates new Notion entries, links them to the event, and sets follow-up dates.

CSV columns (header row required):
  name (required), email, phone, linkedin_url, company, job_title, industry,
  tier, tags (pipe-separated e.g. "potential-speaker|alumni-TUM"), notes,
  referred_by, follow_up_due (YYYY-MM-DD), follow_up_owner_email

Run: python -m src.importer.csv_importer --file attendees.csv [--event-id NOTION_PAGE_ID]
"""
from __future__ import annotations

import argparse
import csv
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console

from src.config import Config
from src.notion_helpers import (
    date_prop,
    email_prop,
    multi_select_prop,
    paginated_query,
    phone_prop,
    relation_prop,
    rich_text_prop,
    select_prop,
    title_prop,
    url_prop,
    with_retry,
)

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

_DEFAULT_STAGE = "First Attendance"
_DEFAULT_SOURCE = "TEG Event"
_DEFAULT_TIER = "Tier 3"
_DEFAULT_FOLLOWUP_DAYS = 14


@dataclass
class ImportResult:
    created: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


@dataclass
class AttendeeRow:
    name: str
    email: str
    phone: str
    linkedin_url: str
    company: str
    job_title: str
    industry: str
    tier: str
    tags: list[str]
    notes: str
    referred_by: str
    follow_up_due: str
    follow_up_owner_email: str


def parse_csv(file_path: Path) -> list[AttendeeRow]:
    """Parses the attendee CSV, skipping rows with no name."""
    rows: list[AttendeeRow] = []
    with file_path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for line_no, row in enumerate(reader, start=2):
            name = row.get("name", "").strip()
            if not name:
                logger.warning("Row %d: missing name — skipped", line_no)
                continue
            tags_raw = row.get("tags", "").strip()
            tags = [t.strip() for t in tags_raw.split("|") if t.strip()] if tags_raw else []
            rows.append(AttendeeRow(
                name=name,
                email=row.get("email", "").strip().lower(),
                phone=row.get("phone", "").strip(),
                linkedin_url=row.get("linkedin_url", "").strip(),
                company=row.get("company", "").strip(),
                job_title=row.get("job_title", "").strip(),
                industry=row.get("industry", "").strip(),
                tier=row.get("tier", "").strip() or _DEFAULT_TIER,
                tags=tags,
                notes=row.get("notes", "").strip(),
                referred_by=row.get("referred_by", "").strip(),
                follow_up_due=row.get("follow_up_due", "").strip(),
                follow_up_owner_email=row.get("follow_up_owner_email", "").strip(),
            ))
    return rows


def _build_email_index(contacts: list[dict]) -> dict[str, str]:
    """Maps lowercase email → page_id for existing contacts that have an email set."""
    index: dict[str, str] = {}
    for c in contacts:
        email = c.get("properties", {}).get("Email", {}).get("email") or ""
        if email:
            index[email.lower()] = c["id"]
    return index


def _build_name_company_index(contacts: list[dict]) -> dict[tuple[str, str], str]:
    """Maps (lower_name, company_relation_id) → page_id as a fallback dedup key."""
    index: dict[tuple[str, str], str] = {}
    for c in contacts:
        props = c.get("properties", {})
        name_parts = props.get("Name", {}).get("title", [])
        name = "".join(p.get("plain_text", "") for p in name_parts).lower()
        company_rel = props.get("Company", {}).get("relation", [])
        company_key = company_rel[0]["id"] if company_rel else ""
        if name:
            index[(name, company_key)] = c["id"]
    return index


def _find_or_create_company(client: Client, cfg: Config, company_name: str) -> str | None:
    """Returns the page ID of the company, creating it if it doesn't already exist."""
    if not company_name:
        return None
    results = with_retry(lambda: client.databases.query(
        database_id=cfg.companies_db_id,
        filter={"property": "Company Name", "title": {"equals": company_name}},
        page_size=1,
    ))
    if results["results"]:
        return results["results"][0]["id"]
    page = with_retry(lambda: client.pages.create(
        parent={"database_id": cfg.companies_db_id},
        properties={"Company Name": title_prop(company_name)},
    ))
    return page["id"]


def _owner_id_from_email(cfg: Config, email: str) -> str | None:
    """Returns the Notion user ID for a team member email, or None if not found."""
    for member in cfg.team_members:
        if member.email.lower() == email.lower():
            return member.notion_id
    return None


def _build_contact_properties(
    row: AttendeeRow, company_id: str | None, owner_id: str | None
) -> dict:
    props: dict = {
        "Name": title_prop(row.name),
        "Pipeline Stage": select_prop(_DEFAULT_STAGE),
        "Source": select_prop(_DEFAULT_SOURCE),
        "Tier": select_prop(row.tier),
        "Last Contact Date": date_prop(date.today().isoformat()),
    }
    if row.email:
        props["Email"] = email_prop(row.email)
    if row.phone:
        props["Phone"] = phone_prop(row.phone)
    if row.linkedin_url:
        props["LinkedIn URL"] = url_prop(row.linkedin_url)
    if row.job_title:
        props["Job Title"] = rich_text_prop(row.job_title)
    if row.industry:
        props["Industry"] = select_prop(row.industry)
    if row.tags:
        props["Tags"] = multi_select_prop(row.tags)
    if row.notes:
        props["Notes"] = rich_text_prop(row.notes)
    if company_id:
        props["Company"] = relation_prop([company_id])

    # Follow-up: use explicit date from CSV, else auto-schedule if owner is known
    if row.follow_up_due:
        props["Follow-Up Due Date"] = date_prop(row.follow_up_due)
        props["Follow-Up Complete"] = {"checkbox": False}
    elif owner_id:
        auto_due = (date.today() + timedelta(days=_DEFAULT_FOLLOWUP_DAYS)).isoformat()
        props["Follow-Up Due Date"] = date_prop(auto_due)
        props["Follow-Up Complete"] = {"checkbox": False}
    if owner_id:
        props["Follow-Up Owner"] = {"people": [{"id": owner_id}]}

    return props


def _create_attendance_record(
    client: Client,
    cfg: Config,
    contact_id: str,
    event_id: str,
    event_name: str,
    row: AttendeeRow,
) -> None:
    props: dict = {
        "Record": title_prop(f"{row.name} — {event_name}"),
        "Contact": relation_prop([contact_id]),
        "Event": relation_prop([event_id]),
        "Date Attended": date_prop(date.today().isoformat()),
    }
    if row.referred_by:
        props["Referred By"] = rich_text_prop(row.referred_by)
    if row.notes:
        props["Notes"] = rich_text_prop(row.notes)
    with_retry(lambda: client.pages.create(
        parent={"database_id": cfg.attendance_db_id},
        properties=props,
    ))


def run_import(
    client: Client,
    cfg: Config,
    rows: list[AttendeeRow],
    event_id: str | None,
) -> ImportResult:
    """Deduplicates rows against Notion, creates new contacts, links attendance."""
    result = ImportResult()

    console.print("Loading existing contacts for deduplication...")
    existing = paginated_query(client, cfg.contacts_db_id)
    email_idx = _build_email_index(existing)
    name_company_idx = _build_name_company_index(existing)
    console.print(f"  {len(existing)} existing contacts indexed")

    # Fetch event name once so all attendance records get the correct title
    event_name = "Event"
    if event_id:
        try:
            event_page = with_retry(lambda: client.pages.retrieve(page_id=event_id))
            parts = event_page.get("properties", {}).get("Event Name", {}).get("title", [])
            event_name = "".join(p.get("plain_text", "") for p in parts) or "Event"
        except Exception as exc:
            logger.warning("Could not fetch event name for %s: %s", event_id, exc)

    for row in rows:
        # Primary dedup: email is globally unique
        if row.email and row.email in email_idx:
            console.print(f"  [yellow]skip[/yellow] {row.name} (email match)")
            result.skipped += 1
            continue

        company_id = _find_or_create_company(client, cfg, row.company) if row.company else None

        # Fallback dedup: same name + same company relation
        name_key = (row.name.lower(), company_id or "")
        if name_key in name_company_idx:
            console.print(f"  [yellow]skip[/yellow] {row.name} (name+company match)")
            result.skipped += 1
            continue

        owner_id = _owner_id_from_email(cfg, row.follow_up_owner_email) if row.follow_up_owner_email else None

        try:
            props = _build_contact_properties(row, company_id, owner_id)
            page = with_retry(lambda p=props: client.pages.create(
                parent={"database_id": cfg.contacts_db_id},
                properties=p,
            ))
            if event_id:
                _create_attendance_record(client, cfg, page["id"], event_id, event_name, row)
            console.print(f"  [green]✓[/green] Created: {row.name}")
            result.created += 1
        except Exception as exc:
            msg = f"{row.name}: {exc}"
            logger.error("Failed to create contact: %s", msg)
            result.errors.append(msg)

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Import event attendees into Notion CRM")
    parser.add_argument("--file", required=True, help="Path to attendee CSV file")
    parser.add_argument("--event-id", default=None, help="Notion event page ID to link attendance")
    args = parser.parse_args()

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)
    rows = parse_csv(Path(args.file))
    console.print(f"Parsed {len(rows)} rows from {args.file}")

    result = run_import(client, cfg, rows, args.event_id)

    console.print("\n[bold]Import complete:[/bold]")
    console.print(f"  Created : {result.created}")
    console.print(f"  Skipped : {result.skipped}")
    if result.errors:
        console.print(f"  [red]Errors  : {len(result.errors)}[/red]")
        for e in result.errors:
            console.print(f"    - {e}")


if __name__ == "__main__":
    main()
