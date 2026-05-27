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
