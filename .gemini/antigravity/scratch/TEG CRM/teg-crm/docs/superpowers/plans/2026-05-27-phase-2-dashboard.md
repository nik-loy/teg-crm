# Phase 2: Pipeline Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a static single-file HTML dashboard showing pipeline stage distribution, tier mix, contact sources, new contacts per month, and overdue follow-up count — from live Notion data.

**Architecture:** `generate_dashboard.py` does one paginated Notion fetch, runs pure-Python aggregation, then injects a JSON blob into `template.html` via `{{DASHBOARD_DATA}}` string replacement. Output is a self-contained HTML file with Chart.js loaded from CDN. No build step, no server.

**Tech Stack:** Python 3.11+, notion-client, rich, Chart.js 4.x (CDN), pytest

**Prerequisite:** Phase 1 complete. `src/config.py` and `src/notion_helpers.py` exist and all Phase 1 tests pass.

> **⬅ RESUME HERE (2026-05-27):** Task 1 is complete. Task 2 Steps 1–2 are done (render tests in `tests/test_dashboard.py`, all 17 pass). **Start at Task 2, Step 3** — write `src/dashboard/template.html`.

---

## File Map

- Create: `src/dashboard/generate_dashboard.py`
- Modify: `src/dashboard/template.html` (currently empty stub)
- Create: `tests/test_dashboard.py`

---

### Task 1: Aggregation logic

The `aggregate()` function is pure Python — no Notion calls. Test it exhaustively before touching anything else.

**Files:**
- Create: `tests/test_dashboard.py` (aggregation tests only — template tests added in Task 2)
- Create: `src/dashboard/generate_dashboard.py` (aggregation + render stubs)

- [x] **Step 1: Write the failing aggregation tests**

Create `tests/test_dashboard.py`:

```python
from datetime import date
import pytest

# Import will fail until generate_dashboard.py is created — expected.
from src.dashboard.generate_dashboard import aggregate, DashboardData


# ── Helpers ────────────────────────────────────────────────────────────────────

def _contact(
    stage: str | None = None,
    tier: str | None = None,
    source: str | None = None,
    fu_due: str | None = None,
    fu_complete: bool = False,
    created: str = "2026-01-15T10:00:00.000Z",
) -> dict:
    """Builds a minimal Notion contact page dict."""
    props: dict = {
        "Follow-Up Complete": {"checkbox": fu_complete},
    }
    if stage:
        props["Pipeline Stage"] = {"select": {"name": stage}}
    if tier:
        props["Tier"] = {"select": {"name": tier}}
    if source:
        props["Source"] = {"select": {"name": source}}
    if fu_due:
        props["Follow-Up Due Date"] = {"date": {"start": fu_due}}
    return {"properties": props, "created_time": created}


# ── aggregate — totals ─────────────────────────────────────────────────────────

def test_aggregate_total_contacts():
    contacts = [_contact(), _contact(), _contact()]
    assert aggregate(contacts).total_contacts == 3


def test_aggregate_empty_returns_zeroes():
    data = aggregate([])
    assert data.total_contacts == 0
    assert data.overdue_count == 0
    assert data.by_stage == {}
    assert data.by_tier == {}
    assert data.by_source == {}
    assert data.new_by_month == {}


# ── aggregate — by_stage ───────────────────────────────────────────────────────

def test_aggregate_counts_by_stage():
    contacts = [
        _contact(stage="Awareness"),
        _contact(stage="Awareness"),
        _contact(stage="Engaged"),
    ]
    data = aggregate(contacts)
    assert data.by_stage["Awareness"] == 2
    assert data.by_stage["Engaged"] == 1


def test_aggregate_skips_contacts_without_stage():
    contacts = [_contact(), _contact(stage="Activated")]
    data = aggregate(contacts)
    assert list(data.by_stage.keys()) == ["Activated"]


# ── aggregate — by_tier ────────────────────────────────────────────────────────

def test_aggregate_counts_by_tier():
    contacts = [_contact(tier="Tier 1"), _contact(tier="Tier 1"), _contact(tier="Tier 2")]
    data = aggregate(contacts)
    assert data.by_tier["Tier 1"] == 2
    assert data.by_tier["Tier 2"] == 1


# ── aggregate — by_source ──────────────────────────────────────────────────────

def test_aggregate_counts_by_source():
    contacts = [
        _contact(source="TEG Event"),
        _contact(source="LinkedIn"),
        _contact(source="TEG Event"),
    ]
    data = aggregate(contacts)
    assert data.by_source["TEG Event"] == 2
    assert data.by_source["LinkedIn"] == 1


# ── aggregate — overdue ────────────────────────────────────────────────────────

def test_aggregate_counts_overdue_followup():
    contacts = [_contact(fu_due="2020-01-01", fu_complete=False)]
    assert aggregate(contacts).overdue_count == 1


def test_aggregate_completed_followup_not_overdue():
    contacts = [_contact(fu_due="2020-01-01", fu_complete=True)]
    assert aggregate(contacts).overdue_count == 0


def test_aggregate_future_followup_not_overdue():
    contacts = [_contact(fu_due="2099-12-31", fu_complete=False)]
    assert aggregate(contacts).overdue_count == 0


def test_aggregate_no_due_date_not_overdue():
    contacts = [_contact(fu_complete=False)]
    assert aggregate(contacts).overdue_count == 0


def test_aggregate_multiple_overdue():
    contacts = [
        _contact(fu_due="2020-01-01", fu_complete=False),
        _contact(fu_due="2020-06-01", fu_complete=False),
        _contact(fu_due="2020-01-01", fu_complete=True),
        _contact(fu_due="2099-12-31", fu_complete=False),
    ]
    assert aggregate(contacts).overdue_count == 2


# ── aggregate — new_by_month ───────────────────────────────────────────────────

def test_aggregate_groups_by_month():
    contacts = [
        _contact(created="2026-01-10T09:00:00.000Z"),
        _contact(created="2026-01-25T09:00:00.000Z"),
        _contact(created="2026-02-03T09:00:00.000Z"),
    ]
    data = aggregate(contacts)
    assert data.new_by_month["2026-01"] == 2
    assert data.new_by_month["2026-02"] == 1


def test_aggregate_generated_at_is_set():
    data = aggregate([])
    assert data.generated_at != ""
```

- [x] **Step 2: Run tests and confirm they fail**

Run: `pytest tests/test_dashboard.py -v`
Expected: `ImportError: No module named 'src.dashboard.generate_dashboard'`

- [x] **Step 3: Implement generate_dashboard.py (aggregation only)**

Create `src/dashboard/generate_dashboard.py`:

```python
"""Generates a static HTML pipeline dashboard from Notion data.

Run: python -m src.dashboard.generate_dashboard [--output dashboard_output/index.html]
"""
from __future__ import annotations

import argparse
import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console

from src.config import Config
from src.notion_helpers import paginated_query

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)


@dataclass
class DashboardData:
    by_stage: dict[str, int] = field(default_factory=dict)
    by_tier: dict[str, int] = field(default_factory=dict)
    by_source: dict[str, int] = field(default_factory=dict)
    new_by_month: dict[str, int] = field(default_factory=dict)
    overdue_count: int = 0
    total_contacts: int = 0
    generated_at: str = ""


def aggregate(contacts: list[dict]) -> DashboardData:
    """Pure aggregation — no Notion calls. Accepts raw Notion page dicts."""
    data = DashboardData(generated_at=datetime.utcnow().isoformat())
    data.total_contacts = len(contacts)
    today = date.today().isoformat()

    for contact in contacts:
        props = contact.get("properties", {})

        stage = props.get("Pipeline Stage", {}).get("select")
        if stage:
            data.by_stage[stage["name"]] = data.by_stage.get(stage["name"], 0) + 1

        tier = props.get("Tier", {}).get("select")
        if tier:
            data.by_tier[tier["name"]] = data.by_tier.get(tier["name"], 0) + 1

        source = props.get("Source", {}).get("select")
        if source:
            data.by_source[source["name"]] = data.by_source.get(source["name"], 0) + 1

        fu_complete = props.get("Follow-Up Complete", {}).get("checkbox", False)
        fu_due = props.get("Follow-Up Due Date", {}).get("date")
        if not fu_complete and fu_due and fu_due.get("start", "") < today:
            data.overdue_count += 1

        created = contact.get("created_time", "")
        if created:
            month = created[:7]
            data.new_by_month[month] = data.new_by_month.get(month, 0) + 1

    return data


def render_dashboard(data: DashboardData, template_path: Path, output_path: Path) -> None:
    """Injects aggregated data into the HTML template and writes the output file."""
    template = template_path.read_text(encoding="utf-8")
    payload = json.dumps({
        "by_stage": data.by_stage,
        "by_tier": data.by_tier,
        "by_source": data.by_source,
        "new_by_month": dict(sorted(data.new_by_month.items())),
        "overdue_count": data.overdue_count,
        "total_contacts": data.total_contacts,
        "generated_at": data.generated_at,
    })
    html = template.replace("{{DASHBOARD_DATA}}", payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TEG CRM pipeline dashboard")
    parser.add_argument(
        "--output",
        default="dashboard_output/index.html",
        help="Output file path (default: dashboard_output/index.html)",
    )
    args = parser.parse_args()

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    console.print("Fetching contacts from Notion...")
    contacts = paginated_query(client, cfg.contacts_db_id)
    console.print(f"  [green]✓[/green] {len(contacts)} contacts loaded")

    data = aggregate(contacts)
    template_path = Path(__file__).parent / "template.html"
    output_path = Path(args.output)
    render_dashboard(data, template_path, output_path)

    console.print(f"\n[bold green]✓ Dashboard generated:[/bold green] {output_path.resolve()}")
    console.print(f"  Total contacts  : {data.total_contacts}")
    console.print(f"  Overdue follow-ups: {data.overdue_count}")


if __name__ == "__main__":
    main()
```

- [x] **Step 4: Run aggregation tests and confirm they pass**

Run: `pytest tests/test_dashboard.py -v`
Expected: all aggregation tests PASSED.

- [x] **Step 5: Commit**

```bash
git add src/dashboard/generate_dashboard.py tests/test_dashboard.py
git commit -m "feat: add dashboard aggregation logic and tests"
```

---

### Task 2: HTML template + render test

**Files:**
- Modify: `src/dashboard/template.html`
- Modify: `tests/test_dashboard.py` (add render tests)

- [x] **Step 1: Add render tests to tests/test_dashboard.py**

Append to `tests/test_dashboard.py`:

```python
# ── render_dashboard ───────────────────────────────────────────────────────────

from src.dashboard.generate_dashboard import render_dashboard


def test_render_creates_output_file(tmp_path):
    template = tmp_path / "template.html"
    template.write_text('<script>const D={{DASHBOARD_DATA}};</script>')
    output = tmp_path / "out" / "index.html"

    data = DashboardData(
        by_stage={"Awareness": 3, "Engaged": 1},
        by_tier={"Tier 1": 2},
        by_source={"TEG Event": 4},
        new_by_month={"2026-01": 3},
        overdue_count=2,
        total_contacts=4,
        generated_at="2026-01-15T10:00:00",
    )
    render_dashboard(data, template, output)
    assert output.exists()


def test_render_replaces_placeholder(tmp_path):
    template = tmp_path / "t.html"
    template.write_text("DATA={{DASHBOARD_DATA}}")
    output = tmp_path / "out.html"

    render_dashboard(
        DashboardData(by_stage={"Awareness": 5}, total_contacts=5, generated_at="x"),
        template,
        output,
    )
    content = output.read_text()
    assert "{{DASHBOARD_DATA}}" not in content
    assert '"Awareness": 5' in content


def test_render_creates_parent_dirs(tmp_path):
    template = tmp_path / "t.html"
    template.write_text("{{DASHBOARD_DATA}}")
    deep_output = tmp_path / "a" / "b" / "c" / "index.html"
    render_dashboard(DashboardData(generated_at="x"), template, deep_output)
    assert deep_output.exists()


def test_render_new_by_month_is_sorted(tmp_path):
    template = tmp_path / "t.html"
    template.write_text("{{DASHBOARD_DATA}}")
    output = tmp_path / "o.html"
    data = DashboardData(
        new_by_month={"2026-03": 1, "2026-01": 2, "2026-02": 3},
        generated_at="x",
    )
    render_dashboard(data, template, output)
    import json as _json
    blob = output.read_text().replace("{{DASHBOARD_DATA}}", "")
    # The full output is just the injected JSON because template is bare {{DASHBOARD_DATA}}
    parsed = _json.loads(output.read_text())
    months = list(parsed["new_by_month"].keys())
    assert months == sorted(months)
```

- [x] **Step 2: Run render tests and confirm they fail** (Note: render tests pass immediately since render_dashboard is already implemented)

Run: `pytest tests/test_dashboard.py::test_render_creates_output_file -v`
Expected: FAIL — `template.html` has no `{{DASHBOARD_DATA}}` placeholder yet.

- [ ] **Step 3: Write src/dashboard/template.html**

Create `src/dashboard/template.html` (complete, standalone — paste the full content):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TEG CRM — Pipeline Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #f4f5f7; color: #222; }
    header { background: #1a1a2e; color: #fff; padding: 1.25rem 2rem;
             display: flex; justify-content: space-between; align-items: baseline; }
    header h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; }
    header p  { font-size: 0.8rem; opacity: 0.55; }
    .kpi-bar { background: #fff; border-bottom: 1px solid #e2e4e9;
               padding: 1rem 2rem; display: flex; gap: 2.5rem; }
    .kpi { text-align: center; }
    .kpi-value { font-size: 2rem; font-weight: 800; line-height: 1; }
    .kpi-label { font-size: 0.7rem; color: #888; text-transform: uppercase;
                 letter-spacing: 0.06em; margin-top: 0.25rem; }
    .kpi-value.danger { color: #e53e3e; }
    .grid { display: grid; grid-template-columns: 1fr 1fr;
            gap: 1.25rem; padding: 1.25rem 2rem; max-width: 1200px; margin: 0 auto; }
    .card { background: #fff; border-radius: 10px; padding: 1.25rem;
            box-shadow: 0 1px 4px rgba(0,0,0,.07); }
    .card h2 { font-size: 0.85rem; font-weight: 600; color: #555;
               text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; }
    .chart-wrap { position: relative; height: 260px; }
    @media (max-width: 680px) {
      .grid { grid-template-columns: 1fr; padding: 1rem; }
      .kpi-bar { flex-wrap: wrap; gap: 1rem; }
    }
  </style>
</head>
<body>

<header>
  <h1>TEG CRM — Pipeline Dashboard</h1>
  <p id="gen-at"></p>
</header>

<div class="kpi-bar">
  <div class="kpi">
    <div class="kpi-value" id="kpi-total">—</div>
    <div class="kpi-label">Total Contacts</div>
  </div>
  <div class="kpi">
    <div class="kpi-value danger" id="kpi-overdue">—</div>
    <div class="kpi-label">Overdue Follow-ups</div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>Pipeline Stage</h2>
    <div class="chart-wrap"><canvas id="chartStage"></canvas></div>
  </div>
  <div class="card">
    <h2>Contact Tier</h2>
    <div class="chart-wrap"><canvas id="chartTier"></canvas></div>
  </div>
  <div class="card">
    <h2>Source</h2>
    <div class="chart-wrap"><canvas id="chartSource"></canvas></div>
  </div>
  <div class="card">
    <h2>New Contacts by Month</h2>
    <div class="chart-wrap"><canvas id="chartMonth"></canvas></div>
  </div>
</div>

<script>
const DATA = {{DASHBOARD_DATA}};

// ── KPIs ──────────────────────────────────────────────────────────────────────
document.getElementById('kpi-total').textContent   = DATA.total_contacts;
document.getElementById('kpi-overdue').textContent = DATA.overdue_count;
document.getElementById('gen-at').textContent =
  'Generated ' + new Date(DATA.generated_at).toLocaleString('de-DE');

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe',
                 '#f472b6','#fb7185','#f97316','#fbbf24','#34d399'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function bar(id, labels, values, color) {
  new Chart(document.getElementById(id), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: color || PALETTE, borderRadius: 5 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }
    }
  });
}

function pie(id, labels, values) {
  new Chart(document.getElementById(id), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: PALETTE }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }, cutout: '55%' }
  });
}

// ── Stage (ordered by pipeline progression) ───────────────────────────────────
const STAGE_ORDER = ['Awareness','First Attendance','Engaged','Deepening','Activated'];
const stageLabels = STAGE_ORDER.filter(s => DATA.by_stage[s] != null);
bar('chartStage', stageLabels, stageLabels.map(s => DATA.by_stage[s]), '#6366f1');

// ── Tier ──────────────────────────────────────────────────────────────────────
const tierEntries = Object.entries(DATA.by_tier);
pie('chartTier', tierEntries.map(e => e[0]), tierEntries.map(e => e[1]));

// ── Source (sorted by volume descending) ──────────────────────────────────────
const srcEntries = Object.entries(DATA.by_source).sort((a,b) => b[1]-a[1]);
bar('chartSource', srcEntries.map(e => e[0]), srcEntries.map(e => e[1]));

// ── New contacts by month (line) ──────────────────────────────────────────────
const monthEntries = Object.entries(DATA.new_by_month);
new Chart(document.getElementById('chartMonth'), {
  type: 'line',
  data: {
    labels: monthEntries.map(e => e[0]),
    datasets: [{
      data: monthEntries.map(e => e[1]),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }
  }
});
</script>
</body>
</html>
```

- [ ] **Step 4: Run full test suite**

Run: `pytest tests/ -v`
Expected: all tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/template.html tests/test_dashboard.py
git commit -m "feat: add dashboard HTML template and render tests"
```

---

### Task 3: Smoke test against Notion

This task is manual and requires a populated `.env` and at least a few contacts in Notion.

- [ ] **Step 1: Add at least 3 contacts manually in Notion**

In the Contacts database, create 3 entries covering at least 2 different pipeline stages, 2 different tiers, and 1 with an overdue follow-up date (set date to yesterday, Follow-Up Complete = unchecked).

- [ ] **Step 2: Run the dashboard generator**

```bash
python -m src.dashboard.generate_dashboard --output dashboard_output/index.html
```

Expected terminal output:
```
Fetching contacts from Notion...
  ✓ 3 contacts loaded

✓ Dashboard generated: .../dashboard_output/index.html
  Total contacts  : 3
  Overdue follow-ups: 1
```

- [ ] **Step 3: Open the output file in a browser**

Open `dashboard_output/index.html`. Verify:
- KPI bar shows correct total and overdue count
- Stage chart shows bars in the correct pipeline order
- All 4 charts render without JavaScript errors (check browser console)

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: Phase 2 complete — pipeline dashboard end-to-end"
```

---

## Phase 2 Definition of Done

- [ ] `pytest tests/ -v` → all tests green (including Phase 1)
- [ ] `dashboard_output/index.html` generated from real Notion data
- [ ] All 4 charts visible in browser with no console errors
- [ ] KPI bar shows correct counts
- [ ] Stage chart orders bars by pipeline stage (Awareness → Activated), not alphabetically
