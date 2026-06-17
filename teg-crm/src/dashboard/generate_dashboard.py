"""Generates a static HTML pipeline dashboard from SQLite data.

Run: python -m src.dashboard.generate_dashboard [--output dashboard_output/index.html]
"""
from __future__ import annotations

import argparse
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path

import django
from dotenv import load_dotenv
from rich.console import Console

# Bootstrap Django environment before importing models
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm.settings")
django.setup()

from crm.contacts.models import Contact
from src.config import Config

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)


@dataclass
class DashboardData:
    by_stage: dict[str, int] = field(default_factory=dict)
    by_tier: dict[str, int] = field(default_factory=dict)
    by_source: dict[str, int] = field(default_factory=dict)
    new_by_month: dict[str, int] = field(default_factory=dict)
    overdue_count: int = 0
    total_contacts: int = 0
    generated_at: str = ""


def aggregate(contacts: list[Contact]) -> DashboardData:
    """Pure aggregation — accepts Contact model objects."""
    data = DashboardData(generated_at=datetime.now(UTC).isoformat())
    data.total_contacts = len(contacts)
    today = date.today()

    for contact in contacts:
        stage = contact.pipeline_stage
        if stage:
            data.by_stage[stage] = data.by_stage.get(stage, 0) + 1

        tier = contact.tier
        if tier:
            data.by_tier[tier] = data.by_tier.get(tier, 0) + 1

        source = contact.source
        if source:
            data.by_source[source] = data.by_source.get(source, 0) + 1

        fu_complete = contact.follow_up_complete
        fu_due = contact.follow_up_due_date
        if not fu_complete and fu_due and fu_due < today:
            data.overdue_count += 1

        created = contact.created_at
        if created:
            month = created.strftime("%Y-%m")
            data.new_by_month[month] = data.new_by_month.get(month, 0) + 1

    return data


def render_dashboard(data: DashboardData, template_path: Path, output_path: Path) -> None:
    """Injects aggregated data into the HTML template and writes the output file."""
    template = template_path.read_text(encoding="utf-8")
    payload = json.dumps({
        "by_stage": data.by_stage,
        "by_tier": data.by_tier,
        "by_source": data.by_source,
        "new_by_month": dict(sorted(data.new_by_month.items())),
        "overdue_count": data.overdue_count,
        "total_contacts": data.total_contacts,
        "generated_at": data.generated_at,
    })
    html = template.replace("{{DASHBOARD_DATA}}", payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TEG CRM pipeline dashboard")
    parser.add_argument(
        "--output",
        default="dashboard_output/index.html",
        help="Output file path (default: dashboard_output/index.html)",
    )
    args = parser.parse_args()

    console.print("Fetching contacts from SQLite...")
    contacts = list(Contact.objects.all())
    console.print(f"  [green]✓[/green] {len(contacts)} contacts loaded")

    data = aggregate(contacts)
    template_path = Path(__file__).parent / "template.html"
    output_path = Path(args.output)
    render_dashboard(data, template_path, output_path)

    console.print(f"\n[bold green]✓ Dashboard generated:[/bold green] {output_path.resolve()}")
    console.print(f"  Total contacts    : {data.total_contacts}")
    console.print(f"  Overdue follow-ups: {data.overdue_count}")


if __name__ == "__main__":
    main()
