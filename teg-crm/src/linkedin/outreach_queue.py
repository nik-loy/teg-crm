"""Outreach queue viewer — shows who needs action today.

Run: python -m src.linkedin.outreach_queue [--owner niklas] [--stale-days 3]
"""
from __future__ import annotations

import argparse
from datetime import date, timedelta

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.table import Table

from src.config import Config
from src.notion_helpers import paginated_query

load_dotenv()
console = Console()

ORDERED_STATUSES = ["Request Sent", "Connected", "Messaged"]
STATUS_COLORS = {
    "Request Sent": "yellow",
    "Connected": "blue",
    "Messaged": "green",
    "No Status": "dim",
}


def extract_name(page: dict) -> str:
    title = page["properties"].get("Name", {}).get("title", [])
    return title[0]["text"]["content"] if title else "(no name)"


def extract_owner(page: dict) -> str:
    rt = page["properties"].get("Outreach Owner", {}).get("rich_text", [])
    return rt[0]["text"]["content"] if rt else ""


def group_by_status(contacts: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = {s: [] for s in ORDERED_STATUSES}
    groups["No Status"] = []
    for c in contacts:
        sel = (c["properties"].get("LinkedIn Outreach Status") or {}).get("select")
        status = sel["name"] if sel else "No Status"
        groups.setdefault(status, []).append(c)
    return groups


def get_stale_requests(contacts: list[dict], stale_after_days: int = 3) -> list[dict]:
    cutoff = (date.today() - timedelta(days=stale_after_days)).isoformat()
    stale = []
    for c in contacts:
        sel = (c["properties"].get("LinkedIn Outreach Status") or {}).get("select")
        if sel and sel["name"] == "Request Sent":
            created = c.get("created_time", "")[:10]
            if created and created < cutoff:
                stale.append(c)
    return stale


def main() -> None:
    parser = argparse.ArgumentParser(description="View LinkedIn outreach queue")
    parser.add_argument("--owner", default="", help="Filter by owner name")
    parser.add_argument("--stale-days", type=int, default=3, help="Days after which request is 'stale'")
    args = parser.parse_args()

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    filter_obj: dict | None = None
    if args.owner:
        filter_obj = {"property": "Outreach Owner", "rich_text": {"contains": args.owner}}

    all_contacts = paginated_query(client, cfg.contacts_db_id, filter=filter_obj)
    outreach_contacts = [
        c for c in all_contacts
        if (c["properties"].get("LinkedIn Outreach Status") or {}).get("select")
    ]

    groups = group_by_status(outreach_contacts)
    stale = get_stale_requests(outreach_contacts, args.stale_days)

    if stale:
        console.print(f"\n[bold yellow]Stale requests (>{args.stale_days} days, no response)[/bold yellow]")
        t = Table(show_header=False, box=None, padding=(0, 2))
        for c in stale:
            created = c.get("created_time", "")[:10]
            t.add_row(
                "[yellow]•[/yellow]", extract_name(c),
                f"[dim]{extract_owner(c)}[/dim]", f"[dim]since {created}[/dim]",
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
            created = c.get("created_time", "")[:10]
            t.add_row(
                f"[{color}]•[/{color}]", extract_name(c),
                f"[dim]{extract_owner(c)}[/dim]", f"[dim]{created}[/dim]",
            )
        console.print(t)

    if not outreach_contacts:
        console.print("[dim]No LinkedIn outreach contacts found.[/dim]")


if __name__ == "__main__":
    main()
