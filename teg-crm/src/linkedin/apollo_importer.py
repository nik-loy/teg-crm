"""Apollo.ai CSV → SQLite batch importer.

Reads an Apollo export CSV, checks blacklist + dedup, creates SQLite contacts.

Run: python -m src.linkedin.apollo_importer --csv apollo_export.csv --owner niklas
     [--dry-run]  -- print summary without writing to SQLite
"""
from __future__ import annotations

import argparse
import csv
import io
import os
from datetime import date
from pathlib import Path

import django
from rich.console import Console
from rich.table import Table

# Bootstrap Django environment before importing models
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm.settings")
django.setup()

from crm.contacts.models import Contact, OutreachStatus, PipelineStage
from src.config import Config

console = Console()


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


def batch_import(
    cfg: Config,
    rows: list[dict],
    owner: str = "",
    dry_run: bool = False,
) -> dict[str, int]:
    """Creates contacts from parsed rows. Returns summary dict."""
    summary = {"created": 0, "skipped_blacklist": 0, "skipped_existing": 0}

    for row in rows:
        if is_blacklisted(row["company"], cfg.outreach_blacklist):
            console.print(f"[yellow]⊘[/yellow] Blacklist: {row['name']} ({row['company']})")
            summary["skipped_blacklist"] += 1
            continue

        if Contact.objects.filter(linkedin_url=row["linkedin_url"]).exists():
            console.print(f"[yellow]⊘[/yellow] Exists (LinkedIn): {row['name']}")
            summary["skipped_existing"] += 1
            continue

        if dry_run:
            console.print(f"[dim]dry-run[/dim] Would create: {row['name']}")
            summary["created"] += 1
            continue

        Contact.objects.create(
            name=row["name"],
            linkedin_url=row["linkedin_url"],
            job_title=row["job_title"],
            company_name=row["company"],
            pipeline_stage=PipelineStage.AWARENESS,
            source="LinkedIn",
            tier="Tier 3",
            last_contact_date=date.today(),
            outreach_status=OutreachStatus.REQUEST_SENT,
            outreach_owner=owner,
        )
        console.print(f"[green]✓[/green] Created: {row['name']} ({row['company']})")
        summary["created"] += 1

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Apollo CSV export into TEG SQLite CRM")
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

    summary = batch_import(cfg, rows, owner=args.owner, dry_run=args.dry_run)

    table = Table(show_header=False, box=None, padding=(0, 1))
    table.add_row("[bold green]Created[/bold green]", str(summary["created"]))
    table.add_row("[yellow]Skipped — blacklist[/yellow]", str(summary["skipped_blacklist"]))
    table.add_row("[yellow]Skipped — already exists[/yellow]", str(summary["skipped_existing"]))
    console.print("\n")
    console.print(table)


if __name__ == "__main__":
    main()
