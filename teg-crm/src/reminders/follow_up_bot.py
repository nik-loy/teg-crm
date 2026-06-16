"""Daily follow-up reminder bot.

Queries Notion for overdue follow-ups, groups by team member,
and sends one summary email per assignee via Resend.

Unassigned contacts (no Follow-Up Owner set) are broadcast to all team members.

Run: python -m src.reminders.follow_up_bot
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date

import resend
from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console

from src.config import Config, TeamMember
from src.notion_helpers import paginated_query

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

_FROM_EMAIL = "crm@teg.de"


@dataclass
class OverdueContact:
    name: str
    company: str
    due_date: str
    page_url: str


@dataclass
class OwnerSummary:
    member: TeamMember
    contacts: list[OverdueContact] = field(default_factory=list)


def fetch_overdue_contacts(client: Client, cfg: Config) -> list[dict]:
    """Returns Notion contact pages where follow-up is incomplete and past due."""
    today = date.today().isoformat()
    return paginated_query(
        client,
        cfg.contacts_db_id,
        filter={
            "and": [
                {"property": "Follow-Up Complete", "checkbox": {"equals": False}},
                {"property": "Follow-Up Due Date", "date": {"on_or_before": today}},
            ]
        },
    )


def group_by_owner(contacts: list[dict], cfg: Config) -> dict[str, OwnerSummary]:
    """Groups overdue contacts by their assigned Follow-Up Owner.

    Contacts with no owner are added to every team member's summary so
    nothing falls through the cracks.
    """
    member_map = {m.notion_id: m for m in cfg.team_members}
    summaries: dict[str, OwnerSummary] = {}

    for contact in contacts:
        props = contact.get("properties", {})
        name_parts = props.get("Name", {}).get("title", [])
        name = "".join(p.get("plain_text", "") for p in name_parts) or "Unknown"
        due = props.get("Follow-Up Due Date", {}).get("date") or {}
        due_date = due.get("start", "")
        page_url = contact.get("url", "")

        overdue = OverdueContact(name=name, company="", due_date=due_date, page_url=page_url)

        owners = props.get("Follow-Up Owner", {}).get("people", [])
        if not owners:
            for member in cfg.team_members:
                summaries.setdefault(member.notion_id, OwnerSummary(member=member))
                summaries[member.notion_id].contacts.append(overdue)
        else:
            for owner in owners:
                uid = owner.get("id", "")
                if uid not in member_map:
                    continue
                member = member_map[uid]
                summaries.setdefault(uid, OwnerSummary(member=member))
                summaries[uid].contacts.append(overdue)

    return summaries


def _format_email_body(summary: OwnerSummary) -> str:
    """Formats the plain-text reminder email for one team member."""
    count = len(summary.contacts)
    lines = [
        f"Hi {summary.member.name},",
        "",
        f"You have {count} overdue follow-up{'s' if count != 1 else ''} in the TEG CRM:",
        "",
    ]
    for c in summary.contacts:
        lines.append(f"• {c.name}" + (f" ({c.company})" if c.company else ""))
        if c.due_date:
            lines.append(f"  Due: {c.due_date}")
        if c.page_url:
            lines.append(f"  {c.page_url}")
        lines.append("")
    lines += [
        "Please action these at your earliest convenience.",
        "",
        "— TEG CRM Bot",
    ]
    return "\n".join(lines)


def send_email_reminder(summary: OwnerSummary, api_key: str) -> None:
    resend.api_key = api_key
    resend.Emails.send({
        "from": _FROM_EMAIL,
        "to": [summary.member.email],
        "subject": f"TEG CRM: {len(summary.contacts)} overdue follow-up(s)",
        "text": _format_email_body(summary),
    })


def run_reminders(client: Client, cfg: Config) -> int:
    """Sends reminder emails for overdue follow-ups. Returns count of emails sent."""
    contacts = fetch_overdue_contacts(client, cfg)
    console.print(f"Found {len(contacts)} overdue follow-up(s)")

    if not contacts:
        console.print("[green]All follow-ups are up to date.[/green]")
        return 0

    summaries = group_by_owner(contacts, cfg)
    sent = 0
    for summary in summaries.values():
        if not summary.contacts:
            continue
        console.print(
            f"  Sending to {summary.member.name} ({len(summary.contacts)} item(s))..."
        )
        if not cfg.resend_api_key:
            console.print(f"    [yellow]![/yellow] No RESEND_API_KEY — skipping {summary.member.name}")
            continue
        try:
            send_email_reminder(summary, cfg.resend_api_key)
            sent += 1
            console.print(f"    [green]✓[/green] Sent to {summary.member.email}")
        except Exception as exc:
            logger.error("Failed to send reminder to %s: %s", summary.member.name, exc)

    return sent


def main() -> None:
    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)
    total = run_reminders(client, cfg)
    console.print(f"\n[bold]Done.[/bold] Sent {total} reminder(s).")


if __name__ == "__main__":
    main()
