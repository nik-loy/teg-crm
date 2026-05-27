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
        anthropic_api_key="",
        outreach_blacklist=["Netlight", "Oliver Wyman", "Accenture"],
        outreach_luma_url="luma.com/71152vc3?coupon=INVITE26",
    )


@pytest.fixture
def mock_notion_client() -> MagicMock:
    return MagicMock()
