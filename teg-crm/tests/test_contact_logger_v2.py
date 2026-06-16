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
