# TEG CRM Automation System

## Project Overview

TEG is a student club based in Munich (associated with TUM) that organises high-level executive forums and industry events. We attract C-level speakers (CTO of MINI, COO of Hornbach, VP Finance of Airbus) but need to grow our professional audience. The Sales Division (team of 3, zero budget) is building a CRM system to track contacts, manage a five-stage pipeline, automate follow-ups, and convert event attendees into future speakers and sponsors.

**Our CRM lives in Notion.** We have the Notion Student Org Plus plan (free, unlimited members, unlimited blocks). The current CRM is a single flat table that requires 100% manual updating. This project builds the automation layer on top of Notion to make it function as a real CRM.

## What We're Building

A suite of Python scripts and tools that connect to the Notion API and automate the parts of CRM management that Notion can't do natively:

1. **Event Attendee Importer** — Takes a CSV from event sign-in sheets, deduplicates against existing contacts, creates new entries, links them to the event, sets pipeline stage and follow-up dates.
2. **Daily Follow-Up Reminder Bot** — Runs on a schedule (GitHub Actions, cron). Queries Notion for overdue follow-ups, groups by team member, sends summary via email (Resend API) or Slack webhook.
3. **Pipeline Dashboard** — Queries all contacts, aggregates by pipeline stage / tier / source / month, generates a static HTML dashboard with charts (Chart.js). Deployable to Vercel or GitHub Pages.
4. **LinkedIn Contact Logger** — A lightweight tool (CLI or bookmarklet) that creates a Notion contact entry from a LinkedIn URL + minimal manual input.
5. **Weekly Pipeline Report Generator** — Generates a formatted summary (Markdown or email) of pipeline movement, new contacts, overdue follow-ups, and upcoming events. Sent weekly via email.

## Architecture Decisions

- **Language:** Python 3.11+
- **Notion SDK:** `notion-client` (official Python SDK)
- **Email sending:** Resend API (free tier: 100 emails/day)
- **Scheduling:** GitHub Actions (cron workflows) for all scheduled tasks
- **Dashboard frontend:** Static HTML + Chart.js (no framework, no build step)
- **Configuration:** All secrets via environment variables / GitHub Secrets. Never hardcoded. `NOTION_PARENT_PAGE_ID` (the Notion page that will be parent to all 6 databases) is a required env var for `setup_notion_dbs.py`. Team member mappings (Notion user UUID → name + email) live in `config/team.json` — committed to the repo, no secrets, loaded by `config.py`.
- **No paid services.** Everything must run on free tiers.

## Notion Database Schema

The Notion workspace has six interconnected databases. Their IDs are stored in `.env` (and GitHub Secrets for CI).

### Database 1: Contacts (NOTION_CONTACTS_DB_ID)
| Property | Type | Notes |
|---|---|---|
| Name | title | Full name |
| Email | email | |
| Phone | phone_number | |
| LinkedIn URL | url | |
| Company | relation → Companies | |
| Job Title | rich_text | |
| Industry | select | Options: Consulting, Automotive, Tech, Finance, Energy, Healthcare, Manufacturing, Media, Other |
| Tier | select | Options: Tier 1, Tier 2, Tier 3 |
| Pipeline Stage | select | Options: Awareness, First Attendance, Engaged, Deepening, Activated |
| Source | select | Options: TEG Event, LinkedIn, Networking Event, Podcast, Referral, Alumni, Company Partnership |
| Tags | multi_select | Options: potential-speaker, potential-sponsor, podcast-guest, alumni-TUM, alumni-LMU, advisory-board |
| Last Contact Date | date | |
| Follow-Up Due Date | date | |
| Follow-Up Owner | people | Notion user assigned |
| Follow-Up Complete | checkbox | |
| Notes | rich_text | |

### Database 2: Companies (NOTION_COMPANIES_DB_ID)
| Property | Type | Notes |
|---|---|---|
| Company Name | title | |
| Industry | select | Same options as Contacts.Industry |
| Size | select | Options: Startup, SME, Mittelstand, Corporate |
| Partnership Tier | select | Options: None, Bronze, Silver, Gold |
| Seat Allocation Status | select | Options: Not Approached, Approached, Confirmed, Declined |
| Notes | rich_text | |

### Database 3: Events (NOTION_EVENTS_DB_ID)
| Property | Type | Notes |
|---|---|---|
| Event Name | title | |
| Date | date | |
| Speaker | rich_text | |
| Topic | rich_text | |
| Format | select | Options: Panel, Fireside Chat, Roundtable, Dinner, Podcast |

### Database 4: Events Attended (NOTION_ATTENDANCE_DB_ID)
| Property | Type | Notes |
|---|---|---|
| Record | title | Constructed by the importer as `"{Contact Name} — {Event Name}"` — Notion does NOT auto-generate this field |
| Contact | relation → Contacts | |
| Event | relation → Events | |
| Date Attended | date | |
| Referred By | rich_text | |
| Notes | rich_text | |

### Database 5: Interactions (NOTION_INTERACTIONS_DB_ID)
| Property | Type | Notes |
|---|---|---|
| Summary | title | Brief description |
| Contact | relation → Contacts | |
| Date | date | |
| Type | select | Options: LinkedIn Message, Email, Phone Call, In-Person, Podcast, Event |
| Next Action | rich_text | |

### Database 6: Speaker Pipeline (NOTION_SPEAKERS_DB_ID)
| Property | Type | Notes |
|---|---|---|
| Name | title | |
| Contact | relation → Contacts | |
| Topic Angle | rich_text | |
| Target Event | relation → Events | |
| Stage | select | Options: Identified, Researched, Contacted, In Discussion, Confirmed, Delivered, Post-Event |
| Owner | people | |
| Notes | rich_text | |

## File Structure

```
teg-crm/
├── CLAUDE.md
├── pyproject.toml              ← pytest config (pythonpath = ["."])
├── .claude/
│   └── rules.md
├── .env.example
├── .gitignore
├── requirements.txt
├── config/
│   └── team.json               ← team member mappings (no secrets, committed)
├── src/
│   ├── __init__.py
│   ├── config.py               ← Config dataclass, loaded from env + config/team.json
│   ├── notion_helpers.py       ← paginated_query, with_retry, property builder fns
│   ├── importer/
│   │   ├── __init__.py
│   │   └── csv_importer.py
│   ├── reminders/
│   │   ├── __init__.py
│   │   └── follow_up_bot.py
│   ├── dashboard/
│   │   ├── __init__.py
│   │   ├── generate_dashboard.py
│   │   └── template.html
│   ├── linkedin/
│   │   ├── __init__.py
│   │   └── contact_logger.py
│   └── reports/
│       ├── __init__.py
│       └── weekly_report.py
├── scripts/
│   ├── __init__.py
│   ├── setup_notion_dbs.py     ← creates all 6 databases; prints IDs for .env
│   └── discover_users.py       ← lists Notion user IDs for config/team.json
├── tests/
│   ├── __init__.py
│   ├── conftest.py             ← shared fixtures: mock_config, mock_notion_client
│   ├── test_config.py
│   ├── test_notion_helpers.py
│   ├── test_setup_notion_dbs.py
│   ├── test_discover_users.py
│   ├── test_importer.py
│   ├── test_reminders.py
│   └── test_dashboard.py
├── .github/
│   └── workflows/
│       ├── daily_reminders.yml
│       └── weekly_report.yml
└── docs/
    ├── setup_guide.md
    ├── architecture.md
    └── superpowers/
        └── plans/
```

## Build Phases

Phases must be built in order. Each phase is independently shippable and testable.

| Phase | Deliverable | Blocked by |
|-------|-------------|------------|
| **1 — Foundation** | `config.py`, `notion_helpers.py`, `setup_notion_dbs.py`, `discover_users.py` | Nothing — build first |
| **2 — Dashboard** | `generate_dashboard.py`, `template.html` | Phase 1 |
| **3 — Importer** | `csv_importer.py` | Phase 1 + CSV format decision |
| **4 — Reminder Bot** | `follow_up_bot.py`, `daily_reminders.yml` | Phase 1 + `config/team.json` populated |
| **5 — Weekly Report** | `weekly_report.py`, `weekly_report.yml` | Phase 1 |
| **6 — LinkedIn Logger** | `contact_logger.py` | Phase 1 |

**Required one-time setup order before any code runs:**
1. Create Notion integration at notion.so/my-integrations → copy token to `.env`
2. Create a blank Notion page → copy its ID to `NOTION_PARENT_PAGE_ID` in `.env`
3. Connect the integration to that page (Share → Invite)
4. Run `python -m scripts.setup_notion_dbs` → copy printed IDs to `.env`
5. Run `python -m scripts.discover_users` → populate `config/team.json`

## Key Principles

1. **Idempotent operations.** The CSV importer must handle reruns without creating duplicates. Deduplicate by email first, then by name+company.
2. **Graceful error handling.** Notion API rate limit = 3 req/s. Implement retry with exponential backoff. Never crash silently.
3. **Human-readable output.** Clear terminal output with status indicators. Follow-up bot messages must be useful without context.
4. **Configuration over hardcoding.** All IDs, keys, team mappings, thresholds in config.
5. **Tests for critical paths.** Deduplication, date calculations, API response parsing. Use pytest with mocked API responses.
6. **Documentation.** Every script has a docstring. Setup guide is followable by a non-developer.
