"""Creates all 6 TEG CRM Notion databases under a parent page.

Run: python -m scripts.setup_notion_dbs [--parent-page-id PAGE_ID]

Databases are created in dependency order so relation properties resolve correctly:
  1. Companies   (no relations)
  2. Events      (no relations)
  3. Contacts    (-> Companies)
  4. Events Attended  (-> Contacts, Events)
  5. Interactions     (-> Contacts)
  6. Speaker Pipeline (-> Contacts, Events)
"""
from __future__ import annotations

import argparse
import logging
import os
import time

from dotenv import load_dotenv
from notion_client import Client
from notion_client.errors import APIResponseError
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()
logging.basicConfig(level=logging.WARNING)

_INDUSTRY_OPTIONS = [
    {"name": "Consulting"}, {"name": "Automotive"}, {"name": "Tech"},
    {"name": "Finance"}, {"name": "Energy"}, {"name": "Healthcare"},
    {"name": "Manufacturing"}, {"name": "Media"}, {"name": "Other"},
]


def build_companies_schema(parent_page_id: str) -> dict:
    return {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Companies"}}],
        "properties": {
            "Company Name": {"title": {}},
            "Industry": {"select": {"options": _INDUSTRY_OPTIONS}},
            "Size": {"select": {"options": [
                {"name": "Startup"}, {"name": "SME"},
                {"name": "Mittelstand"}, {"name": "Corporate"},
            ]}},
            "Partnership Tier": {"select": {"options": [
                {"name": "None"}, {"name": "Bronze"},
                {"name": "Silver"}, {"name": "Gold"},
            ]}},
            "Seat Allocation Status": {"select": {"options": [
                {"name": "Not Approached"}, {"name": "Approached"},
                {"name": "Confirmed"}, {"name": "Declined"},
            ]}},
            "Notes": {"rich_text": {}},
        },
    }


def build_events_schema(parent_page_id: str) -> dict:
    return {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Events"}}],
        "properties": {
            "Event Name": {"title": {}},
            "Date": {"date": {}},
            "Speaker": {"rich_text": {}},
            "Topic": {"rich_text": {}},
            "Format": {"select": {"options": [
                {"name": "Panel"}, {"name": "Fireside Chat"},
                {"name": "Roundtable"}, {"name": "Dinner"}, {"name": "Podcast"},
            ]}},
        },
    }


def build_contacts_schema(parent_page_id: str, companies_db_id: str) -> dict:
    return {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Contacts"}}],
        "properties": {
            "Name": {"title": {}},
            "Email": {"email": {}},
            "Phone": {"phone_number": {}},
            "LinkedIn URL": {"url": {}},
            "Company": {"relation": {"database_id": companies_db_id, "single_property": {}}},
            "Job Title": {"rich_text": {}},
            "Industry": {"select": {"options": _INDUSTRY_OPTIONS}},
            "Tier": {"select": {"options": [
                {"name": "Tier 1"}, {"name": "Tier 2"}, {"name": "Tier 3"},
            ]}},
            "Pipeline Stage": {"select": {"options": [
                {"name": "Awareness"}, {"name": "First Attendance"},
                {"name": "Engaged"}, {"name": "Deepening"}, {"name": "Activated"},
            ]}},
            "Source": {"select": {"options": [
                {"name": "TEG Event"}, {"name": "LinkedIn"},
                {"name": "Networking Event"}, {"name": "Podcast"},
                {"name": "Referral"}, {"name": "Alumni"}, {"name": "Company Partnership"},
            ]}},
            "Tags": {"multi_select": {"options": [
                {"name": "potential-speaker"}, {"name": "potential-sponsor"},
                {"name": "podcast-guest"}, {"name": "alumni-TUM"},
                {"name": "alumni-LMU"}, {"name": "advisory-board"},
            ]}},
            "Last Contact Date": {"date": {}},
            "Follow-Up Due Date": {"date": {}},
            "Follow-Up Owner": {"people": {}},
            "Follow-Up Complete": {"checkbox": {}},
            "Notes": {"rich_text": {}},
        },
    }


def build_events_attended_schema(
    parent_page_id: str, contacts_db_id: str, events_db_id: str
) -> dict:
    return {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Events Attended"}}],
        "properties": {
            "Record": {"title": {}},
            "Contact": {"relation": {"database_id": contacts_db_id, "single_property": {}}},
            "Event": {"relation": {"database_id": events_db_id, "single_property": {}}},
            "Date Attended": {"date": {}},
            "Referred By": {"rich_text": {}},
            "Notes": {"rich_text": {}},
        },
    }


def build_interactions_schema(parent_page_id: str, contacts_db_id: str) -> dict:
    return {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Interactions"}}],
        "properties": {
            "Summary": {"title": {}},
            "Contact": {"relation": {"database_id": contacts_db_id, "single_property": {}}},
            "Date": {"date": {}},
            "Type": {"select": {"options": [
                {"name": "LinkedIn Message"}, {"name": "Email"},
                {"name": "Phone Call"}, {"name": "In-Person"},
                {"name": "Podcast"}, {"name": "Event"},
            ]}},
            "Next Action": {"rich_text": {}},
        },
    }


def build_speaker_pipeline_schema(
    parent_page_id: str, contacts_db_id: str, events_db_id: str
) -> dict:
    return {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Speaker Pipeline"}}],
        "properties": {
            "Name": {"title": {}},
            "Contact": {"relation": {"database_id": contacts_db_id, "single_property": {}}},
            "Topic Angle": {"rich_text": {}},
            "Target Event": {"relation": {"database_id": events_db_id, "single_property": {}}},
            "Stage": {"select": {"options": [
                {"name": "Identified"}, {"name": "Researched"}, {"name": "Contacted"},
                {"name": "In Discussion"}, {"name": "Confirmed"},
                {"name": "Delivered"}, {"name": "Post-Event"},
            ]}},
            "Owner": {"people": {}},
            "Notes": {"rich_text": {}},
        },
    }


def create_database(client: Client, schema: dict, name: str) -> str:
    """Creates a single Notion database and returns its ID."""
    console.print(f"  Creating [bold]{name}[/bold]...", end=" ")
    try:
        result = client.databases.create(**schema)
        db_id: str = result["id"]
        console.print(f"[green]✓[/green] {db_id}")
        time.sleep(0.5)
        return db_id
    except APIResponseError as exc:
        console.print(f"[red]✗ {exc}[/red]")
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Create all 6 TEG CRM Notion databases")
    parser.add_argument(
        "--parent-page-id",
        default=os.getenv("NOTION_PARENT_PAGE_ID"),
        help="Notion page ID to create databases under (or set NOTION_PARENT_PAGE_ID)",
    )
    args = parser.parse_args()

    if not args.parent_page_id:
        console.print("[red]Error:[/red] --parent-page-id is required (or set NOTION_PARENT_PAGE_ID in .env)")
        raise SystemExit(1)

    token = os.getenv("NOTION_TOKEN")
    if not token:
        console.print("[red]Error:[/red] NOTION_TOKEN env var not set")
        raise SystemExit(1)

    client = Client(auth=token)
    console.print("\n[bold]Creating TEG CRM databases in dependency order...[/bold]\n")

    pid = args.parent_page_id
    companies_id = create_database(client, build_companies_schema(pid), "Companies")
    events_id = create_database(client, build_events_schema(pid), "Events")
    contacts_id = create_database(client, build_contacts_schema(pid, companies_id), "Contacts")
    attendance_id = create_database(
        client, build_events_attended_schema(pid, contacts_id, events_id), "Events Attended"
    )
    interactions_id = create_database(
        client, build_interactions_schema(pid, contacts_id), "Interactions"
    )
    speakers_id = create_database(
        client, build_speaker_pipeline_schema(pid, contacts_id, events_id), "Speaker Pipeline"
    )

    table = Table(title="\nAll databases created — add these to your .env file")
    table.add_column("Variable", style="cyan")
    table.add_column("Value", style="green")
    table.add_row("NOTION_CONTACTS_DB_ID", contacts_id)
    table.add_row("NOTION_COMPANIES_DB_ID", companies_id)
    table.add_row("NOTION_EVENTS_DB_ID", events_id)
    table.add_row("NOTION_ATTENDANCE_DB_ID", attendance_id)
    table.add_row("NOTION_INTERACTIONS_DB_ID", interactions_id)
    table.add_row("NOTION_SPEAKERS_DB_ID", speakers_id)
    console.print(table)


if __name__ == "__main__":
    main()
