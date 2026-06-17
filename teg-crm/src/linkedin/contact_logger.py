"""LinkedIn Contact Logger.

Creates a contact entry in SQLite from a LinkedIn URL + minimal manual input.
Deduplicates by LinkedIn URL before creating — safe to run twice.

Run: python -m src.linkedin.contact_logger \
     --url https://www.linkedin.com/in/firstname-lastname \
     [--name "First Last"] [--title "VP Finance"] [--tier "Tier 1"] [--notes "Met at TUM event"]
"""
from __future__ import annotations

import argparse
import logging
import os
from datetime import date

import django
from rich.console import Console
from rich.prompt import Prompt

# Bootstrap Django environment before importing models
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm.settings")
django.setup()

from crm.contacts.models import Contact, OutreachStatus, PipelineStage, Tier
from src.config import Config

console = Console()
logger = logging.getLogger(__name__)


def find_by_linkedin_url(linkedin_url: str) -> Contact | None:
    """Returns an existing contact with this LinkedIn URL, or None."""
    return Contact.objects.filter(linkedin_url=linkedin_url).first()


def update_contact_status(contact: Contact, status: str) -> None:
    """Updates the LinkedIn Outreach Status of an existing contact."""
    contact.outreach_status = status
    contact.save()


def create_contact(
    *,
    name: str,
    linkedin_url: str,
    job_title: str = "",
    tier: str = "Tier 3",
    notes: str = "",
    outreach_status: str = "",
    outreach_owner: str = "",
) -> Contact:
    """Creates a new contact and returns the created contact."""
    contact = Contact.objects.create(
        name=name,
        linkedin_url=linkedin_url,
        job_title=job_title,
        tier=tier,
        notes=notes,
        outreach_status=outreach_status,
        outreach_owner=outreach_owner,
        pipeline_stage=PipelineStage.AWARENESS,
        source="LinkedIn",
        last_contact_date=date.today(),
    )
    return contact


def main() -> None:
    parser = argparse.ArgumentParser(description="Log a LinkedIn contact into TEG SQLite CRM")
    parser.add_argument("--url", required=True, help="LinkedIn profile URL")
    parser.add_argument("--name", default="", help="Full name")
    parser.add_argument("--title", default="", help="Job title")
    parser.add_argument(
        "--tier", default="Tier 3", choices=["Tier 1", "Tier 2", "Tier 3"],
        help="Contact tier (default: Tier 3)",
    )
    parser.add_argument("--notes", default="", help="Optional notes")
    parser.add_argument(
        "--status",
        default="",
        choices=["request_sent", "connected", "messaged", ""],
        help="LinkedIn outreach status",
    )
    parser.add_argument("--owner", default="", help="Team member who sent the request")
    parser.add_argument(
        "--accept",
        action="store_true",
        help="Mark existing contact as Connected (use with --url)",
    )
    args = parser.parse_args()

    if args.accept:
        existing = find_by_linkedin_url(args.url)
        if not existing:
            console.print("[red]Error:[/red] Contact not found for this LinkedIn URL.")
            return
        update_contact_status(existing, "Connected")
        console.print("[green]✓[/green] Marked as Connected")
        return

    existing = find_by_linkedin_url(args.url)
    if existing:
        console.print(f"[yellow]![/yellow] Contact already exists (ID: {existing.id})")
        return

    name = args.name or Prompt.ask("Contact name")
    if not name.strip():
        console.print("[red]Error:[/red] Name is required.")
        return

    STATUS_MAP = {"request_sent": "Request Sent", "connected": "Connected", "messaged": "Messaged"}
    contact = create_contact(
        name=name.strip(),
        linkedin_url=args.url,
        job_title=args.title,
        tier=args.tier,
        notes=args.notes,
        outreach_status=STATUS_MAP.get(args.status, ""),
        outreach_owner=args.owner,
    )
    console.print(f"[green]✓[/green] Created: {name.strip()}")
    console.print(f"  ID: {contact.id}")


if __name__ == "__main__":
    main()
