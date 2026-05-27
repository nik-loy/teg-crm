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
| `src/dashboard/template.html` | 2 | **⬅ NEXT** |
| `src/importer/csv_importer.py` | 3 | Create |
| `tests/test_importer.py` | 3 | Create |
| `src/reminders/follow_up_bot.py` | 4 | Create |
| `.github/workflows/daily_reminders.yml` | 4 | Create |
| `tests/test_reminders.py` | 4 | Create |
| `src/reports/weekly_report.py` | 5 | Create |
| `.github/workflows/weekly_report.yml` | 5 | Create |
| `src/linkedin/contact_logger.py` | 6 | Create |

## Current Status (as of 2026-05-27)

**Phase 1: Foundation — COMPLETE** ✅ All 6 tasks done, all tests passing.

**Phase 2: Dashboard — IN PROGRESS**
- Task 1 (aggregation logic): ✅ Done — `generate_dashboard.py` + 17 tests passing
- **Task 2 (HTML template): NEXT** — Create `src/dashboard/template.html`, run full suite, smoke test

**Start here in a new session:**
Open `docs/superpowers/plans/2026-05-27-phase-2-dashboard.md` and execute **Task 2** from Step 3 onward (Steps 1–2 already done — render tests are in `tests/test_dashboard.py` and passing).

## Sub-Plans

- [Phase 1: Foundation](2026-05-27-phase-1-foundation.md)
- [Phase 2: Pipeline Dashboard](2026-05-27-phase-2-dashboard.md)
- Phases 3–6: Plan after Phase 2 ships (CSV format must be confirmed for Phase 3)

## Definition of Done (per phase)

- All tests pass: `pytest tests/ -v`
- No `# type: ignore` or bare `except:` blocks
- Every public function has a type-annotated signature
- Script runs end-to-end against real Notion sandbox (manual smoke test)
