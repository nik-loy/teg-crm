"""Generates a static HTML pipeline dashboard from Notion data.

Run: python -m src.dashboard.generate_dashboard [--output dashboard_output/index.html]
"""
from __future__ import annotations

import argparse
import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console

from src.config import Config
from src.notion_helpers import paginated_query

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


def aggregate(contacts: list[dict]) -> DashboardData:
    """Pure aggregation — no Notion calls. Accepts raw Notion page dicts."""
    data = DashboardData(generated_at=datetime.now(UTC).isoformat())
    data.total_contacts = len(contacts)
    today = date.today().isoformat()

    for contact in contacts:
        props = contact.get("properties", {})

        stage = props.get("Pipeline Stage", {}).get("select")
        if stage:
            data.by_stage[stage["name"]] = data.by_stage.get(stage["name"], 0) + 1

        tier = props.get("Tier", {}).get("select")
        if tier:
            data.by_tier[tier["name"]] = data.by_tier.get(tier["name"], 0) + 1

        source = props.get("Source", {}).get("select")
        if source:
            data.by_source[source["name"]] = data.by_source.get(source["name"], 0) + 1

        fu_complete = props.get("Follow-Up Complete", {}).get("checkbox", False)
        fu_due = props.get("Follow-Up Due Date", {}).get("date")
        if not fu_complete and fu_due and fu_due.get("start", "") < today:
            data.overdue_count += 1

        created = contact.get("created_time", "")
        if created:
            month = created[:7]
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

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    console.print("Fetching contacts from Notion...")
    contacts = paginated_query(client, cfg.contacts_db_id)
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
