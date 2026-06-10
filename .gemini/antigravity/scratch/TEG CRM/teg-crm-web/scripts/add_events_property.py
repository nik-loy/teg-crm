#!/usr/bin/env python3
"""
One-time migration script to add the "Events" multi-select property to the Notion Contacts DB.

This script reads the Notion token and Contacts database ID from environment variables,
then adds a multi-select property named "Events" with initial options from the events registry.

Usage:
    python scripts/add_events_property.py

Environment Variables Required:
    NOTION_TOKEN — Notion integration token (must have edit access to the database)
    NOTION_CONTACTS_DB_ID — ID of the Contacts database
"""

import json
import os
import sys
from pathlib import Path

try:
    from notion_client import Client
except ImportError:
    print("Error: notion-client is required. Install with: pip install notion-client")
    sys.exit(1)


def main():
    # Load environment variables
    notion_token = os.getenv("NOTION_TOKEN")
    contacts_db_id = os.getenv("NOTION_CONTACTS_DB_ID")

    if not notion_token:
        print("Error: NOTION_TOKEN environment variable not set")
        sys.exit(1)
    if not contacts_db_id:
        print("Error: NOTION_CONTACTS_DB_ID environment variable not set")
        sys.exit(1)

    # Load events from registry
    registry_path = Path(__file__).parent.parent / "config" / "events-registry.json"
    if not registry_path.exists():
        print(f"Error: events registry not found at {registry_path}")
        sys.exit(1)

    with open(registry_path) as f:
        events = json.load(f)

    if not events:
        print("Warning: no events in registry, adding empty Events property")
        events = []

    print(f"Adding Events property with {len(events)} options:")
    for event in events:
        print(f"  - {event}")

    # Initialize Notion client
    client = Client(auth=notion_token)

    # Build the property definition
    # Multi-select property with options for each event
    events_property = {
        "multi_select": {
            "options": [{"name": event} for event in events]
        }
    }

    try:
        # Update the database schema
        response = client.databases.update(
            database_id=contacts_db_id,
            properties={
                "Events": events_property
            }
        )
        print("\n✓ Successfully added Events property to Contacts DB!")
        print(f"Database ID: {contacts_db_id}")
        print(f"Property: Events (multi_select)")
        print(f"Options: {len(events)}")
        return 0
    except Exception as e:
        print(f"\n✗ Error adding Events property: {e}")
        print("\nMake sure:")
        print("  1. NOTION_TOKEN is a valid integration token with database edit permissions")
        print("  2. NOTION_CONTACTS_DB_ID is the correct database ID")
        print("  3. The Notion integration is invited to the database")
        return 1


if __name__ == "__main__":
    sys.exit(main())
