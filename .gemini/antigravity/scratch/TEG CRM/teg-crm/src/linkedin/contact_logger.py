"""LinkedIn Contact Logger.

Creates a Notion contact entry from a LinkedIn URL + minimal manual input.
Deduplicates by LinkedIn URL before creating — safe to run twice.

Run: python -m src.linkedin.contact_logger \\
     --url https://www.linkedin.com/in/firstname-lastname \\
     [--name "First Last"] [--title "VP Finance"] [--tier "Tier 1"] [--notes "Met at TUM event"]
"""
from __future__ import annotations

import argparse
import logging
from datetime import date

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.prompt import Prompt

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


def find_by_linkedin_url(client: Client, cfg: Config, linkedin_url: str) -> str | None:
    """Returns the page ID of an existing contact with this LinkedIn URL, or None."""
    results = with_retry(lambda: client.databases.query(
        database_id=cfg.contacts_db_id,
        filter={"property": "LinkedIn URL", "url": {"equals": linkedin_url}},
        page_size=1,
    ))
    if results.get("results"):
        return results["results"][0]["id"]
    return None


def update_contact_status(client: Client, page_id: str, status: str) -> None:
    """Updates the LinkedIn Outreach Status of an existing contact page."""
    with_retry(lambda: client.pages.update(
        page_id=page_id,
        properties={"LinkedIn Outreach Status": select_prop(status)},
    ))


def create_contact(
    client: Client,
    cfg: Config,
    *,
    name: str,
    linkedin_url: str,
    job_title: str = "",
    tier: str = "Tier 3",
    notes: str = "",
    outreach_status: str = "",
    outreach_owner: str = "",
) -> dict:
    """Creates a new Notion contact page and returns the created page dict."""
    props: dict = {
        "Name": title_prop(name),
        "LinkedIn URL": url_prop(linkedin_url),
        "Pipeline Stage": select_prop("Awareness"),
        "Source": select_prop("LinkedIn"),
        "Tier": select_prop(tier),
        "Last Contact Date": date_prop(date.today().isoformat()),
    }
    if job_title:
        props["Job Title"] = rich_text_prop(job_title)
    if notes:
        props["Notes"] = rich_text_prop(notes)
    if outreach_status:
        props["LinkedIn Outreach Status"] = select_prop(outreach_status)
    if outreach_owner:
        props["Outreach Owner"] = rich_text_prop(outreach_owner)
    return with_retry(lambda: client.pages.create(
        parent={"database_id": cfg.contacts_db_id},
        properties=props,
    ))


def main() -> None:
    parser = argparse.ArgumentParser(description="Log a LinkedIn contact into TEG Notion CRM")
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

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    if args.accept:
        existing_id = find_by_linkedin_url(client, cfg, args.url)
        if not existing_id:
            console.print("[red]Error:[/red] Contact not found for this LinkedIn URL.")
            return
        update_contact_status(client, existing_id, "Connected")
        console.print("[green]✓[/green] Marked as Connected")
        return

    existing_id = find_by_linkedin_url(client, cfg, args.url)
    if existing_id:
        console.print(f"[yellow]![/yellow] Contact already exists (page: {existing_id})")
        return

    name = args.name or Prompt.ask("Contact name")
    if not name.strip():
        console.print("[red]Error:[/red] Name is required.")
        return

    STATUS_MAP = {"request_sent": "Request Sent", "connected": "Connected", "messaged": "Messaged"}
    page = create_contact(
        client, cfg,
        name=name.strip(),
        linkedin_url=args.url,
        job_title=args.title,
        tier=args.tier,
        notes=args.notes,
        outreach_status=STATUS_MAP.get(args.status, ""),
        outreach_owner=args.owner,
    )
    console.print(f"[green]✓[/green] Created: {name.strip()}")
    page_url = page.get("url", "")
    if page_url:
        console.print(f"  {page_url}")


if __name__ == "__main__":
    main()
