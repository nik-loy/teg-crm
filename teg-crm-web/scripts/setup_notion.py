"""
TEG CRM — Notion Database Setup Script
======================================
Run this once to create or update all required Notion databases with the
full schema (including the 9 new enrichment columns added June 2026).

Usage (PowerShell):
    cd "C:\\...\\TEG CRM\\teg-crm-web"
    python scripts/setup_notion.py

Requirements:
    pip install notion-client python-dotenv

The script will:
  1. Read NOTION_TOKEN from .env.local (or prompt you for it).
  2. Ask for the IDs of existing databases (or a parent page to create new ones).
  3. Add any missing properties to existing DBs (non-destructive).
  4. Print a ready-to-paste .env.local block at the end.
"""

import os
import sys
import json

# ---------------------------------------------------------------------------
# 1. Bootstrap deps
# ---------------------------------------------------------------------------
try:
    from notion_client import Client
except ImportError:
    print("[setup] notion-client not found — installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "notion-client"])
    from notion_client import Client

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
except ImportError:
    pass  # dotenv optional — will prompt for token if not in env

# ---------------------------------------------------------------------------
# 2. Auth
# ---------------------------------------------------------------------------
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
if not NOTION_TOKEN:
    NOTION_TOKEN = input(
        "\nEnter your Notion Integration Token (starts with 'ntn_' or 'secret_'): "
    ).strip()
    if not NOTION_TOKEN:
        print("ERROR: Notion token is required.")
        sys.exit(1)

notion = Client(auth=NOTION_TOKEN)

# Verify token
try:
    me = notion.users.me()
    print(f"\n✓ Authenticated as: {me.get('name', me.get('id'))}")
except Exception as e:
    print(f"\nERROR: Could not authenticate — {e}")
    print("Make sure your token is correct and the integration has access to your workspace.")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 3. Full property schemas
# ---------------------------------------------------------------------------

EVENTS = [
    "AI Consulting Conference 2026 (ACC 2026)",
    "BioTech Conference 2026",
    "Enterprise Sales 2027",
    "Aviation Conference 2027",
]

PIPELINE_STAGES = ["Awareness", "First Attendance", "Engaged", "Deepening", "Activated"]
OUTREACH_STATUSES = ["Request Sent", "Connected", "Messaged", "No Response", "Withdrawn"]
TIERS = ["Tier 1", "Tier 2", "Tier 3"]
SOURCES = ["LinkedIn", "Referral", "Event", "CSV Import", "Other"]
CONNECTION_DEGREES = ["1st", "2nd", "3rd", "unknown"]
INTERACTION_TYPES = ["Message", "Follow-up", "Reply", "Meeting", "Note"]


def select_options(values: list[str]) -> list[dict]:
    return [{"name": v} for v in values]


# Full Contacts DB schema (all columns the app reads/writes)
CONTACTS_PROPERTIES = {
    # --- Core identity ---
    "Name":                     {"title": {}},
    "LinkedIn URL":             {"url": {}},
    "Job Title":                {"rich_text": {}},
    "Company":                  {"rich_text": {}},  # relation if you have a Companies DB; rich_text is simpler
    "Industry":                 {"rich_text": {}},
    # --- CRM workflow ---
    "Tier":                     {"select": {"options": select_options(TIERS)}},
    "Pipeline Stage":           {"select": {"options": select_options(PIPELINE_STAGES)}},
    "Source":                   {"select": {"options": select_options(SOURCES)}},
    "LinkedIn Outreach Status": {"select": {"options": select_options(OUTREACH_STATUSES)}},
    "Outreach Owner":           {"rich_text": {}},
    "Events":                   {"multi_select": {"options": select_options(EVENTS)}},
    # --- Follow-up ---
    "Last Contact Date":        {"date": {}},
    "Follow-Up Due Date":       {"date": {}},
    "Follow-Up Owner":          {"rich_text": {}},
    "Follow-Up Complete":       {"checkbox": {}},
    "Notes":                    {"rich_text": {}},
    # --- LinkedIn profile (original enrichment) ---
    "Location":                 {"rich_text": {}},
    "Experience":               {"rich_text": {}},
    "Education":                {"rich_text": {}},
    "Personalization Signals":  {"rich_text": {}},
    "Profile Summary":          {"rich_text": {}},
    # --- NEW enrichment fields (June 2026) ---
    "About":                    {"rich_text": {}},
    "Mutual Connections":       {"rich_text": {}},
    "Open to Work":             {"checkbox": {}},
    "Connection Degree":        {"select": {"options": select_options(CONNECTION_DEGREES)}},
    "Languages":                {"rich_text": {}},
    "Organizations":            {"rich_text": {}},
    "Certifications":           {"rich_text": {}},
    "Key Achievements":         {"rich_text": {}},
    "Website":                  {"url": {}},
}

# Interactions DB schema
INTERACTIONS_PROPERTIES = {
    "Name":      {"title": {}},
    "Date":      {"date": {}},
    "Type":      {"select": {"options": select_options(INTERACTION_TYPES)}},
    "Message":   {"rich_text": {}},
    "Owner":     {"rich_text": {}},
    "Event":     {"rich_text": {}},
    "Notes":     {"rich_text": {}},
    # Contact relation is added separately after the Contacts DB ID is known
}

# Companies DB schema (optional — used if you want company-level tracking)
COMPANIES_PROPERTIES = {
    "Name":      {"title": {}},
    "Industry":  {"rich_text": {}},
    "Website":   {"url": {}},
    "Notes":     {"rich_text": {}},
}

# ---------------------------------------------------------------------------
# 4. Helpers
# ---------------------------------------------------------------------------

def get_existing_properties(db_id: str) -> set[str]:
    """Returns the set of property names already in the database."""
    db = notion.databases.retrieve(database_id=db_id)
    return set(db.get("properties", {}).keys())


def add_missing_properties(db_id: str, desired: dict, db_label: str) -> list[str]:
    """Non-destructively adds properties that don't exist yet. Returns list of added names."""
    existing = get_existing_properties(db_id)
    missing = {k: v for k, v in desired.items() if k not in existing}
    # Skip the title property — every DB already has one and you can't add a second
    missing = {k: v for k, v in missing.items() if "title" not in v}

    if not missing:
        print(f"  ✓ {db_label}: all {len(desired)} properties already present — nothing to add.")
        return []

    print(f"  + {db_label}: adding {len(missing)} missing properties: {', '.join(missing.keys())}")
    notion.databases.update(database_id=db_id, properties=missing)
    return list(missing.keys())


def create_database(parent_page_id: str, title: str, properties: dict) -> str:
    """Creates a new database as a child of parent_page_id. Returns its ID."""
    # Remove the title key from properties dict — it's handled separately via title_property
    props = {k: v for k, v in properties.items() if "title" not in v}
    result = notion.databases.create(
        parent={"type": "page_id", "page_id": parent_page_id},
        title=[{"type": "text", "text": {"content": title}}],
        properties=props,
    )
    return result["id"].replace("-", "")


def prompt_db_id(label: str, env_key: str) -> str:
    """Reads a DB ID from env or prompts the user. Returns empty string to skip."""
    from_env = os.environ.get(env_key, "").strip()
    if from_env:
        print(f"  → {label}: found {env_key} = {from_env[:8]}...")
        return from_env
    val = input(
        f"\n  {label} database ID ({env_key})\n"
        f"  Paste the 32-char ID from Notion (or press Enter to CREATE a new one): "
    ).strip()
    return val.replace("-", "")


# ---------------------------------------------------------------------------
# 5. Main flow
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("  TEG CRM — Notion Schema Setup")
print("=" * 60)
print(
    "\nThis script will add missing columns to your existing Notion databases,\n"
    "or create new databases if you don't have them yet.\n"
    "Existing data and columns are NEVER deleted or overwritten.\n"
)

# --- Contacts DB ---
print("[ 1/3 ] CONTACTS DATABASE")
contacts_db_id = prompt_db_id("Contacts", "NOTION_CONTACTS_DB_ID")

if contacts_db_id:
    try:
        added = add_missing_properties(contacts_db_id, CONTACTS_PROPERTIES, "Contacts")
        if added:
            print(f"        Added: {', '.join(added)}")
    except Exception as e:
        print(f"  ERROR updating Contacts DB: {e}")
        print("  Check that your integration has access to this database in Notion.")
        contacts_db_id = ""
else:
    parent_page_id = input(
        "\n  Enter the ID of the Notion PAGE where new databases should be created\n"
        "  (open the page in Notion → Copy link → the long ID after the last '/'): "
    ).strip().replace("-", "")

    if not parent_page_id:
        print("ERROR: A parent page ID is required to create databases.")
        sys.exit(1)

    print("  Creating Contacts database...")
    try:
        contacts_db_id = create_database(parent_page_id, "TEG CRM — Contacts", CONTACTS_PROPERTIES)
        print(f"  ✓ Created: {contacts_db_id}")
    except Exception as e:
        print(f"  ERROR creating Contacts DB: {e}")
        sys.exit(1)

# --- Interactions DB ---
print("\n[ 2/3 ] INTERACTIONS DATABASE")
interactions_db_id = prompt_db_id("Interactions", "NOTION_INTERACTIONS_DB_ID")

if interactions_db_id:
    try:
        # Add Contact relation to Interactions if we have the Contacts DB ID
        props_to_check = dict(INTERACTIONS_PROPERTIES)
        if contacts_db_id:
            props_to_check["Contact"] = {
                "relation": {"database_id": contacts_db_id, "type": "single_property"}
            }
        added = add_missing_properties(interactions_db_id, props_to_check, "Interactions")
        if added:
            print(f"        Added: {', '.join(added)}")
    except Exception as e:
        print(f"  ERROR updating Interactions DB: {e}")
        interactions_db_id = ""
else:
    parent_page_id_inter = input(
        "\n  Parent page ID for Interactions DB (or press Enter to use same page as Contacts): "
    ).strip().replace("-", "") or (
        # Try to reuse the same parent — get it from the Contacts DB
        notion.databases.retrieve(database_id=contacts_db_id)
        .get("parent", {})
        .get("page_id", "")
        .replace("-", "")
        if contacts_db_id else ""
    )

    if not parent_page_id_inter:
        print("  Skipping Interactions DB creation (no parent page provided).")
    else:
        props_with_relation = dict(INTERACTIONS_PROPERTIES)
        if contacts_db_id:
            props_with_relation["Contact"] = {
                "relation": {"database_id": contacts_db_id, "type": "single_property"}
            }
        print("  Creating Interactions database...")
        try:
            interactions_db_id = create_database(
                parent_page_id_inter, "TEG CRM — Interactions", props_with_relation
            )
            print(f"  ✓ Created: {interactions_db_id}")
        except Exception as e:
            print(f"  ERROR creating Interactions DB: {e}")
            interactions_db_id = ""

# --- Companies DB (optional) ---
print("\n[ 3/3 ] COMPANIES DATABASE (optional — press Enter to skip)")
companies_db_id = prompt_db_id("Companies", "NOTION_COMPANIES_DB_ID")

if companies_db_id and companies_db_id.strip():
    try:
        added = add_missing_properties(companies_db_id, COMPANIES_PROPERTIES, "Companies")
        if added:
            print(f"        Added: {', '.join(added)}")
    except Exception as e:
        print(f"  WARNING: Could not update Companies DB: {e} — skipping.")
        companies_db_id = ""

# ---------------------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("  DONE — copy these into your .env.local (and Vercel env vars)")
print("=" * 60)
print()
print("# Notion")
print(f'NOTION_TOKEN="{NOTION_TOKEN}"')
if contacts_db_id:
    print(f'NOTION_CONTACTS_DB_ID="{contacts_db_id}"')
if interactions_db_id:
    print(f'NOTION_INTERACTIONS_DB_ID="{interactions_db_id}"')
if companies_db_id:
    print(f'NOTION_COMPANIES_DB_ID="{companies_db_id}"')

print()
print("Schema summary:")
print(f"  Contacts DB    : {len(CONTACTS_PROPERTIES)} columns")
print(f"    - 9 new enrichment fields (About, Mutual Connections, Open to Work,")
print(f"      Connection Degree, Languages, Organizations, Certifications,")
print(f"      Key Achievements, Website)")
print(f"  Interactions DB: {len(INTERACTIONS_PROPERTIES) + 1} columns (incl. Contact relation)")
if companies_db_id:
    print(f"  Companies DB   : {len(COMPANIES_PROPERTIES)} columns")
print()
print("Next step: share each database with your Notion integration.")
print("In Notion → open the DB → ··· → Connections → add your integration.")
print()
