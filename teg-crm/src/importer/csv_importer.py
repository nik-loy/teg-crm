"""Event Attendee CSV Importer.

Takes a CSV from event sign-in sheets, deduplicates against existing SQLite contacts,
creates new entries, links them to the event, and sets follow-up dates.

CSV columns (header row required):
  name (required), email, phone, linkedin_url, company, job_title, industry,
  tier, tags (pipe-separated e.g. "potential-speaker|alumni-TUM"), notes,
  referred_by, follow_up_due (YYYY-MM-DD), follow_up_owner_email

Run: python -m src.importer.csv_importer --file attendees.csv [--event-id SQLITE_EVENT_ID]
"""
from __future__ import annotations

import argparse
import csv
import logging
import os
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import django
from dotenv import load_dotenv
from rich.console import Console

# Bootstrap Django environment before importing models
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm.settings")
django.setup()

from crm.contacts.models import Contact, Event, Attendance, PipelineStage
from src.config import Config

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


def _owner_name_from_email(cfg: Config, email: str) -> str | None:
    """Returns the team member name for an email, or None if not found."""
    for member in cfg.team_members:
        if member.email.lower() == email.lower():
            return member.name
    return None


def run_import(
    cfg: Config,
    rows: list[AttendeeRow],
    event_id: str | None,
) -> ImportResult:
    """Deduplicates rows against SQLite, creates new contacts, links attendance."""
    result = ImportResult()

    event = None
    if event_id:
        try:
            event = Event.objects.filter(id=event_id).first()
        except Exception as exc:
            logger.warning("Could not fetch event for ID %s: %s", event_id, exc)

    for row in rows:
        # Check by LinkedIn URL or Name + Company duplicate
        existing = None
        if row.linkedin_url:
            existing = Contact.objects.filter(linkedin_url=row.linkedin_url).first()
        if not existing and row.name:
            existing = Contact.objects.filter(name=row.name, company_name=row.company).first()

        if existing:
            console.print(f"  [yellow]skip[/yellow] {row.name} (duplicate match)")
            result.skipped += 1
            if event and not Attendance.objects.filter(contact=existing, event=event).exists():
                # Link attendance for existing contact
                Attendance.objects.create(
                    contact=existing,
                    event=event,
                    notes=f"Linked during import. referred by: {row.referred_by}",
                )
            continue

        owner_name = _owner_name_from_email(cfg, row.follow_up_owner_email) if row.follow_up_owner_email else ""

        try:
            follow_up_due_date = None
            if row.follow_up_due:
                try:
                    follow_up_due_date = date.fromisoformat(row.follow_up_due)
                except ValueError:
                    pass
            elif owner_name:
                follow_up_due_date = date.today() + timedelta(days=_DEFAULT_FOLLOWUP_DAYS)

            contact = Contact.objects.create(
                name=row.name,
                linkedin_url=row.linkedin_url,
                job_title=row.job_title,
                company_name=row.company,
                pipeline_stage=_DEFAULT_STAGE,
                source=_DEFAULT_SOURCE,
                tier=row.tier,
                last_contact_date=date.today(),
                notes=row.notes,
                follow_up_due_date=follow_up_due_date,
                follow_up_owner=owner_name,
                follow_up_complete=False if (row.follow_up_due or owner_name) else True,
            )

            if event:
                Attendance.objects.create(
                    contact=contact,
                    event=event,
                    notes=f"Imported. referred by: {row.referred_by}. Notes: {row.notes}",
                )

            console.print(f"  [green]✓[/green] Created: {row.name}")
            result.created += 1
        except Exception as exc:
            msg = f"{row.name}: {exc}"
            logger.error("Failed to create contact: %s", msg)
            result.errors.append(msg)

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Import event attendees into SQLite CRM")
    parser.add_argument("--file", required=True, help="Path to attendee CSV file")
    parser.add_argument("--event-id", default=None, help="SQLite event ID to link attendance")
    args = parser.parse_args()

    cfg = Config.from_env()
    rows = parse_csv(Path(args.file))
    console.print(f"Parsed {len(rows)} rows from {args.file}")

    result = run_import(cfg, rows, args.event_id)

    console.print("\n[bold]Import complete:[/bold]")
    console.print(f"  Created : {result.created}")
    console.print(f"  Skipped : {result.skipped}")
    if result.errors:
        console.print(f"  [red]Errors  : {len(result.errors)}[/red]")
        for e in result.errors:
            console.print(f"    - {e}")


if __name__ == "__main__":
    main()
