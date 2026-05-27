# TEG CRM — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-component Python automation layer on top of a Notion workspace that eliminates manual CRM management for TEG's 3-person Sales Division.

**Architecture:** 3-layer design — foundation (config + Notion helpers), domain modules (dashboard, importer, reminders, reports, LinkedIn logger), entry points (CLI scripts + GitHub Actions cron). Each phase produces independently shippable, tested software.

**Tech Stack:** Python 3.11+, notion-client, resend, rich, pytest, pytest-mock, python-dotenv, GitHub Actions

---

## Dependency Graph

```
Phase 1: Foundation  ◄── Build this first. Everything depends on it.
├── pyproject.toml
├── tests/conftest.py
├── src/config.py
├── src/notion_helpers.py
├── scripts/setup_notion_dbs.py   ← run once to create all 6 databases
└── scripts/discover_users.py     ← run once to populate config/team.json

Phase 2: Dashboard  ◄── Highest priority. Depends on Phase 1.
├── src/dashboard/generate_dashboard.py
└── src/dashboard/template.html

Phase 3: CSV Importer  ◄── Blocked until sign-in CSV format is decided.
└── src/importer/csv_importer.py

Phase 4: Reminder Bot  ◄── Needs Phase 1 + config/team.json populated.
├── src/reminders/follow_up_bot.py
└── .github/workflows/daily_reminders.yml

Phase 5: Weekly Report  ◄── Depends on Phase 1.
├── src/reports/weekly_report.py
└── .github/workflows/weekly_report.yml

Phase 6: LinkedIn Logger  ◄── Depends on Phase 1.
└── src/linkedin/contact_logger.py

Phase 7: LinkedIn Outreach Automation  ◄── Depends on Phase 6. BUILD NEXT.
├── src/config.py                      (modified — add anthropic_api_key, utm_source per member)
├── src/linkedin/contact_logger.py     (modified — add --status, --owner, --accept)
├── src/linkedin/apollo_importer.py    (new — Apollo CSV → Notion batch import)
├── src/linkedin/message_gen.py        (new — Claude API message generator)
├── src/linkedin/outreach_queue.py     (new — queue viewer)
└── scripts/migrate_outreach_fields.py (new — adds LinkedIn Outreach Status to live DB)
```

## Complete File Inventory

| File | Phase | Status |
|------|-------|--------|
| `pyproject.toml` | 1 | ✅ Done |
| `src/config.py` | 1 | ✅ Done |
| `src/notion_helpers.py` | 1 | ✅ Done |
| `scripts/__init__.py` | 1 | ✅ Done |
| `scripts/setup_notion_dbs.py` | 1 | ✅ Done |
| `scripts/discover_users.py` | 1 | ✅ Done |
| `tests/conftest.py` | 1 | ✅ Done |
| `tests/test_config.py` | 1 | ✅ Done |
| `tests/test_notion_helpers.py` | 1 | ✅ Done |
| `tests/test_setup_notion_dbs.py` | 1 | ✅ Done |
| `tests/test_discover_users.py` | 1 | ✅ Done |
| `src/dashboard/generate_dashboard.py` | 2 | ✅ Done |
| `tests/test_dashboard.py` | 2 | ✅ Done (17 tests passing) |
| `src/dashboard/template.html` | 2 | ✅ Done (cdnjs SRI hash applied) |
| `src/importer/csv_importer.py` | 3 | ✅ Done |
| `tests/test_importer.py` | 3 | ✅ Done (18 tests passing) |
| `src/reminders/follow_up_bot.py` | 4 | ✅ Done |
| `.github/workflows/daily_reminders.yml` | 4 | ✅ Done |
| `tests/test_reminders.py` | 4 | ✅ Done (15 tests passing) |
| `src/reports/weekly_report.py` | 5 | ✅ Done |
| `.github/workflows/weekly_report.yml` | 5 | ✅ Done |
| `src/linkedin/contact_logger.py` | 6 | ✅ Done |
| `src/config.py` (Phase 7 extension) | 7 | ✅ Done |
| `scripts/migrate_outreach_fields.py` | 7 | ✅ Done |
| `src/linkedin/apollo_importer.py` | 7 | ✅ Done |
| `src/linkedin/message_gen.py` | 7 | ✅ Done |
| `src/linkedin/outreach_queue.py` | 7 | ✅ Done |
| `tests/test_apollo_importer.py` | 7 | ✅ Done |
| `tests/test_message_gen.py` | 7 | ✅ Done |
| `tests/test_outreach_queue.py` | 7 | ✅ Done |
| `tests/test_contact_logger_v2.py` | 7 | ✅ Done |

## Current Status (as of 2026-05-27)

**Phases 1–7: ALL COMPLETE** ✅ 124 tests passing. `pytest tests/ -v` is green.

**Phase 7: LinkedIn Outreach Automation — COMPLETE** ✅
- Apollo CSV importer, message generator, outreach queue, contact_logger extensions all done
- One manual step remaining: run `python -m scripts.migrate_outreach_fields` once against live Notion workspace

## Sub-Plans

- [Phase 1: Foundation](2026-05-27-phase-1-foundation.md)
- [Phase 2: Pipeline Dashboard](2026-05-27-phase-2-dashboard.md)
- [Phase 7: LinkedIn Outreach Automation](2026-05-27-phase-7-linkedin-outreach.md) ← NEXT

## Definition of Done (per phase)

- All tests pass: `pytest tests/ -v`
- No `# type: ignore` or bare `except:` blocks
- Every public function has a type-annotated signature
- Script runs end-to-end against real Notion sandbox (manual smoke test)
