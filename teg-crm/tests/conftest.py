from unittest.mock import MagicMock
import pytest

from src.config import Config, TeamMember


@pytest.fixture
def mock_config() -> Config:
    return Config(
        resend_api_key="re_test",
        slack_webhook_url=None,
        team_members=[
            TeamMember(email="alice@teg.de", name="Alice"),
            TeamMember(email="ben@teg.de", name="Ben"),
        ],
        followup_overdue_days=14,
        followup_warning_days=7,
        gemini_api_key="",
        outreach_blacklist=["Netlight", "Oliver Wyman", "Accenture"],
        outreach_luma_url="luma.com/71152vc3?coupon=INVITE26",
    )


@pytest.fixture
def mock_notion_client() -> MagicMock:
    return MagicMock()
