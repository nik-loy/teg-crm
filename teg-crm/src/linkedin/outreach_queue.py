"""Outreach queue viewer — shows who needs action today.

Run: python -m src.linkedin.outreach_queue [--owner niklas] [--stale-days 3]
"""
from __future__ import annotations

import argparse
import os
from datetime import date, timedelta

import django
from rich.console import Console
from rich.table import Table

# Bootstrap Django environment before importing models
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm.settings")
django.setup()

from crm.contacts.models import Contact
from src.config import Config

console = Console()

ORDERED_STATUSES = ["Request Sent", "Connected", "Messaged"]
STATUS_COLORS = {
    "Request Sent": "yellow",
    "Connected": "blue",
    "Messaged": "green",
    "No Status": "dim",
}


def group_by_status(contacts: list[Contact]) -> dict[str, list[Contact]]:
    groups: dict[str, list[Contact]] = {s: [] for s in ORDERED_STATUSES}
    groups["No Status"] = []
    for c in contacts:
        status = c.outreach_status or "No Status"
        groups.setdefault(status, []).append(c)
    return groups


def get_stale_requests(contacts: list[Contact], stale_after_days: int = 3) -> list[Contact]:
    cutoff = date.today() - timedelta(days=stale_after_days)
    return [
        c for c in contacts
        if c.outreach_status == "Request Sent" and c.created_at.date() < cutoff
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="View LinkedIn outreach queue")
    parser.add_argument("--owner", default="", help="Filter by owner name")
    parser.add_argument("--stale-days", type=int, default=3, help="Days after which request is 'stale'")
    args = parser.parse_args()

    cfg = Config.from_env()

    # Query contacts with outreach status
    query = Contact.objects.exclude(outreach_status="")
    if args.owner:
        query = query.filter(outreach_owner__icontains=args.owner)

    contacts = list(query)

    groups = group_by_status(contacts)
    stale = get_stale_requests(contacts, args.stale_days)

    if stale:
        console.print(f"\n[bold yellow]Stale requests (>{args.stale_days} days, no response)[/bold yellow]")
        t = Table(show_header=False, box=None, padding=(0, 2))
        for c in stale:
            created = c.created_at.date().isoformat()
            t.add_row(
                "[yellow]•[/yellow]", c.name,
                f"[dim]{c.outreach_owner}[/dim]", f"[dim]since {created}[/dim]",
            )
        console.print(t)

    for status in ORDERED_STATUSES:
        pages = groups.get(status, [])
        if not pages:
            continue
        color = STATUS_COLORS.get(status, "white")
        console.print(f"\n[bold {color}]{status}[/bold {color}] ({len(pages)})")
        t = Table(show_header=False, box=None, padding=(0, 2))
        for c in pages:
            created = c.created_at.date().isoformat()
            t.add_row(
                f"[{color}]•[/{color}]", c.name,
                f"[dim]{c.outreach_owner}[/dim]", f"[dim]{created}[/dim]",
            )
        console.print(t)

    if not contacts:
        console.print("[dim]No LinkedIn outreach contacts found.[/dim]")


if __name__ == "__main__":
    main()
