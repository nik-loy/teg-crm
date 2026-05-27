import json
import os
from pathlib import Path
from unittest.mock import patch
import pytest

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
