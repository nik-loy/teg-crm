#!/usr/bin/env python3
"""
One-time migration script to add the three missing properties needed for
pending-request logging to the Notion Contacts DB:

  - Contact Source   (select)         — e.g. "Pending Requests Paste"
  - Profile Summary  (rich_text)      — LinkedIn headline / bio snippet
  - Request Sent Date (date)          — when the connection request was sent

Run this once after cloning or whenever the DB schema is missing these fields.

Usage:
    python scripts/add_pending_request_properties.py

Environment Variables Required (loaded from .env.local automatically):
    NOTION_TOKEN            — Notion integration token
    NOTION_CONTACTS_DB_ID   — Contacts database ID
"""

import os
import sys
from pathlib import Path


def load_env_local():
    """Read key=value pairs from .env.local (one level up from scripts/)."""
    env_path = Path(__file__).parent.parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


try:
    from notion_client import Client
except ImportError:
    print("Error: notion-client is required.  Install with:  pip install notion-client")
    sys.exit(1)


PROPERTIES_TO_ADD = {
    "Contact Source": {
        "select": {
            "options": [
                {"name": "Pending Requests Paste"},
                {"name": "Event"},
                {"name": "Manual"},
                {"name": "Screenshot Import"},
            ]
        }
    },
    "Profile Summary": {
        "rich_text": {}
    },
    "Request Sent Date": {
        "date": {}
    },
}


def main() -> int:
    load_env_local()

    notion_token = os.getenv("NOTION_TOKEN")
    contacts_db_id = os.getenv("NOTION_CONTACTS_DB_ID")

    if not notion_token:
        print("Error: NOTION_TOKEN is not set (check .env.local or your shell env)")
        return 1
    if not contacts_db_id:
        print("Error: NOTION_CONTACTS_DB_ID is not set (check .env.local or your shell env)")
        return 1

    # Strip query parameters if user accidentally copied them from the browser URL
    if "?" in contacts_db_id:
        contacts_db_id = contacts_db_id.split("?")[0]
        print("Note: stripped query parameters from NOTION_CONTACTS_DB_ID")

    client = Client(auth=notion_token)

    # Fetch current schema so we can skip properties that already exist
    try:
        db = client.databases.retrieve(database_id=contacts_db_id)
    except Exception as e:
        print(f"Error: could not fetch database schema — {e}")
        print("Check that the token is valid and the integration is invited to the database.")
        return 1

    existing = set(db["properties"].keys())  # type: ignore[index]
    to_add = {k: v for k, v in PROPERTIES_TO_ADD.items() if k not in existing}

    if not to_add:
        print("All three properties already exist in the database — nothing to do.")
        return 0

    print(f"Found {len(to_add)} missing properties to add:")
    for name in to_add:
        prop_type = next(iter(PROPERTIES_TO_ADD[name]))
        print(f"  + {name!r}  ({prop_type})")

    try:
        client.databases.update(
            database_id=contacts_db_id,
            properties=to_add,  # type: ignore[arg-type]
        )
    except Exception as e:
        print(f"\nError: Notion API rejected the update — {e}")
        print("\nMake sure:")
        print("  1. NOTION_TOKEN has 'Insert content' + 'Read content' capabilities")
        print("  2. The integration is invited to the workspace page that owns the DB")
        return 1

    print(f"\n✓ Successfully added {len(to_add)} properties to the Contacts DB!")
    for name in to_add:
        prop_type = next(iter(PROPERTIES_TO_ADD[name]))
        print(f"  ✓ {name!r}  ({prop_type})")

    already = [k for k in PROPERTIES_TO_ADD if k not in to_add]
    if already:
        print(f"\n(already existed, skipped: {', '.join(already)})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
