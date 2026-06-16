# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared foundation that every other phase depends on: typed configuration loading, Notion API helpers, the database-creation setup script, and the user-discovery script.

**Architecture:** `config.py` is a pure dataclass with no side effects — loads from env vars and a JSON file. `notion_helpers.py` contains only pure or easily mockable functions. Scripts in `scripts/` are thin entry points that wire these together. All 4 files are covered by unit tests with mocked API calls.

**Tech Stack:** Python 3.11+, notion-client, python-dotenv, rich, pytest

---

## File Map

- Create: `pyproject.toml`
- Create: `scripts/__init__.py`
- Create: `src/config.py`
- Create: `src/notion_helpers.py`
- Create: `scripts/setup_notion_dbs.py`
- Create: `scripts/discover_users.py`
- Create: `tests/conftest.py`
- Create: `tests/test_config.py`
- Create: `tests/test_notion_helpers.py`
- Create: `tests/test_setup_notion_dbs.py`
- Create: `tests/test_discover_users.py`

---

### Task 1: Project test configuration

**Files:**
- Create: `pyproject.toml`

- [x] **Step 1: Create pyproject.toml**

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [x] **Step 2: Verify pytest can discover tests**

Run: `pytest --collect-only`
Expected output: lists test files in `tests/` (even if empty stubs). No import errors.

- [x] **Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add pytest config with project root on pythonpath"
```

---

### Task 2: Config module

**Files:**
- Create: `src/config.py`
- Create: `tests/test_config.py`

- [x] **Step 1: Write the failing tests**

Create `tests/test_config.py`:

```python
import json
import os
from pathlib import Path
from unittest.mock import patch
import pytest

# These imports will fail until src/config.py is created — that's expected.
from src.config import Config, TeamMember

_REQUIRED_ENV = {
    "NOTION_TOKEN": "ntn_test",
    "NOTION_CONTACTS_DB_ID": "db_contacts",
    "NOTION_COMPANIES_DB_ID": "db_companies",
    "NOTION_EVENTS_DB_ID": "db_events",
    "NOTION_ATTENDANCE_DB_ID": "db_attendance",
    "NOTION_INTERACTIONS_DB_ID": "db_interactions",
    "NOTION_SPEAKERS_DB_ID": "db_speakers",
}


def test_raises_on_missing_notion_token():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(EnvironmentError) as exc_info:
            Config.from_env(team_json_path=Path("nonexistent.json"))
        assert "NOTION_TOKEN" in str(exc_info.value)


def test_raises_listing_all_missing_vars():
    with patch.dict(os.environ, {"NOTION_TOKEN": "ntn_x"}, clear=True):
        with pytest.raises(EnvironmentError) as exc_info:
            Config.from_env(team_json_path=Path("nonexistent.json"))
        assert "NOTION_CONTACTS_DB_ID" in str(exc_info.value)


def test_loads_all_required_fields():
    with patch.dict(os.environ, _REQUIRED_ENV, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.notion_token == "ntn_test"
    assert cfg.contacts_db_id == "db_contacts"
    assert cfg.companies_db_id == "db_companies"
    assert cfg.events_db_id == "db_events"
    assert cfg.attendance_db_id == "db_attendance"
    assert cfg.interactions_db_id == "db_interactions"
    assert cfg.speakers_db_id == "db_speakers"


def test_optional_slack_is_none_when_absent():
    with patch.dict(os.environ, _REQUIRED_ENV, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.slack_webhook_url is None


def test_optional_slack_loaded_when_present():
    env = {**_REQUIRED_ENV, "SLACK_WEBHOOK_URL": "https://hooks.slack.com/test"}
    with patch.dict(os.environ, env, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.slack_webhook_url == "https://hooks.slack.com/test"


def test_followup_days_use_defaults():
    with patch.dict(os.environ, _REQUIRED_ENV, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.followup_overdue_days == 14
    assert cfg.followup_warning_days == 7


def test_followup_days_overridden_by_env():
    env = {**_REQUIRED_ENV, "FOLLOWUP_OVERDUE_DAYS": "21", "FOLLOWUP_WARNING_DAYS": "3"}
    with patch.dict(os.environ, env, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.followup_overdue_days == 21
    assert cfg.followup_warning_days == 3


def test_team_members_empty_when_file_absent():
    with patch.dict(os.environ, _REQUIRED_ENV, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.team_members == []


def test_team_members_loaded_from_json(tmp_path):
    team_data = [{"notion_id": "uid1", "email": "alice@teg.de", "name": "Alice"}]
    team_file = tmp_path / "team.json"
    team_file.write_text(json.dumps(team_data))
    with patch.dict(os.environ, _REQUIRED_ENV, clear=True):
        cfg = Config.from_env(team_json_path=team_file)
    assert len(cfg.team_members) == 1
    assert cfg.team_members[0].notion_id == "uid1"
    assert cfg.team_members[0].email == "alice@teg.de"
    assert cfg.team_members[0].name == "Alice"


def test_team_member_is_dataclass():
    m = TeamMember(notion_id="x", email="x@y.com", name="X")
    assert m.notion_id == "x"
```

- [x] **Step 2: Run tests and confirm they fail**

Run: `pytest tests/test_config.py -v`
Expected: `ImportError: No module named 'src.config'`

- [x] **Step 3: Implement src/config.py**

Create `src/config.py`:

```python
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TeamMember:
    notion_id: str
    email: str
    name: str


@dataclass
class Config:
    notion_token: str
    contacts_db_id: str
    companies_db_id: str
    events_db_id: str
    attendance_db_id: str
    interactions_db_id: str
    speakers_db_id: str
    parent_page_id: str
    resend_api_key: str
    slack_webhook_url: str | None
    team_members: list[TeamMember]
    followup_overdue_days: int
    followup_warning_days: int

    @classmethod
    def from_env(cls, team_json_path: Path | None = None) -> "Config":
        required = [
            "NOTION_TOKEN",
            "NOTION_CONTACTS_DB_ID",
            "NOTION_COMPANIES_DB_ID",
            "NOTION_EVENTS_DB_ID",
            "NOTION_ATTENDANCE_DB_ID",
            "NOTION_INTERACTIONS_DB_ID",
            "NOTION_SPEAKERS_DB_ID",
        ]
        missing = [k for k in required if not os.getenv(k)]
        if missing:
            raise EnvironmentError(f"Missing required env vars: {', '.join(missing)}")

        if team_json_path is None:
            team_json_path = Path(__file__).parent.parent / "config" / "team.json"

        team_members: list[TeamMember] = []
        if team_json_path.exists():
            raw = json.loads(team_json_path.read_text(encoding="utf-8"))
            team_members = [TeamMember(**m) for m in raw]

        return cls(
            notion_token=os.environ["NOTION_TOKEN"],
            contacts_db_id=os.environ["NOTION_CONTACTS_DB_ID"],
            companies_db_id=os.environ["NOTION_COMPANIES_DB_ID"],
            events_db_id=os.environ["NOTION_EVENTS_DB_ID"],
            attendance_db_id=os.environ["NOTION_ATTENDANCE_DB_ID"],
            interactions_db_id=os.environ["NOTION_INTERACTIONS_DB_ID"],
            speakers_db_id=os.environ["NOTION_SPEAKERS_DB_ID"],
            parent_page_id=os.getenv("NOTION_PARENT_PAGE_ID", ""),
            resend_api_key=os.getenv("RESEND_API_KEY", ""),
            slack_webhook_url=os.getenv("SLACK_WEBHOOK_URL"),
            team_members=team_members,
            followup_overdue_days=int(os.getenv("FOLLOWUP_OVERDUE_DAYS", "14")),
            followup_warning_days=int(os.getenv("FOLLOWUP_WARNING_DAYS", "7")),
        )
```

- [x] **Step 4: Run tests and confirm they pass**

Run: `pytest tests/test_config.py -v`
Expected: 11 tests PASSED, 0 failed.

- [x] **Step 5: Commit**

```bash
git add src/config.py tests/test_config.py
git commit -m "feat: add Config dataclass with typed env loading and team.json support"
```

---

### Task 3: Notion helpers

**Files:**
- Create: `src/notion_helpers.py`
- Create: `tests/test_notion_helpers.py`

- [x] **Step 1: Write the failing tests**

Create `tests/test_notion_helpers.py`:

```python
from unittest.mock import MagicMock, patch
import pytest

from src.notion_helpers import (
    paginated_query,
    with_retry,
    title_prop,
    rich_text_prop,
    select_prop,
    multi_select_prop,
    date_prop,
    relation_prop,
    email_prop,
    url_prop,
    phone_prop,
    checkbox_prop,
)


# ── paginated_query ────────────────────────────────────────────────────────────

def test_paginated_query_single_page():
    client = MagicMock()
    client.databases.query.return_value = {
        "results": [{"id": "p1"}, {"id": "p2"}],
        "has_more": False,
    }
    with patch("time.sleep"):
        results = paginated_query(client, "db_id")
    assert len(results) == 2
    assert client.databases.query.call_count == 1


def test_paginated_query_two_pages():
    client = MagicMock()
    client.databases.query.side_effect = [
        {"results": [{"id": "p1"}], "has_more": True, "next_cursor": "cur1"},
        {"results": [{"id": "p2"}], "has_more": False},
    ]
    with patch("time.sleep"):
        results = paginated_query(client, "db_id")
    assert len(results) == 2
    second_call_kwargs = client.databases.query.call_args_list[1][1]
    assert second_call_kwargs["start_cursor"] == "cur1"


def test_paginated_query_passes_filter():
    client = MagicMock()
    client.databases.query.return_value = {"results": [], "has_more": False}
    f = {"property": "Stage", "select": {"equals": "Engaged"}}
    with patch("time.sleep"):
        paginated_query(client, "db_id", filter=f)
    assert client.databases.query.call_args[1]["filter"] == f


def test_paginated_query_sleeps_between_pages():
    client = MagicMock()
    client.databases.query.side_effect = [
        {"results": [{"id": "p1"}], "has_more": True, "next_cursor": "c1"},
        {"results": [{"id": "p2"}], "has_more": False},
    ]
    with patch("time.sleep") as mock_sleep:
        paginated_query(client, "db_id")
    mock_sleep.assert_called()


def test_paginated_query_empty_database():
    client = MagicMock()
    client.databases.query.return_value = {"results": [], "has_more": False}
    with patch("time.sleep"):
        results = paginated_query(client, "db_id")
    assert results == []


# ── with_retry ─────────────────────────────────────────────────────────────────

def test_with_retry_returns_on_first_attempt():
    fn = MagicMock(return_value="ok")
    assert with_retry(fn) == "ok"
    fn.assert_called_once()


def test_with_retry_retries_on_429_then_succeeds():
    from notion_client.errors import APIResponseError
    err = MagicMock(spec=APIResponseError)
    err.status = 429
    fn = MagicMock(side_effect=[err, err, "ok"])
    with patch("time.sleep"):
        result = with_retry(fn, max_attempts=5)
    assert result == "ok"
    assert fn.call_count == 3


def test_with_retry_raises_after_max_attempts():
    from notion_client.errors import APIResponseError
    err = MagicMock(spec=APIResponseError)
    err.status = 429
    fn = MagicMock(side_effect=err)
    with patch("time.sleep"), pytest.raises(Exception):
        with_retry(fn, max_attempts=3)
    assert fn.call_count == 3


def test_with_retry_does_not_retry_non_429():
    from notion_client.errors import APIResponseError
    err = MagicMock(spec=APIResponseError)
    err.status = 400
    fn = MagicMock(side_effect=err)
    with pytest.raises(Exception):
        with_retry(fn)
    fn.assert_called_once()


# ── Property builders ──────────────────────────────────────────────────────────

def test_title_prop():
    assert title_prop("Alice") == {"title": [{"text": {"content": "Alice"}}]}


def test_rich_text_prop():
    assert rich_text_prop("a note") == {"rich_text": [{"text": {"content": "a note"}}]}


def test_select_prop():
    assert select_prop("Tier 1") == {"select": {"name": "Tier 1"}}


def test_multi_select_prop():
    result = multi_select_prop(["alumni-TUM", "potential-speaker"])
    assert result == {"multi_select": [{"name": "alumni-TUM"}, {"name": "potential-speaker"}]}


def test_date_prop():
    assert date_prop("2026-01-15") == {"date": {"start": "2026-01-15"}}


def test_relation_prop_single():
    assert relation_prop(["id1"]) == {"relation": [{"id": "id1"}]}


def test_relation_prop_multiple():
    assert relation_prop(["id1", "id2"]) == {"relation": [{"id": "id1"}, {"id": "id2"}]}


def test_email_prop():
    assert email_prop("a@b.com") == {"email": "a@b.com"}


def test_url_prop():
    assert url_prop("https://linkedin.com/in/x") == {"url": "https://linkedin.com/in/x"}


def test_phone_prop():
    assert phone_prop("+49 89 123456") == {"phone_number": "+49 89 123456"}


def test_checkbox_prop_true():
    assert checkbox_prop(True) == {"checkbox": True}


def test_checkbox_prop_false():
    assert checkbox_prop(False) == {"checkbox": False}
```

- [x] **Step 2: Run tests and confirm they fail**

Run: `pytest tests/test_notion_helpers.py -v`
Expected: `ImportError: No module named 'src.notion_helpers'`

- [x] **Step 3: Implement src/notion_helpers.py**

Create `src/notion_helpers.py`:

```python
from __future__ import annotations

import logging
import time
from typing import Any

from notion_client import Client
from notion_client.errors import APIResponseError

logger = logging.getLogger(__name__)


def paginated_query(
    client: Client,
    db_id: str,
    filter: dict | None = None,
    sorts: list | None = None,
) -> list[dict]:
    """Fetches all pages from a Notion database, handling pagination automatically."""
    results: list[dict] = []
    cursor: str | None = None
    while True:
        kwargs: dict[str, Any] = {"database_id": db_id, "page_size": 100}
        if filter:
            kwargs["filter"] = filter
        if sorts:
            kwargs["sorts"] = sorts
        if cursor:
            kwargs["start_cursor"] = cursor

        response = client.databases.query(**kwargs)
        results.extend(response["results"])

        if not response.get("has_more"):
            break
        cursor = response["next_cursor"]
        time.sleep(0.35)

    return results


def with_retry(fn: Any, max_attempts: int = 5) -> Any:
    """Calls fn(), retrying with exponential backoff on Notion 429 rate-limit errors."""
    for attempt in range(max_attempts):
        try:
            return fn()
        except APIResponseError as exc:
            if exc.status == 429 and attempt < max_attempts - 1:
                wait = 2**attempt
                logger.warning("Rate limited. Retrying in %ds (attempt %d/%d)", wait, attempt + 1, max_attempts)
                time.sleep(wait)
            else:
                raise


def title_prop(text: str) -> dict:
    return {"title": [{"text": {"content": text}}]}


def rich_text_prop(text: str) -> dict:
    return {"rich_text": [{"text": {"content": text}}]}


def select_prop(name: str) -> dict:
    return {"select": {"name": name}}


def multi_select_prop(names: list[str]) -> dict:
    return {"multi_select": [{"name": n} for n in names]}


def date_prop(iso_date: str) -> dict:
    return {"date": {"start": iso_date}}


def relation_prop(page_ids: list[str]) -> dict:
    return {"relation": [{"id": pid} for pid in page_ids]}


def email_prop(email: str) -> dict:
    return {"email": email}


def url_prop(url: str) -> dict:
    return {"url": url}


def phone_prop(phone: str) -> dict:
    return {"phone_number": phone}


def checkbox_prop(value: bool) -> dict:
    return {"checkbox": value}
```

- [x] **Step 4: Run tests and confirm they pass**

Run: `pytest tests/test_notion_helpers.py -v`
Expected: 20 tests PASSED, 0 failed.

- [x] **Step 5: Commit**

```bash
git add src/notion_helpers.py tests/test_notion_helpers.py
git commit -m "feat: add notion_helpers — paginated query, retry, property builders"
```

---

### Task 4: Shared test fixtures (conftest)

**Files:**
- Create: `tests/conftest.py`

- [x] **Step 1: Create tests/conftest.py**

```python
from pathlib import Path
from unittest.mock import MagicMock
import pytest

from src.config import Config, TeamMember


@pytest.fixture
def mock_config() -> Config:
    return Config(
        notion_token="ntn_test",
        contacts_db_id="db_contacts",
        companies_db_id="db_companies",
        events_db_id="db_events",
        attendance_db_id="db_attendance",
        interactions_db_id="db_interactions",
        speakers_db_id="db_speakers",
        parent_page_id="page_test",
        resend_api_key="re_test",
        slack_webhook_url=None,
        team_members=[
            TeamMember(notion_id="uid1", email="alice@teg.de", name="Alice"),
            TeamMember(notion_id="uid2", email="ben@teg.de", name="Ben"),
        ],
        followup_overdue_days=14,
        followup_warning_days=7,
    )


@pytest.fixture
def mock_notion_client() -> MagicMock:
    return MagicMock()
```

- [x] **Step 2: Verify conftest is picked up**

Run: `pytest tests/test_config.py -v --fixtures | grep mock_config`
Expected: `mock_config` appears in the fixture list.

- [x] **Step 3: Commit**

```bash
git add tests/conftest.py
git commit -m "test: add shared conftest fixtures — mock_config, mock_notion_client"
```

---

### Task 5: Database setup script

**Files:**
- Create: `scripts/__init__.py`
- Create: `scripts/setup_notion_dbs.py`
- Create: `tests/test_setup_notion_dbs.py`

- [x] **Step 1: Write the failing tests**

Create `tests/test_setup_notion_dbs.py`:

```python
import pytest
from scripts.setup_notion_dbs import (
    build_companies_schema,
    build_events_schema,
    build_contacts_schema,
    build_events_attended_schema,
    build_interactions_schema,
    build_speaker_pipeline_schema,
)

PARENT = "page_123"
COMPANIES = "db_companies"
EVENTS = "db_events"
CONTACTS = "db_contacts"


def test_companies_schema_parent():
    schema = build_companies_schema(PARENT)
    assert schema["parent"] == {"type": "page_id", "page_id": PARENT}


def test_companies_schema_has_title_property():
    schema = build_companies_schema(PARENT)
    assert schema["properties"]["Company Name"] == {"title": {}}


def test_companies_schema_has_all_required_properties():
    props = build_companies_schema(PARENT)["properties"]
    assert "Industry" in props
    assert "Size" in props
    assert "Partnership Tier" in props
    assert "Seat Allocation Status" in props
    assert "Notes" in props


def test_companies_schema_size_options():
    props = build_companies_schema(PARENT)["properties"]
    names = [o["name"] for o in props["Size"]["select"]["options"]]
    assert names == ["Startup", "SME", "Mittelstand", "Corporate"]


def test_events_schema_has_format_options():
    props = build_events_schema(PARENT)["properties"]
    names = [o["name"] for o in props["Format"]["select"]["options"]]
    assert "Panel" in names
    assert "Fireside Chat" in names
    assert "Podcast" in names


def test_contacts_schema_company_relation():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    assert props["Company"]["relation"]["database_id"] == COMPANIES


def test_contacts_schema_pipeline_stage_options():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    names = [o["name"] for o in props["Pipeline Stage"]["select"]["options"]]
    assert names == ["Awareness", "First Attendance", "Engaged", "Deepening", "Activated"]


def test_contacts_schema_source_options():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    names = [o["name"] for o in props["Source"]["select"]["options"]]
    assert "TEG Event" in names
    assert "Company Partnership" in names


def test_contacts_schema_tags_options():
    props = build_contacts_schema(PARENT, COMPANIES)["properties"]
    names = [o["name"] for o in props["Tags"]["multi_select"]["options"]]
    assert "potential-speaker" in names
    assert "alumni-TUM" in names


def test_events_attended_relations():
    props = build_events_attended_schema(PARENT, CONTACTS, EVENTS)["properties"]
    assert props["Contact"]["relation"]["database_id"] == CONTACTS
    assert props["Event"]["relation"]["database_id"] == EVENTS


def test_interactions_contact_relation():
    props = build_interactions_schema(PARENT, CONTACTS)["properties"]
    assert props["Contact"]["relation"]["database_id"] == CONTACTS


def test_interactions_type_options():
    props = build_interactions_schema(PARENT, CONTACTS)["properties"]
    names = [o["name"] for o in props["Type"]["select"]["options"]]
    assert "LinkedIn Message" in names
    assert "In-Person" in names
    assert "Phone Call" in names


def test_speaker_pipeline_relations():
    props = build_speaker_pipeline_schema(PARENT, CONTACTS, EVENTS)["properties"]
    assert props["Contact"]["relation"]["database_id"] == CONTACTS
    assert props["Target Event"]["relation"]["database_id"] == EVENTS


def test_speaker_pipeline_stage_options():
    props = build_speaker_pipeline_schema(PARENT, CONTACTS, EVENTS)["properties"]
    names = [o["name"] for o in props["Stage"]["select"]["options"]]
    assert "Identified" in names
    assert "Post-Event" in names
    assert len(names) == 7
```

- [x] **Step 2: Run tests and confirm they fail**

Run: `pytest tests/test_setup_notion_dbs.py -v`
Expected: `ImportError: No module named 'scripts.setup_notion_dbs'`

- [x] **Step 3: Create scripts/__init__.py**

Create an empty file at `scripts/__init__.py`.

- [x] **Step 4: Implement scripts/setup_notion_dbs.py**

Create `scripts/setup_notion_dbs.py`:

```python
"""Creates all 6 TEG CRM Notion databases under a parent page.

Run: python -m scripts.setup_notion_dbs [--parent-page-id PAGE_ID]

Databases are created in dependency order so relation properties resolve correctly:
  1. Companies   (no relations)
  2. Events      (no relations)
  3. Contacts    (→ Companies)
  4. Events Attended  (→ Contacts, Events)
  5. Interactions     (→ Contacts)
  6. Speaker Pipeline (→ Contacts, Events)
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
```

- [x] **Step 5: Run tests and confirm they pass**

Run: `pytest tests/test_setup_notion_dbs.py -v`
Expected: 14 tests PASSED, 0 failed.

- [x] **Step 6: Commit**

```bash
git add scripts/__init__.py scripts/setup_notion_dbs.py tests/test_setup_notion_dbs.py
git commit -m "feat: add setup_notion_dbs — creates all 6 databases in dependency order"
```

---

### Task 6: User discovery script

**Files:**
- Create: `scripts/discover_users.py`
- Create: `tests/test_discover_users.py`

- [x] **Step 1: Write the failing tests**

Create `tests/test_discover_users.py`:

```python
from unittest.mock import MagicMock
from scripts.discover_users import list_workspace_users


def test_filters_out_bots():
    client = MagicMock()
    client.users.list.return_value = {
        "results": [
            {"id": "uid1", "type": "person", "name": "Alice", "person": {"email": "alice@teg.de"}},
            {"id": "bot1", "type": "bot", "name": "Integration Bot"},
        ]
    }
    users = list_workspace_users(client)
    assert len(users) == 1
    assert users[0]["id"] == "uid1"


def test_returns_empty_when_no_persons():
    client = MagicMock()
    client.users.list.return_value = {
        "results": [{"id": "bot1", "type": "bot", "name": "Bot"}]
    }
    users = list_workspace_users(client)
    assert users == []


def test_returns_all_persons():
    client = MagicMock()
    client.users.list.return_value = {
        "results": [
            {"id": "uid1", "type": "person", "name": "Alice", "person": {"email": "a@t.de"}},
            {"id": "uid2", "type": "person", "name": "Ben",   "person": {"email": "b@t.de"}},
            {"id": "uid3", "type": "person", "name": "Clara", "person": {"email": "c@t.de"}},
        ]
    }
    users = list_workspace_users(client)
    assert len(users) == 3


def test_result_contains_id_and_name():
    client = MagicMock()
    client.users.list.return_value = {
        "results": [
            {"id": "uid1", "type": "person", "name": "Alice", "person": {"email": "a@t.de"}},
        ]
    }
    users = list_workspace_users(client)
    assert users[0]["id"] == "uid1"
    assert users[0]["name"] == "Alice"
```

- [x] **Step 2: Run tests and confirm they fail**

Run: `pytest tests/test_discover_users.py -v`
Expected: `ImportError: cannot import name 'list_workspace_users'`

- [x] **Step 3: Implement scripts/discover_users.py**

Create `scripts/discover_users.py`:

```python
"""Lists all Notion workspace users with their IDs.

Run: python -m scripts.discover_users

Output: a table of person-type users. Copy the Notion User IDs into config/team.json.
Bots (API integrations) are excluded from the output.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()


def list_workspace_users(client: Client) -> list[dict]:
    """Returns all person-type users from the Notion workspace."""
    response = client.users.list()
    return [u for u in response["results"] if u.get("type") == "person"]


def main() -> None:
    token = os.getenv("NOTION_TOKEN")
    if not token:
        console.print("[red]Error:[/red] NOTION_TOKEN env var not set")
        raise SystemExit(1)

    client = Client(auth=token)
    users = list_workspace_users(client)

    if not users:
        console.print("[yellow]No person-type users found in workspace.[/yellow]")
        console.print("Check that your integration has access to the workspace.")
        return

    table = Table(title="Notion Workspace Users")
    table.add_column("Name", style="cyan")
    table.add_column("Email", style="green")
    table.add_column("Notion User ID (copy to config/team.json)", style="yellow")
    for user in users:
        name = user.get("name", "Unknown")
        email = user.get("person", {}).get("email", "N/A")
        table.add_row(name, email, user["id"])

    console.print(table)
    console.print(
        "\n[dim]Copy team.json.example → config/team.json and fill in the IDs above.[/dim]"
    )


if __name__ == "__main__":
    main()
```

- [x] **Step 4: Run tests and confirm they pass**

Run: `pytest tests/test_discover_users.py -v`
Expected: 4 tests PASSED, 0 failed.

- [x] **Step 5: Full test suite green check**

Run: `pytest tests/ -v`
Expected: All tests pass. Zero failures.

- [x] **Step 6: Commit**

```bash
git add scripts/discover_users.py tests/test_discover_users.py
git commit -m "feat: add discover_users — lists Notion user IDs for team.json setup"
```

---

## Phase 1 Definition of Done

- [x] `pytest tests/ -v` → all tests green
- [x] `python -m scripts.setup_notion_dbs --help` → prints usage without error
- [x] `python -m scripts.discover_users --help` → prints usage without error
- [x] `config/team.json` (or `config/team.json.example` as template) committed to repo
- [x] `.env` populated with real `NOTION_TOKEN` + `NOTION_PARENT_PAGE_ID`
- [x] `python -m scripts.setup_notion_dbs` → all 6 databases created, IDs in terminal
- [x] `python -m scripts.discover_users` → team member IDs printed, `config/team.json` populated

After completing this checklist, proceed to [Phase 2: Pipeline Dashboard](2026-05-27-phase-2-dashboard.md).
