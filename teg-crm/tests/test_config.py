import json
import os
from pathlib import Path
from unittest.mock import patch
import pytest

from src.config import Config, TeamMember


def test_loads_all_fields_with_defaults():
    with patch.dict(os.environ, {}, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.resend_api_key == ""
    assert cfg.slack_webhook_url is None
    assert cfg.followup_overdue_days == 14
    assert cfg.followup_warning_days == 7


def test_optional_slack_loaded_when_present():
    env = {"SLACK_WEBHOOK_URL": "https://hooks.slack.com/test"}
    with patch.dict(os.environ, env, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.slack_webhook_url == "https://hooks.slack.com/test"


def test_followup_days_overridden_by_env():
    env = {"FOLLOWUP_OVERDUE_DAYS": "21", "FOLLOWUP_WARNING_DAYS": "3"}
    with patch.dict(os.environ, env, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.followup_overdue_days == 21
    assert cfg.followup_warning_days == 3


def test_team_members_empty_when_file_absent():
    with patch.dict(os.environ, {}, clear=True):
        cfg = Config.from_env(team_json_path=Path("nonexistent.json"))
    assert cfg.team_members == []


def test_team_members_loaded_from_json(tmp_path):
    team_data = [{"notion_id": "uid1", "email": "alice@teg.de", "name": "Alice", "utm_source": "utma"}]
    team_file = tmp_path / "team.json"
    team_file.write_text(json.dumps(team_data))
    with patch.dict(os.environ, {}, clear=True):
        cfg = Config.from_env(team_json_path=team_file)
    assert len(cfg.team_members) == 1
    assert cfg.team_members[0].email == "alice@teg.de"
    assert cfg.team_members[0].name == "Alice"
    assert cfg.team_members[0].utm_source == "utma"
    assert not hasattr(cfg.team_members[0], "notion_id")


def test_team_member_is_dataclass():
    m = TeamMember(email="x@y.com", name="X")
    assert m.name == "X"
