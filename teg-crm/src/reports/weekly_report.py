"""Weekly pipeline report generator.

Summarises new contacts added this week, overdue follow-ups, pipeline stage
distribution, and upcoming events. Sends to all team members via Resend.

Run: python -m src.reports.weekly_report
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta

import resend
from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console

from src.config import Config
from src.notion_helpers import paginated_query

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

_FROM_EMAIL = "crm@teg.de"
_STAGE_ORDER = ["Awareness", "First Attendance", "Engaged", "Deepening", "Activated"]


@dataclass
class WeeklyReportData:
    new_contacts: list[dict] = field(default_factory=list)
    overdue_count: int = 0
    stage_distribution: dict[str, int] = field(default_factory=dict)
    upcoming_events: list[dict] = field(default_factory=list)
    week_start: str = ""
    week_end: str = ""


def build_report(
    contacts: list[dict],
    events: list[dict],
    week_start: date,
    week_end: date,
) -> WeeklyReportData:
    """Pure aggregation — no Notion calls. Accepts raw Notion page dicts."""
    report = WeeklyReportData(
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
    )
    today = date.today().isoformat()
    ws = week_start.isoformat()
    we = week_end.isoformat()

    for contact in contacts:
        props = contact.get("properties", {})
        created = contact.get("created_time", "")[:10]

        if ws <= created <= we:
            report.new_contacts.append(contact)

        fu_complete = props.get("Follow-Up Complete", {}).get("checkbox", False)
        fu_due = props.get("Follow-Up Due Date", {}).get("date")
        if not fu_complete and fu_due and fu_due.get("start", "") < today:
            report.overdue_count += 1

        stage = props.get("Pipeline Stage", {}).get("select")
        if stage:
            s = stage["name"]
            report.stage_distribution[s] = report.stage_distribution.get(s, 0) + 1

    upcoming_cutoff = (date.today() + timedelta(days=14)).isoformat()
    for event in events:
        evt_date = event.get("properties", {}).get("Date", {}).get("date")
        if evt_date:
            d = evt_date.get("start", "")
            if today <= d <= upcoming_cutoff:
                report.upcoming_events.append(event)

    return report


def _contact_name(contact: dict) -> str:
    parts = contact.get("properties", {}).get("Name", {}).get("title", [])
    return "".join(p.get("plain_text", "") for p in parts) or "Unknown"


def _event_summary(event: dict) -> str:
    props = event.get("properties", {})
    parts = props.get("Event Name", {}).get("title", [])
    name = "".join(p.get("plain_text", "") for p in parts) or "Untitled"
    date_obj = props.get("Date", {}).get("date")
    d = date_obj.get("start", "") if date_obj else ""
    return f"{name} ({d})" if d else name


def format_report_markdown(report: WeeklyReportData) -> str:
    """Formats the weekly report as a plain-text Markdown email body."""
    lines = [
        "# TEG CRM — Weekly Pipeline Report",
        f"Week of {report.week_start} → {report.week_end}",
        "",
        f"## New Contacts This Week ({len(report.new_contacts)})",
    ]
    if report.new_contacts:
        for c in report.new_contacts:
            lines.append(f"- {_contact_name(c)}")
    else:
        lines.append("- None")

    lines += ["", "## Pipeline Stage Distribution"]
    for stage in _STAGE_ORDER:
        count = report.stage_distribution.get(stage, 0)
        if count:
            lines.append(f"- {stage}: {count}")
    for stage, count in report.stage_distribution.items():
        if stage not in _STAGE_ORDER:
            lines.append(f"- {stage}: {count}")

    lines += ["", f"## Overdue Follow-ups: {report.overdue_count}"]
    if report.overdue_count:
        lines.append("  → Run the daily reminder bot to notify owners.")

    lines += ["", "## Upcoming Events (next 14 days)"]
    if report.upcoming_events:
        for e in report.upcoming_events:
            lines.append(f"- {_event_summary(e)}")
    else:
        lines.append("- None scheduled")

    return "\n".join(lines)


def send_report(report_md: str, cfg: Config, to_emails: list[str]) -> None:
    week_line = report_md.split("\n")[1]
    resend.api_key = cfg.resend_api_key
    resend.Emails.send({
        "from": _FROM_EMAIL,
        "to": to_emails,
        "subject": f"TEG CRM Weekly Report — {week_line}",
        "text": report_md,
    })


def main() -> None:
    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    today = date.today()
    week_start = today - timedelta(days=today.weekday() + 7)
    week_end = week_start + timedelta(days=6)

    console.print("Fetching contacts...")
    contacts = paginated_query(client, cfg.contacts_db_id)
    console.print(f"  {len(contacts)} contacts")

    console.print("Fetching events...")
    events = paginated_query(client, cfg.events_db_id)
    console.print(f"  {len(events)} events")

    report = build_report(contacts, events, week_start, week_end)
    report_md = format_report_markdown(report)
    console.print("\n" + report_md)

    to_emails = [m.email for m in cfg.team_members]
    if cfg.resend_api_key and to_emails:
        send_report(report_md, cfg, to_emails)
        console.print(f"\n[green]✓[/green] Report sent to {', '.join(to_emails)}")
    else:
        console.print("\n[yellow]![/yellow] RESEND_API_KEY not set — report printed only")


if __name__ == "__main__":
    main()
