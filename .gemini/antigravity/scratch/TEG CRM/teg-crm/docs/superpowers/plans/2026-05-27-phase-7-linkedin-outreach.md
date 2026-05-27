# Phase 7: LinkedIn Outreach Automation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the four most painful manual steps in the LinkedIn outreach workflow — Apollo CSV → Notion batch logging → LLM-powered message generation → automatic Notion interaction logging. The connection request and message sending remain manual (LinkedIn ToS). Everything else becomes one CLI command.

**Architecture:** Five new/modified components that extend the existing Phase 1–6 foundation without breaking any existing code.

**Tech Stack:** Python 3.11+, notion-client, anthropic (≥0.30), rich, pytest — all existing except `anthropic`.

**Prerequisite:** All previous phases complete. `pytest tests/ -v` passes (99 tests). `src/config.py`, `src/notion_helpers.py`, and `src/linkedin/contact_logger.py` exist.

> **⬅ RESUME HERE:** All previous phases complete. Start at Task 1, Step 1.

---

## Context: The current workflow (read before implementing)

The team (3 people, private LinkedIn accounts) runs outreach for the AI Consulting Conference 2026 (ACC 2026, 10 June, Munich). The workflow is:

1. **Apollo.ai** → search "Consultant / AI Consultant / Management Consultant" + filter Munich/DACH → send 50 LinkedIn connection requests per round (no message, just connect)
2. **Notion** ← manually enter each person as "requested" (currently done by hand, one-by-one)
3. **Wait 2–3 days** → ~50% accept
4. **ChatGPT** → paste a large system prompt once per session, then for each accepted contact: type name, copy LinkedIn headline/role/bio/experience → receive fit rating, seniority check, and personalised message in German
5. **LinkedIn** → copy message, open profile, paste, send
6. **Notion** ← no logging happens here currently

**Pain points eliminated by this phase:**
- P1: Manual Notion entry after sending requests (→ Apollo batch importer)
- P2: No dedup/blacklist check before logging (→ importer handles it)
- P3: ChatGPT session management (→ message_gen.py calls Claude API)
- P4: No Notion audit trail of what was sent (→ message_gen auto-logs Interaction)
- P5: Wrong/missing UTM links per sender (→ per-owner UTM from team.json)

---

## Blacklist (never contact these companies)

```
Netlight          — Venue partner and speaker
Oliver Wyman      — Requested no outreach
Accenture         — Sponsor partner
```

Stored as `DEFAULT_BLACKLIST` constant in `apollo_importer.py`. Overridable via `OUTREACH_BLACKLIST_COMPANIES` env var (comma-separated).

---

## Outreach state machine

New `LinkedIn Outreach Status` select property added to the Contacts DB:

```
Request Sent  →  Connected  →  Messaged
```

- `Request Sent`: logged by apollo_importer.py or contact_logger --status request_sent
- `Connected`: updated by contact_logger --accept or contact_logger --status connected
- `Messaged`: set by message_gen.py after confirmation

---

## File Map

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/config.py` | Add `anthropic_api_key`, `outreach_blacklist`; add `utm_source` to TeamMember |
| Modify | `src/linkedin/contact_logger.py` | Add `--status`, `--owner`, `--accept` flags |
| Modify | `scripts/setup_notion_dbs.py` | Add new properties to Contacts schema |
| Create | `scripts/migrate_outreach_fields.py` | Adds properties to existing live Notion DB |
| Create | `src/linkedin/apollo_importer.py` | Apollo CSV → batch Notion contacts |
| Create | `src/linkedin/message_gen.py` | Claude API → personalised message → Notion log |
| Create | `src/linkedin/outreach_queue.py` | Read-only queue viewer |
| Create | `tests/test_apollo_importer.py` | |
| Create | `tests/test_message_gen.py` | |
| Create | `tests/test_outreach_queue.py` | |
| Create | `tests/test_contact_logger_v2.py` | Tests for new contact_logger flags |
| Modify | `.env.example` | Add `ANTHROPIC_API_KEY`, `OUTREACH_BLACKLIST_COMPANIES` |
| Modify | `config/team.json.example` | Add `utm_source` field |
| Modify | `requirements.txt` | Add `anthropic>=0.30.0` |
| Modify | `docs/architecture.md` | Add new entry points + modules |

---

## Task 1: Config + Schema extension

### Step 1: Update `requirements.txt`

Add `anthropic>=0.30.0` after the `requests` line.

### Step 2: Update `config/team.json.example`

```json
[
  {
    "notion_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "Alice Müller",
    "email": "alice@teg.de",
    "utm_source": "alce"
  },
  {
    "notion_id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    "name": "Ben Schmidt",
    "email": "ben@teg.de",
    "utm_source": "bnsc"
  },
  {
    "notion_id": "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
    "name": "Clara Weber",
    "email": "clara@teg.de",
    "utm_source": "clwb"
  }
]
```

### Step 3: Update `.env.example`

Add after `SLACK_WEBHOOK_URL`:
```
# Phase 7 — LinkedIn Outreach
ANTHROPIC_API_KEY=          # optional — if unset, message_gen prints clipboard-ready text only
OUTREACH_BLACKLIST_COMPANIES=  # optional — comma-separated, extends built-in list
OUTREACH_LUMA_URL=luma.com/71152vc3?coupon=INVITE26  # base URL for invite links
```

### Step 4: Update `src/config.py`

- Add `utm_source: str = ""` field to `TeamMember`
- Add `anthropic_api_key: str`, `outreach_blacklist: list[str]`, `outreach_luma_url: str` to `Config`
- Update `from_env()` to populate these (all optional — empty string / empty list are fine)

```python
# TeamMember: add field
@dataclass
class TeamMember:
    notion_id: str
    email: str
    name: str
    utm_source: str = ""
```

```python
# Config: add fields
    anthropic_api_key: str
    outreach_blacklist: list[str]
    outreach_luma_url: str
```

```python
# from_env(): add loading logic
DEFAULT_BLACKLIST = ["Netlight", "Oliver Wyman", "Accenture"]

extra_blacklist = [
    c.strip() for c in os.getenv("OUTREACH_BLACKLIST_COMPANIES", "").split(",")
    if c.strip()
]
outreach_blacklist = DEFAULT_BLACKLIST + extra_blacklist
```

```python
# in return cls(...):
    anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
    outreach_blacklist=outreach_blacklist,
    outreach_luma_url=os.getenv("OUTREACH_LUMA_URL", "luma.com/71152vc3?coupon=INVITE26"),
```

- [ ] **Step 5: Run existing tests and confirm they still pass**

```bash
pytest tests/ -v
```

Expected: all 99 tests pass (TeamMember now has an optional field — existing tests use `mock_config` from conftest.py and won't break if you add a default).

### Step 6: Update `scripts/setup_notion_dbs.py`

In the Contacts database schema dict, add two new properties:

```python
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
```

### Step 7: Create `scripts/migrate_outreach_fields.py`

This adds the two new properties to the **existing** live Notion Contacts database. Run once against your real workspace.

```python
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
```

- [ ] **Step 8: Commit**

```bash
git add requirements.txt config/team.json.example .env.example src/config.py scripts/setup_notion_dbs.py scripts/migrate_outreach_fields.py
git commit -m "feat: Phase 7 T1 — config + schema extensions for LinkedIn outreach"
```

---

## Task 2: Extend `contact_logger.py`

The existing file already handles `--url`, `--name`, `--title`, `--tier`, `--notes`. Add `--status`, `--owner`, `--accept`.

### Step 1: Write new tests in `tests/test_contact_logger_v2.py`

```python
"""Tests for extended contact_logger — status, owner, accept flags."""
from unittest.mock import MagicMock, patch
import pytest
from src.linkedin.contact_logger import create_contact, find_by_linkedin_url


def test_create_contact_includes_outreach_status(mock_config, mock_notion_client):
    mock_notion_client.pages.create.return_value = {"id": "abc", "url": "https://notion.so/abc"}
    from src.linkedin.contact_logger import create_contact
    create_contact(
        mock_notion_client,
        mock_config,
        name="Test User",
        linkedin_url="https://linkedin.com/in/test",
        outreach_status="Request Sent",
        outreach_owner="niklas",
    )
    call_props = mock_notion_client.pages.create.call_args[1]["properties"]
    assert call_props["LinkedIn Outreach Status"]["select"]["name"] == "Request Sent"
    assert call_props["Outreach Owner"]["rich_text"][0]["text"]["content"] == "niklas"


def test_create_contact_no_status_omits_property(mock_config, mock_notion_client):
    mock_notion_client.pages.create.return_value = {"id": "abc", "url": ""}
    from src.linkedin.contact_logger import create_contact
    create_contact(
        mock_notion_client,
        mock_config,
        name="Test User",
        linkedin_url="https://linkedin.com/in/test",
    )
    call_props = mock_notion_client.pages.create.call_args[1]["properties"]
    assert "LinkedIn Outreach Status" not in call_props


def test_update_contact_status(mock_config, mock_notion_client):
    mock_notion_client.pages.update.return_value = {}
    from src.linkedin.contact_logger import update_contact_status
    update_contact_status(mock_notion_client, "page-id-123", "Connected")
    mock_notion_client.pages.update.assert_called_once()
    call_props = mock_notion_client.pages.update.call_args[1]["properties"]
    assert call_props["LinkedIn Outreach Status"]["select"]["name"] == "Connected"
```

- [ ] **Step 2: Run new tests — confirm they fail** (functions don't exist yet)

```bash
pytest tests/test_contact_logger_v2.py -v
```

- [ ] **Step 3: Update `src/linkedin/contact_logger.py`**

Add `update_contact_status()` function:

```python
def update_contact_status(client: Client, page_id: str, status: str) -> None:
    """Updates the LinkedIn Outreach Status of an existing contact page."""
    with_retry(lambda: client.pages.update(
        page_id=page_id,
        properties={"LinkedIn Outreach Status": select_prop(status)},
    ))
```

Update `create_contact()` signature — add optional `outreach_status` and `outreach_owner` params:

```python
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
```

Update `main()` — add new argparse flags and `--accept` logic:

```python
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
```

In `main()`, handle `--accept`:

```python
if args.accept:
    existing_id = find_by_linkedin_url(client, cfg, args.url)
    if not existing_id:
        console.print("[red]Error:[/red] Contact not found for this LinkedIn URL.")
        return
    update_contact_status(client, existing_id, "Connected")
    console.print(f"[green]✓[/green] Marked as Connected")
    return
```

Pass `outreach_status` and `outreach_owner` to `create_contact()`:

```python
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
```

- [ ] **Step 4: Run all tests**

```bash
pytest tests/ -v
```

Expected: 99 original + 3 new = 102 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/linkedin/contact_logger.py tests/test_contact_logger_v2.py
git commit -m "feat: Phase 7 T2 — extend contact_logger with status/owner/accept flags"
```

---

## Task 3: Apollo CSV Importer

Apollo.ai CSV export format (standard columns — some may be empty):
```
First Name, Last Name, Title, Company, LinkedIn URL, Email, Phone, City, State, Country, ...
```

Run: `python -m src.linkedin.apollo_importer --csv apollo_export.csv --owner niklas`

### Step 1: Write `tests/test_apollo_importer.py`

```python
"""Tests for Apollo CSV → Notion batch importer."""
from __future__ import annotations

import csv
import io
import pytest
from unittest.mock import MagicMock, call, patch


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_csv(rows: list[dict]) -> str:
    """Builds a CSV string from a list of row dicts."""
    if not rows:
        return ""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def _row(
    first="Anna",
    last="Schmidt",
    title="AI Consultant",
    company="Deloitte",
    linkedin="https://linkedin.com/in/anna-schmidt",
    email="anna@deloitte.de",
    city="Munich",
    country="Germany",
) -> dict:
    return {
        "First Name": first,
        "Last Name": last,
        "Title": title,
        "Company": company,
        "LinkedIn URL": linkedin,
        "Email": email,
        "City": city,
        "Country": country,
    }


# ── parse_apollo_csv ───────────────────────────────────────────────────────────

def test_parse_apollo_csv_returns_rows():
    from src.linkedin.apollo_importer import parse_apollo_csv
    rows = parse_apollo_csv(_make_csv([_row(), _row(first="Ben", last="Müller")]))
    assert len(rows) == 2
    assert rows[0]["name"] == "Anna Schmidt"
    assert rows[0]["company"] == "Deloitte"
    assert rows[0]["linkedin_url"] == "https://linkedin.com/in/anna-schmidt"
    assert rows[0]["email"] == "anna@deloitte.de"
    assert rows[0]["job_title"] == "AI Consultant"


def test_parse_apollo_csv_skips_rows_without_linkedin():
    from src.linkedin.apollo_importer import parse_apollo_csv
    rows = parse_apollo_csv(_make_csv([_row(linkedin=""), _row()]))
    assert len(rows) == 1


def test_parse_apollo_csv_normalises_linkedin_url():
    from src.linkedin.apollo_importer import parse_apollo_csv
    rows = parse_apollo_csv(_make_csv([_row(linkedin="https://www.linkedin.com/in/anna-schmidt/")]))
    assert rows[0]["linkedin_url"] == "https://www.linkedin.com/in/anna-schmidt"


# ── is_blacklisted ─────────────────────────────────────────────────────────────

def test_is_blacklisted_returns_true_for_exact_match():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("Netlight", ["Netlight", "Accenture"]) is True


def test_is_blacklisted_case_insensitive():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("netlight consulting", ["Netlight"]) is True


def test_is_blacklisted_returns_false_for_non_match():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("Deloitte", ["Netlight", "Accenture"]) is False


def test_is_blacklisted_partial_match():
    from src.linkedin.apollo_importer import is_blacklisted
    assert is_blacklisted("Oliver Wyman GmbH", ["Oliver Wyman"]) is True


# ── batch_import ───────────────────────────────────────────────────────────────

def test_batch_import_creates_contacts(mock_config, mock_notion_client):
    mock_notion_client.databases.query.return_value = {"results": []}
    mock_notion_client.pages.create.return_value = {"id": "abc", "url": "https://notion.so/abc"}
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Anna Schmidt", "linkedin_url": "https://linkedin.com/in/anna", "email": "anna@d.de", "company": "Deloitte", "job_title": "Consultant"},
    ]
    summary = batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    assert summary["created"] == 1
    assert summary["skipped_blacklist"] == 0
    assert summary["skipped_existing"] == 0


def test_batch_import_skips_blacklisted(mock_config, mock_notion_client):
    mock_config.outreach_blacklist = ["Netlight"]
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Lars Tränkner", "linkedin_url": "https://linkedin.com/in/lars", "email": "lars@netlight.com", "company": "Netlight", "job_title": "Senior Consultant"},
    ]
    summary = batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    assert summary["created"] == 0
    assert summary["skipped_blacklist"] == 1
    mock_notion_client.pages.create.assert_not_called()


def test_batch_import_skips_existing_linkedin_url(mock_config, mock_notion_client):
    mock_notion_client.databases.query.return_value = {
        "results": [{"id": "existing-page"}],
        "has_more": False,
    }
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Anna Schmidt", "linkedin_url": "https://linkedin.com/in/anna", "email": "anna@d.de", "company": "Deloitte", "job_title": "Consultant"},
    ]
    summary = batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    assert summary["created"] == 0
    assert summary["skipped_existing"] == 1


def test_batch_import_sets_request_sent_status(mock_config, mock_notion_client):
    mock_notion_client.databases.query.return_value = {"results": [], "has_more": False}
    mock_notion_client.pages.create.return_value = {"id": "abc", "url": ""}
    from src.linkedin.apollo_importer import batch_import

    rows = [
        {"name": "Anna Schmidt", "linkedin_url": "https://linkedin.com/in/anna", "email": "", "company": "Deloitte", "job_title": "Consultant"},
    ]
    batch_import(mock_notion_client, mock_config, rows, owner="niklas")
    call_props = mock_notion_client.pages.create.call_args[1]["properties"]
    assert call_props["LinkedIn Outreach Status"]["select"]["name"] == "Request Sent"
    assert call_props["Outreach Owner"]["rich_text"][0]["text"]["content"] == "niklas"
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest tests/test_apollo_importer.py -v
```

- [ ] **Step 3: Implement `src/linkedin/apollo_importer.py`**

```python
"""Apollo.ai CSV → Notion batch importer.

Reads an Apollo export CSV, checks blacklist + dedup, creates Notion contacts.

Run: python -m src.linkedin.apollo_importer --csv apollo_export.csv --owner niklas
     [--dry-run]  -- print summary without writing to Notion
"""
from __future__ import annotations

import argparse
import csv
import io
import logging
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.table import Table

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


def parse_apollo_csv(csv_text: str) -> list[dict]:
    """Parses Apollo CSV text into normalised row dicts. Skips rows without LinkedIn URL."""
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    for raw in reader:
        first = raw.get("First Name", "").strip()
        last = raw.get("Last Name", "").strip()
        name = f"{first} {last}".strip()
        linkedin = raw.get("LinkedIn URL", "").strip().rstrip("/")
        if not linkedin:
            continue
        rows.append({
            "name": name,
            "linkedin_url": linkedin,
            "email": raw.get("Email", "").strip().lower(),
            "company": raw.get("Company", "").strip(),
            "job_title": raw.get("Title", "").strip(),
        })
    return rows


def is_blacklisted(company: str, blacklist: list[str]) -> bool:
    """Returns True if company name contains any blacklisted string (case-insensitive)."""
    company_lower = company.lower()
    return any(b.lower() in company_lower for b in blacklist)


def _find_by_linkedin(client: Client, cfg: Config, url: str) -> bool:
    res = with_retry(lambda: client.databases.query(
        database_id=cfg.contacts_db_id,
        filter={"property": "LinkedIn URL", "url": {"equals": url}},
        page_size=1,
    ))
    return bool(res.get("results"))


def _find_by_email(client: Client, cfg: Config, email: str) -> bool:
    if not email:
        return False
    res = with_retry(lambda: client.databases.query(
        database_id=cfg.contacts_db_id,
        filter={"property": "Email", "email": {"equals": email}},
        page_size=1,
    ))
    return bool(res.get("results"))


def batch_import(
    client: Client,
    cfg: Config,
    rows: list[dict],
    owner: str = "",
    dry_run: bool = False,
) -> dict[str, int]:
    """Creates Notion contacts from parsed rows. Returns summary dict."""
    summary = {"created": 0, "skipped_blacklist": 0, "skipped_existing": 0}

    for row in rows:
        if is_blacklisted(row["company"], cfg.outreach_blacklist):
            console.print(f"[yellow]⊘[/yellow] Blacklist: {row['name']} ({row['company']})")
            summary["skipped_blacklist"] += 1
            continue

        if _find_by_linkedin(client, cfg, row["linkedin_url"]):
            console.print(f"[yellow]⊘[/yellow] Exists (LinkedIn): {row['name']}")
            summary["skipped_existing"] += 1
            continue

        if row["email"] and _find_by_email(client, cfg, row["email"]):
            console.print(f"[yellow]⊘[/yellow] Exists (email): {row['name']}")
            summary["skipped_existing"] += 1
            continue

        if dry_run:
            console.print(f"[dim]dry-run[/dim] Would create: {row['name']}")
            summary["created"] += 1
            continue

        props: dict = {
            "Name": title_prop(row["name"]),
            "LinkedIn URL": url_prop(row["linkedin_url"]),
            "Pipeline Stage": select_prop("Awareness"),
            "Source": select_prop("LinkedIn"),
            "Tier": select_prop("Tier 3"),
            "Last Contact Date": date_prop(date.today().isoformat()),
            "LinkedIn Outreach Status": select_prop("Request Sent"),
        }
        if row["job_title"]:
            props["Job Title"] = rich_text_prop(row["job_title"])
        if owner:
            props["Outreach Owner"] = rich_text_prop(owner)

        with_retry(lambda: client.pages.create(
            parent={"database_id": cfg.contacts_db_id},
            properties=props,
        ))
        console.print(f"[green]✓[/green] Created: {row['name']} ({row['company']})")
        summary["created"] += 1

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Apollo CSV export into TEG Notion CRM")
    parser.add_argument("--csv", required=True, help="Path to Apollo CSV export file")
    parser.add_argument("--owner", default="", help="Team member name (logged as Outreach Owner)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without writing")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        console.print(f"[red]Error:[/red] File not found: {csv_path}")
        return

    csv_text = csv_path.read_text(encoding="utf-8-sig")  # utf-8-sig handles Excel BOM
    rows = parse_apollo_csv(csv_text)
    console.print(f"[dim]Parsed {len(rows)} rows with LinkedIn URLs from {csv_path.name}[/dim]")

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    summary = batch_import(client, cfg, rows, owner=args.owner, dry_run=args.dry_run)

    table = Table(show_header=False, box=None, padding=(0, 1))
    table.add_row("[bold green]Created[/bold green]", str(summary["created"]))
    table.add_row("[yellow]Skipped — blacklist[/yellow]", str(summary["skipped_blacklist"]))
    table.add_row("[yellow]Skipped — already exists[/yellow]", str(summary["skipped_existing"]))
    console.print("\n")
    console.print(table)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_apollo_importer.py tests/ -v
```

Expected: all new tests + all 102 existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/linkedin/apollo_importer.py tests/test_apollo_importer.py
git commit -m "feat: Phase 7 T3 — Apollo CSV batch importer with blacklist + dedup"
```

---

## Task 4: Message Generator

Calls Claude API with the full ACC 2026 outreach prompt. Falls back to clipboard-ready text if `ANTHROPIC_API_KEY` is not set.

### Step 1: Write `tests/test_message_gen.py`

```python
"""Tests for LinkedIn message generator — parsing and UTM generation."""
import pytest


def test_parse_fit_rating_extracts_score():
    from src.linkedin.message_gen import parse_fit_rating
    response = "**Fit-Rating:** 4/5\nGuter AI-Bezug, Consulting-Hintergrund.\n**Senioritäts-Check:**"
    assert parse_fit_rating(response) == 4


def test_parse_fit_rating_handles_missing():
    from src.linkedin.message_gen import parse_fit_rating
    assert parse_fit_rating("no rating here") == 0


def test_parse_message_extracts_nachricht():
    from src.linkedin.message_gen import parse_message
    response = (
        "**Fit-Rating:** 3/5\nSolide.\n"
        "**Senioritäts-Check:** Kein Bedenken.\n"
        "**Template:** Extern\n"
        "**Ansprache:** Du\n"
        "**Nachricht:**\n"
        "Hey Anna, danke fürs Vernetzen! ...\nVG Finn\n"
        "—"
    )
    msg = parse_message(response)
    assert msg.startswith("Hey Anna")
    assert "VG Finn" in msg


def test_parse_message_returns_empty_if_missing():
    from src.linkedin.message_gen import parse_message
    assert parse_message("no nachricht section") == ""


def test_build_utm_url_uses_owner_source(mock_config):
    from src.linkedin.message_gen import build_invite_url
    from src.config import TeamMember
    mock_config.outreach_luma_url = "luma.com/71152vc3?coupon=INVITE26"
    mock_config.team_members = [
        TeamMember(notion_id="x", email="finn@teg.de", name="Finn", utm_source="lkdf")
    ]
    url = build_invite_url(mock_config, owner="Finn")
    assert url == "luma.com/71152vc3?coupon=INVITE26&utm_source=lkdf"


def test_build_utm_url_fallback_when_owner_not_found(mock_config):
    from src.linkedin.message_gen import build_invite_url
    mock_config.team_members = []
    mock_config.outreach_luma_url = "luma.com/71152vc3?coupon=INVITE26"
    url = build_invite_url(mock_config, owner="unknown")
    assert url == "luma.com/71152vc3?coupon=INVITE26&utm_source=unknown"


def test_fit_rating_below_threshold_detected():
    from src.linkedin.message_gen import should_proceed
    assert should_proceed(2) is False
    assert should_proceed(3) is True
    assert should_proceed(5) is True
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest tests/test_message_gen.py -v
```

- [ ] **Step 3: Implement `src/linkedin/message_gen.py`**

```python
"""LinkedIn message generator for ACC 2026 outreach.

Two modes:
  API mode   (ANTHROPIC_API_KEY set): calls Claude, generates personalised German message,
             prompts for confirmation, then logs Interaction to Notion + updates contact status.
  Print mode (no API key): formats profile data into a copy-paste block for ChatGPT.

Run:
  python -m src.linkedin.message_gen --url https://linkedin.com/in/person [--owner niklas]

Then paste the LinkedIn profile data when prompted.
"""
from __future__ import annotations

import argparse
import logging
import re
from datetime import date

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.prompt import Confirm, Prompt

from src.config import Config
from src.notion_helpers import rich_text_prop, select_prop, title_prop, with_retry
from src.linkedin.contact_logger import find_by_linkedin_url, update_contact_status

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

# ── System prompt (verbatim from ACC 2026 LinkedIn Outreach Workflow Template) ──

SYSTEM_PROMPT = """Du bist ein Outreach-Assistent für die AI Consulting Conference 2026 (ACC 2026), organisiert von TEG - The Entrepreneurial Group.

Deine Aufgabe ist es, kurze, natürlich klingende LinkedIn-Nachrichten zu erstellen, um potenzielle Teilnehmer einzuladen. Die Nachrichten sollen sich anfühlen, als hätte eine echte Person sie in 30 Sekunden getippt, nicht wie ein Template, eine Pressemitteilung oder Sales-Outreach.

Die Grundlogik: Nicht zuerst die Konferenz erklären, sondern zeigen, warum genau diese Person thematisch passen könnte.

## WORKFLOW — Infos empfangen

Wenn du Informationen zur Person bekommst, machst du immer diese fünf Dinge:
1. Fit-Rating
2. Senioritäts-Check
3. Template-Entscheidung
4. Du/Sie-Entscheidung
5. LinkedIn-Nachricht generieren

## 1. FIT-RATING
Bewerte streng von 1 bis 5. Eine 5 ist selten.
5 = Absoluter Volltreffer: Beratung/Tech, direkter AI-Bezug im Jobtitel, Junior- bis Mid-Level, München/DACH.
4 = Sehr gut: Beratung/Tech, thematisch nah, aber AI nicht Hauptfokus ODER guter AI-Bezug, aber etwas entfernte Branche.
3 = Solide: Angrenzende Branche, allgemeiner Tech-, Digital- oder Transformation-Bezug.
2 = Grenzwertig: Wenig Bezug zu Beratung oder AI.
1 = Kein Fit: Komplett andere Branche.
Gib eine kurze Begründung in 1-2 Sätzen. Die meisten guten Targets sind eine 4, nicht automatisch eine 5.

## 2. SENIORITÄTS-CHECK
Warnung ausgeben bei: Partner, Associate Partner, Principal, Director, VP, Managing Director, C-Level, Vorstand.
Dann: „Achtung: sehr senior. Executive Access (€200) wäre vermutlich das passendere Ticket."
Ohne Bedenken anschreibbar: Business Analyst, Associate, Consultant, Junior Consultant, Senior Consultant (wenn nicht zu nah am Speaker), Senior Associate, Working Student mit AI-Bezug, Masterstudierende mit AI-Bezug.

## 3. TEMPLATE-ENTSCHEIDUNG
Intern: Person arbeitet bei McKinsey, Roland Berger, IBM, appliedAI, PwC, BCG, Capgemini Invent, MaibornWolff, Netlight, Hogan Lovells, Munich Re, oder LMU München (alle haben bestätigte Speaker). Erwähne beiläufig, dass auch jemand aus deren Haus spricht.
Extern: Person kommt von einer anderen Firma. Nenne 2-4 starke Firmennamen als Credibility.

## 4. DU/SIE-ENTSCHEIDUNG
Du: Associate, Consultant, Junior Consultant, Business Analyst, Senior Associate, Masterstudierende, Startup-Umfeld, lockerer LinkedIn-Auftritt.
Sie: Manager+, deutlich ältere Personen, formeller Auftritt, Partner/Director/C-Level. Im Zweifel: Sie.

## 5. LINKEDIN-NACHRICHT GENERIEREN
Länge: 350-450 Zeichen, Maximum 500 Zeichen.
Stil: kurz, natürlich, kein Marketing-Ton, keine langen Absätze, keine vollen Speaker-Titel.
Kein Preis, kein Rabatt, kein Coupon, kein "sichern Sie sich jetzt", kein "Wir von TEG organisieren", kein Titel in der Signatur.
Beginne mit dem Bezug zur Person. Logik: „Du machst X. Wir machen Y. Deshalb dachte ich, es könnte passen."

AGENDA (10. Juni 2026, München):
- 10:00 Opening Keynotes: KI und die neue Wertschöpfung in der Beratung
- 10:45 Hauptpanel: Wer führt die AI-Transformation? Strategieberatung vs. Tech-Consulting vs. interne AI-Teams
- 11:30 Real AI Case Study: Vom Pilot zur Wirkung
- 13:15 Industry Briefings: Health, Automotive, Mobility, Financial Services
- 13:15 Hands-on Workshops: Accenture, Netlight (je ca. 20 Teilnehmer)
- 15:00 Fireside Chat: Governance, Haftung & Risiko
- 15:30 Panel: Die Zukunft der Beraterkarriere
- 16:30 Closing Keynote: Consulting 2030

BESTÄTIGTE SPEAKER (für thematisches Matching und Intern/Extern-Check):
Florian Bauer (McKinsey), Anja Huber (McKinsey), Marcus Hartmann (Roland Berger), Tsun-Tao Chan (Roland Berger), Andrea Martin (IBM), Dr. Andreas Liebl (appliedAI), Susanne Schmutzler (PwC), Daniel Steiner (PwC), Erik Lenhard (BCG), Dr. Florian Forst (Capgemini Invent), Alexander Hofmann (MaibornWolff), Moritz Tränkner-Tuborgh (Netlight), Daniel Schober (Netlight), Dr. Stefan Schuppert (Hogan Lovells), Dr. Peter Bärnreuther (Munich Re), Prof. Dr. Anne-Sophie Mayer (LMU).

PERSONALISIERUNG — Bezüge nutzen: konkreter Jobfokus, konkrete Branche, konkretes Thema aus dem Profil, Bezug zu einer Agenda-Session.
Schlechte Personalisierung: „mit Ihrem spannenden Profil", „mit Ihrem Background in Consulting", „aufgrund Ihrer Erfahrung".

SIGNATUR: Nur "VG Finn" oder "Viele Grüße, Finn" oder "Beste Grüße, Finn". Kein Titel, kein TEG.

WICHTIGE REGELN:
- Antworte immer auf Deutsch
- Halte die Nachricht unter 500 Zeichen, Ziel 350-450 Zeichen
- Variiere Struktur und Formulierungen
- Keine vollen Speaker-Titel
- Keine Preise, Rabatte, Coupon-Codes
- Der persönliche Bezug ist wichtiger als die Speakerliste

OUTPUT-FORMAT — antworte immer in genau diesem Format:
**Fit-Rating:** [1-5]/5
[Kurze Begründung]
**Senioritäts-Check:**
[Kurze Einschätzung]
**Template:** Intern/Extern
[Kurze Erklärung]
**Ansprache:** Du/Sie
[Kurze Erklärung]
**Nachricht:**
[LinkedIn-Nachricht]
—"""


def build_invite_url(cfg: Config, owner: str) -> str:
    """Returns the invite URL with the correct utm_source for this owner."""
    utm = owner.lower().replace(" ", "")
    for member in cfg.team_members:
        if member.name.lower() == owner.lower():
            utm = member.utm_source or utm
            break
    return f"{cfg.outreach_luma_url}&utm_source={utm}"


def parse_fit_rating(response: str) -> int:
    """Extracts the fit rating integer from the LLM response."""
    match = re.search(r"\*\*Fit-Rating:\*\*\s*(\d)/5", response)
    return int(match.group(1)) if match else 0


def parse_message(response: str) -> str:
    """Extracts the LinkedIn message text from the LLM response."""
    match = re.search(r"\*\*Nachricht:\*\*\n(.*?)(?:\n—|\Z)", response, re.DOTALL)
    if not match:
        return ""
    return match.group(1).strip()


def should_proceed(fit_rating: int, threshold: int = 3) -> bool:
    return fit_rating >= threshold


def _prompt_profile_data() -> str:
    """Interactive prompt to collect LinkedIn profile data from user."""
    console.print("\n[bold]Paste LinkedIn profile data[/bold] (headline, role, bio, experience).")
    console.print("[dim]Press Enter twice when done.[/dim]\n")
    lines = []
    empty_count = 0
    while empty_count < 1:
        line = input()
        if line == "":
            empty_count += 1
        else:
            empty_count = 0
            lines.append(line)
    return "\n".join(lines)


def _log_interaction(
    client: Client,
    cfg: Config,
    contact_page_id: str,
    message: str,
) -> None:
    """Creates an Interaction record in Notion for the sent message."""
    with_retry(lambda: client.pages.create(
        parent={"database_id": cfg.interactions_db_id},
        properties={
            "Summary": title_prop("LinkedIn outreach message sent"),
            "Contact": {"relation": [{"id": contact_page_id}]},
            "Date": {"date": {"start": date.today().isoformat()}},
            "Type": select_prop("LinkedIn Message"),
            "Next Action": rich_text_prop("Await response"),
        },
    ))


def _run_api_mode(
    client: Client,
    cfg: Config,
    contact_page_id: str,
    name: str,
    owner: str,
) -> None:
    """Calls Claude API, shows output, prompts for confirmation, logs to Notion."""
    try:
        import anthropic
    except ImportError:
        console.print("[red]Error:[/red] anthropic package not installed. Run: pip install anthropic")
        return

    profile_data = _prompt_profile_data()
    if not profile_data.strip():
        console.print("[yellow]No profile data entered. Exiting.[/yellow]")
        return

    invite_url = build_invite_url(cfg, owner)
    user_message = f"Name: {name}\n\nProfil-Infos:\n{profile_data}\n\nEinladungslink für diese Nachricht: {invite_url}"

    console.print("\n[dim]Generating message...[/dim]")
    ai_client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)
    response = ai_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    full_response = response.content[0].text

    console.print("\n" + "─" * 60)
    console.print(full_response)
    console.print("─" * 60 + "\n")

    fit = parse_fit_rating(full_response)
    if not should_proceed(fit):
        console.print(f"[yellow]Fit-Rating {fit}/5 — below threshold. Not logging.[/yellow]")
        return

    message = parse_message(full_response)
    if not message:
        console.print("[yellow]Could not parse message from response. Not logging.[/yellow]")
        return

    if Confirm.ask("Log to Notion and mark as Messaged?"):
        _log_interaction(client, cfg, contact_page_id, message)
        update_contact_status(client, contact_page_id, "Messaged")
        console.print(f"[green]✓[/green] Logged to Notion — contact marked Messaged.")


def _run_print_mode(name: str, owner: str, cfg: Config) -> None:
    """No API key — prints formatted block ready to paste into ChatGPT."""
    invite_url = build_invite_url(cfg, owner)
    console.print("\n[bold yellow]No ANTHROPIC_API_KEY set — clipboard mode[/bold yellow]")
    console.print("\n[dim]Step 1: Copy the system prompt at the top of message_gen.py into a new ChatGPT chat.[/dim]")
    console.print("\n[dim]Step 2: Then send this message:[/dim]\n")
    console.print("─" * 60)
    console.print(f"{name}")
    console.print(f"\n[Paste headline, role, bio, experience here]\n\nEinladungslink: {invite_url}")
    console.print("─" * 60 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LinkedIn outreach message for TEG CRM")
    parser.add_argument("--url", required=True, help="LinkedIn profile URL of the contact")
    parser.add_argument("--owner", default="", help="Your name (for UTM link and logging)")
    args = parser.parse_args()

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    contact_page_id = find_by_linkedin_url(client, cfg, args.url)
    if not contact_page_id:
        console.print(f"[red]Error:[/red] No contact found for {args.url}")
        console.print("[dim]Run contact_logger first to create the contact.[/dim]")
        return

    contact = with_retry(lambda: client.pages.retrieve(page_id=contact_page_id))
    name = contact["properties"]["Name"]["title"][0]["text"]["content"]
    status = (contact["properties"].get("LinkedIn Outreach Status") or {}).get("select") or {}
    status_name = status.get("name", "unknown")
    owner = args.owner or (cfg.team_members[0].name if cfg.team_members else "Finn")

    console.print(f"\n[bold]{name}[/bold]  [dim]({status_name})[/dim]")

    if status_name != "Connected":
        console.print(f"[yellow]Warning:[/yellow] Status is '{status_name}', not 'Connected'. Proceed anyway? ")
        if not Confirm.ask("Continue?"):
            return

    if cfg.anthropic_api_key:
        _run_api_mode(client, cfg, contact_page_id, name, owner)
    else:
        _run_print_mode(name, owner, cfg)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run all tests**

```bash
pytest tests/ -v
```

Expected: all tests pass (message_gen tests don't call the real API — they only test parsing functions).

- [ ] **Step 5: Commit**

```bash
git add src/linkedin/message_gen.py tests/test_message_gen.py
git commit -m "feat: Phase 7 T4 — Claude API message generator with Notion auto-logging"
```

---

## Task 5: Outreach Queue Viewer

Read-only. Shows who needs action today.

### Step 1: Write `tests/test_outreach_queue.py`

```python
"""Tests for outreach queue grouping logic."""
from datetime import date, timedelta
import pytest


def _page(name: str, status: str | None, owner: str = "niklas", days_ago: int = 1) -> dict:
    created = (date.today() - timedelta(days=days_ago)).isoformat() + "T10:00:00.000Z"
    props: dict = {
        "Name": {"title": [{"text": {"content": name}}]},
        "Outreach Owner": {"rich_text": [{"text": {"content": owner}}]},
    }
    if status:
        props["LinkedIn Outreach Status"] = {"select": {"name": status}}
    return {"properties": props, "created_time": created}


def test_group_contacts_by_status():
    from src.linkedin.outreach_queue import group_by_status
    contacts = [
        _page("Alice", "Request Sent"),
        _page("Bob", "Connected"),
        _page("Clara", "Messaged"),
        _page("David", None),
    ]
    groups = group_by_status(contacts)
    assert len(groups["Request Sent"]) == 1
    assert len(groups["Connected"]) == 1
    assert len(groups["Messaged"]) == 1
    assert len(groups["No Status"]) == 1


def test_stale_requests_flagged():
    from src.linkedin.outreach_queue import get_stale_requests
    contacts = [
        _page("Old Alice", "Request Sent", days_ago=5),
        _page("Recent Bob", "Request Sent", days_ago=1),
    ]
    stale = get_stale_requests(contacts, stale_after_days=3)
    assert len(stale) == 1
    assert stale[0]["properties"]["Name"]["title"][0]["text"]["content"] == "Old Alice"


def test_extract_contact_name():
    from src.linkedin.outreach_queue import extract_name
    page = _page("Anna Schmidt", "Connected")
    assert extract_name(page) == "Anna Schmidt"


def test_extract_owner():
    from src.linkedin.outreach_queue import extract_owner
    page = _page("Test", "Connected", owner="jonas")
    assert extract_owner(page) == "jonas"
```

- [ ] **Step 2: Run tests — confirm they fail**

- [ ] **Step 3: Implement `src/linkedin/outreach_queue.py`**

```python
"""Outreach queue viewer — shows who needs action today.

Run: python -m src.linkedin.outreach_queue [--owner niklas] [--stale-days 3]
"""
from __future__ import annotations

import argparse
from datetime import date, timedelta

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.table import Table

from src.config import Config
from src.notion_helpers import paginated_query

load_dotenv()
console = Console()

ORDERED_STATUSES = ["Request Sent", "Connected", "Messaged"]
STATUS_COLORS = {
    "Request Sent": "yellow",
    "Connected": "blue",
    "Messaged": "green",
    "No Status": "dim",
}


def extract_name(page: dict) -> str:
    title = page["properties"].get("Name", {}).get("title", [])
    return title[0]["text"]["content"] if title else "(no name)"


def extract_owner(page: dict) -> str:
    rt = page["properties"].get("Outreach Owner", {}).get("rich_text", [])
    return rt[0]["text"]["content"] if rt else ""


def group_by_status(contacts: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = {s: [] for s in ORDERED_STATUSES}
    groups["No Status"] = []
    for c in contacts:
        sel = (c["properties"].get("LinkedIn Outreach Status") or {}).get("select")
        status = sel["name"] if sel else "No Status"
        groups.setdefault(status, []).append(c)
    return groups


def get_stale_requests(contacts: list[dict], stale_after_days: int = 3) -> list[dict]:
    cutoff = (date.today() - timedelta(days=stale_after_days)).isoformat()
    stale = []
    for c in contacts:
        sel = (c["properties"].get("LinkedIn Outreach Status") or {}).get("select")
        if sel and sel["name"] == "Request Sent":
            created = c.get("created_time", "")[:10]
            if created and created < cutoff:
                stale.append(c)
    return stale


def main() -> None:
    parser = argparse.ArgumentParser(description="View LinkedIn outreach queue")
    parser.add_argument("--owner", default="", help="Filter by owner name")
    parser.add_argument("--stale-days", type=int, default=3, help="Days after which request is 'stale'")
    args = parser.parse_args()

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    filter_obj: dict | None = None
    if args.owner:
        filter_obj = {"property": "Outreach Owner", "rich_text": {"contains": args.owner}}

    all_contacts = paginated_query(client, cfg.contacts_db_id, filter_obj=filter_obj)
    outreach_contacts = [
        c for c in all_contacts
        if (c["properties"].get("LinkedIn Outreach Status") or {}).get("select")
    ]

    groups = group_by_status(outreach_contacts)
    stale = get_stale_requests(outreach_contacts, args.stale_days)

    if stale:
        console.print(f"\n[bold yellow]Stale requests (>{args.stale_days} days, no response)[/bold yellow]")
        t = Table(show_header=False, box=None, padding=(0, 2))
        for c in stale:
            created = c.get("created_time", "")[:10]
            t.add_row(f"[yellow]•[/yellow]", extract_name(c), f"[dim]{extract_owner(c)}[/dim]", f"[dim]since {created}[/dim]")
        console.print(t)

    for status in ORDERED_STATUSES:
        pages = groups.get(status, [])
        if not pages:
            continue
        color = STATUS_COLORS.get(status, "white")
        console.print(f"\n[bold {color}]{status}[/bold {color}] ({len(pages)})")
        t = Table(show_header=False, box=None, padding=(0, 2))
        for c in pages:
            created = c.get("created_time", "")[:10]
            t.add_row(f"[{color}]•[/{color}]", extract_name(c), f"[dim]{extract_owner(c)}[/dim]", f"[dim]{created}[/dim]")
        console.print(t)

    if not outreach_contacts:
        console.print("[dim]No LinkedIn outreach contacts found.[/dim]")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Update `src/notion_helpers.py` to support optional filter in `paginated_query`**

Check if `paginated_query` already accepts a `filter_obj` parameter. If not, add it:

```python
def paginated_query(client, database_id: str, filter_obj: dict | None = None) -> list[dict]:
    ...
    # pass filter to client.databases.query if provided
```

- [ ] **Step 5: Run all tests**

```bash
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/linkedin/outreach_queue.py tests/test_outreach_queue.py
git commit -m "feat: Phase 7 T5 — outreach queue viewer"
```

---

## Final smoke test (manual, requires real Notion + populated contacts)

- [ ] Run migration against live workspace: `python -m scripts.migrate_outreach_fields`
- [ ] Import a small Apollo CSV (3-5 rows): `python -m src.linkedin.apollo_importer --csv test.csv --owner niklas --dry-run`
- [ ] Run for real: `python -m src.linkedin.apollo_importer --csv test.csv --owner niklas`
- [ ] Mark one as accepted: `python -m src.linkedin.contact_logger --url <url> --accept`
- [ ] View the queue: `python -m src.linkedin.outreach_queue`
- [ ] Generate a message (with API key set): `python -m src.linkedin.message_gen --url <url> --owner niklas`
- [ ] Verify Notion shows: Contact = Messaged, Interaction record created

---

## Phase 7 Definition of Done

- [ ] `pytest tests/ -v` → all tests green (102+ tests)
- [ ] `scripts/migrate_outreach_fields.py` runs without error against live Notion
- [ ] Apollo CSV import filters blacklisted companies correctly
- [ ] `contact_logger --accept` updates status to Connected
- [ ] `message_gen` produces a fit rating, checks, and 350-500 char German message
- [ ] `message_gen` creates an Interaction record and sets status to Messaged on confirm
- [ ] `outreach_queue` shows the correct groupings with stale-request highlighting
- [ ] No `# type: ignore` or bare `except:` blocks in any new file
- [ ] Every public function has a type-annotated signature
