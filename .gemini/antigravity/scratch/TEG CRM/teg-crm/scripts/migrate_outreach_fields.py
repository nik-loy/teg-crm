"""Add LinkedIn Outreach Status and Outreach Owner to existing Contacts DB.

Run: python -m scripts.migrate_outreach_fields
Idempotent — safe to run twice (Notion ignores duplicate property names).
"""
from __future__ import annotations

import logging

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console

from src.config import Config

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)


def migrate(client: Client, cfg: Config) -> None:
    client.databases.update(
        database_id=cfg.contacts_db_id,
        properties={
            "LinkedIn Outreach Status": {
                "select": {
                    "options": [
                        {"name": "Request Sent", "color": "yellow"},
                        {"name": "Connected", "color": "blue"},
                        {"name": "Messaged", "color": "green"},
                    ]
                }
            },
            "Outreach Owner": {"rich_text": {}},
        },
    )
    console.print("[green]✓[/green] Migration complete — properties added to Contacts DB.")


def main() -> None:
    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)
    migrate(client, cfg)


if __name__ == "__main__":
    main()
