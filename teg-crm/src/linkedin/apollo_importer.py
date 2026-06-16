"""Apollo.ai CSV → Notion batch importer.

Reads an Apollo export CSV, checks blacklist + dedup, creates Notion contacts.

Run: python -m src.linkedin.apollo_importer --csv apollo_export.csv --owner niklas
     [--dry-run]  -- print summary without writing to Notion
"""
from __future__ import annotations

import argparse
import csv
import io
import logging
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.table import Table

from src.config import Config
from src.notion_helpers import (
    date_prop,
    rich_text_prop,
    select_prop,
    title_prop,
    url_prop,
    with_retry,
)

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)


def parse_apollo_csv(csv_text: str) -> list[dict]:
    """Parses Apollo CSV text into normalised row dicts. Skips rows without LinkedIn URL."""
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    for raw in reader:
        first = raw.get("First Name", "").strip()
        last = raw.get("Last Name", "").strip()
        name = f"{first} {last}".strip()
        linkedin = raw.get("LinkedIn URL", "").strip().rstrip("/")
        if not linkedin:
            continue
        rows.append({
            "name": name,
            "linkedin_url": linkedin,
            "email": raw.get("Email", "").strip().lower(),
            "company": raw.get("Company", "").strip(),
            "job_title": raw.get("Title", "").strip(),
        })
    return rows


def is_blacklisted(company: str, blacklist: list[str]) -> bool:
    """Returns True if company name contains any blacklisted string (case-insensitive)."""
    company_lower = company.lower()
    return any(b.lower() in company_lower for b in blacklist)


def _find_by_linkedin(client: Client, cfg: Config, url: str) -> bool:
    res = with_retry(lambda: client.databases.query(
        database_id=cfg.contacts_db_id,
        filter={"property": "LinkedIn URL", "url": {"equals": url}},
        page_size=1,
    ))
    return bool(res.get("results"))


def _find_by_email(client: Client, cfg: Config, email: str) -> bool:
    if not email:
        return False
    res = with_retry(lambda: client.databases.query(
        database_id=cfg.contacts_db_id,
        filter={"property": "Email", "email": {"equals": email}},
        page_size=1,
    ))
    return bool(res.get("results"))


def batch_import(
    client: Client,
    cfg: Config,
    rows: list[dict],
    owner: str = "",
    dry_run: bool = False,
) -> dict[str, int]:
    """Creates Notion contacts from parsed rows. Returns summary dict."""
    summary = {"created": 0, "skipped_blacklist": 0, "skipped_existing": 0}

    for row in rows:
        if is_blacklisted(row["company"], cfg.outreach_blacklist):
            console.print(f"[yellow]⊘[/yellow] Blacklist: {row['name']} ({row['company']})")
            summary["skipped_blacklist"] += 1
            continue

        if _find_by_linkedin(client, cfg, row["linkedin_url"]):
            console.print(f"[yellow]⊘[/yellow] Exists (LinkedIn): {row['name']}")
            summary["skipped_existing"] += 1
            continue

        if row["email"] and _find_by_email(client, cfg, row["email"]):
            console.print(f"[yellow]⊘[/yellow] Exists (email): {row['name']}")
            summary["skipped_existing"] += 1
            continue

        if dry_run:
            console.print(f"[dim]dry-run[/dim] Would create: {row['name']}")
            summary["created"] += 1
            continue

        props: dict = {
            "Name": title_prop(row["name"]),
            "LinkedIn URL": url_prop(row["linkedin_url"]),
            "Pipeline Stage": select_prop("Awareness"),
            "Source": select_prop("LinkedIn"),
            "Tier": select_prop("Tier 3"),
            "Last Contact Date": date_prop(date.today().isoformat()),
            "LinkedIn Outreach Status": select_prop("Request Sent"),
        }
        if row["job_title"]:
            props["Job Title"] = rich_text_prop(row["job_title"])
        if owner:
            props["Outreach Owner"] = rich_text_prop(owner)

        with_retry(lambda: client.pages.create(
            parent={"database_id": cfg.contacts_db_id},
            properties=props,
        ))
        console.print(f"[green]✓[/green] Created: {row['name']} ({row['company']})")
        summary["created"] += 1

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Apollo CSV export into TEG Notion CRM")
    parser.add_argument("--csv", required=True, help="Path to Apollo CSV export file")
    parser.add_argument("--owner", default="", help="Team member name (logged as Outreach Owner)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without writing")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        console.print(f"[red]Error:[/red] File not found: {csv_path}")
        return

    csv_text = csv_path.read_text(encoding="utf-8-sig")  # utf-8-sig handles Excel BOM
    rows = parse_apollo_csv(csv_text)
    console.print(f"[dim]Parsed {len(rows)} rows with LinkedIn URLs from {csv_path.name}[/dim]")

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    summary = batch_import(client, cfg, rows, owner=args.owner, dry_run=args.dry_run)

    table = Table(show_header=False, box=None, padding=(0, 1))
    table.add_row("[bold green]Created[/bold green]", str(summary["created"]))
    table.add_row("[yellow]Skipped — blacklist[/yellow]", str(summary["skipped_blacklist"]))
    table.add_row("[yellow]Skipped — already exists[/yellow]", str(summary["skipped_existing"]))
    console.print("\n")
    console.print(table)


if __name__ == "__main__":
    main()
