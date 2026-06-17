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
        TeamMember(email="finn@teg.de", name="Finn", utm_source="lkdf")
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
