from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TeamMember:
    email: str
    name: str
    utm_source: str = ""


@dataclass
class Config:
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
        if team_json_path is None:
            team_json_path = Path(__file__).parent.parent / "config" / "team.json"

        team_members: list[TeamMember] = []
        if team_json_path.exists():
            raw = json.loads(team_json_path.read_text(encoding="utf-8"))
            for m in raw:
                # Remove notion_id if present to keep dataclass clean
                m.pop("notion_id", None)
                team_members.append(TeamMember(**m))

        DEFAULT_BLACKLIST = ["Netlight", "Oliver Wyman", "Accenture"]
        extra_blacklist = [
            c.strip() for c in os.getenv("OUTREACH_BLACKLIST_COMPANIES", "").split(",")
            if c.strip()
        ]
        outreach_blacklist = DEFAULT_BLACKLIST + extra_blacklist

        return cls(
            resend_api_key=os.getenv("RESEND_API_KEY", ""),
            slack_webhook_url=os.getenv("SLACK_WEBHOOK_URL"),
            team_members=team_members,
            followup_overdue_days=int(os.getenv("FOLLOWUP_OVERDUE_DAYS", "14")),
            followup_warning_days=int(os.getenv("FOLLOWUP_WARNING_DAYS", "7")),
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            outreach_blacklist=outreach_blacklist,
            outreach_luma_url=os.getenv("OUTREACH_LUMA_URL", "luma.com/71152vc3?coupon=INVITE26"),
        )
