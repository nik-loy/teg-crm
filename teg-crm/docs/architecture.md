# TEG CRM — Architecture

## Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│  Entry Points                                               │
│  scripts/setup_notion_dbs.py   (one-time setup)            │
│  scripts/discover_users.py     (one-time setup)            │
│  python -m src.dashboard.generate_dashboard                 │
│  python -m src.importer.csv_importer --csv <file>          │
│  python -m src.reminders.follow_up_bot                      │
│  python -m src.reports.weekly_report                        │
│  python -m src.linkedin.contact_logger                      │
│  .github/workflows/daily_reminders.yml  (cron)             │
│  .github/workflows/weekly_report.yml    (cron)             │
└───────────────┬─────────────────────────────────────────────┘
                │ uses
┌───────────────▼─────────────────────────────────────────────┐
│  Domain Modules (src/)                                      │
│  dashboard/generate_dashboard.py  — fetch + aggregate + render │
│  importer/csv_importer.py         — parse + dedup + upsert  │
│  reminders/follow_up_bot.py       — query overdue + email   │
│  reports/weekly_report.py         — aggregate + email       │
│  linkedin/contact_logger.py       — CLI contact creation    │
└───────────────┬─────────────────────────────────────────────┘
                │ uses
┌───────────────▼─────────────────────────────────────────────┐
│  Foundation (src/)                                          │
│  config.py          — Config dataclass, from_env()         │
│  notion_helpers.py  — paginated_query, with_retry,         │
│                       property builder functions            │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Config loading
`Config.from_env()` reads all required env vars and raises `EnvironmentError` listing every
missing var at once (not one-at-a-time). `config/team.json` provides team member data
(name, Notion UUID, email) without putting structured data in env vars.

### Notion API interactions
All queries go through `paginated_query()` in `notion_helpers.py`, which handles the
`start_cursor`/`has_more` pagination loop automatically and sleeps 0.35s between pages.
All write operations go through `with_retry()`, which implements exponential backoff on
HTTP 429 responses (up to 5 attempts, 1/2/4/8/16s waits).

### Database creation order
The 6 Notion databases have relation dependencies. `setup_notion_dbs.py` creates them in
this order to satisfy foreign keys:

  1. Companies  (no relations)
  2. Events     (no relations)
  3. Contacts   (→ Companies)
  4. Events Attended  (→ Contacts, Events)
  5. Interactions     (→ Contacts)
  6. Speaker Pipeline (→ Contacts, Events)

### Dashboard data flow
`generate_dashboard.py` does a single paginated fetch of the full Contacts database,
runs pure-Python aggregation (no secondary API calls), then injects the JSON data blob
into `template.html` via string replacement of `{{DASHBOARD_DATA}}`. Output is a
single self-contained HTML file with no external dependencies except a CDN-hosted
Chart.js bundle.

### Deduplication strategy (Importer)
Primary key: email address (normalised to lowercase, stripped). If email matches an
existing Notion contact, the record is updated, not duplicated.
Secondary key (no email): normalised `name + company`. If both match an existing record,
skip and log a warning. If neither match, create new. The importer is idempotent — safe
to re-run on the same CSV.

### Testing approach
No live Notion connections in tests. All `notion_client.Client` calls are replaced with
`MagicMock`. `conftest.py` provides `mock_config` and `mock_notion_client` fixtures
shared across all test files. Schema builder functions in `setup_notion_dbs.py` are
pure functions with no side effects, so they're tested directly.

## Scheduling (GitHub Actions)

| Workflow | Schedule | Script |
|----------|----------|--------|
| `daily_reminders.yml` | `0 5 * * 1-5` (7am CET weekdays) | `src.reminders.follow_up_bot` |
| `weekly_report.yml` | `0 6 * * 1` (8am CET every Monday) | `src.reports.weekly_report` |

Both workflows use `ubuntu-latest`, `python-version: 3.11`, and dependency caching via
`actions/cache` on `requirements.txt` hash. All secrets injected via `${{ secrets.* }}`.
