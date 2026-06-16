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
    utm_source: str = ""


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
    gemini_api_key: str
    outreach_blacklist: list[str]
    outreach_luma_url: str

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

        DEFAULT_BLACKLIST = ["Netlight", "Oliver Wyman", "Accenture"]
        extra_blacklist = [
            c.strip() for c in os.getenv("OUTREACH_BLACKLIST_COMPANIES", "").split(",")
            if c.strip()
        ]
        outreach_blacklist = DEFAULT_BLACKLIST + extra_blacklist

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
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            outreach_blacklist=outreach_blacklist,
            outreach_luma_url=os.getenv("OUTREACH_LUMA_URL", "luma.com/71152vc3?coupon=INVITE26"),
        )
