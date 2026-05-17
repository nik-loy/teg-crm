# Backtest → Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the Phase 1.5 backtest report, smoke-test the live pipeline end-to-end, and enable Slack alerting.

**Architecture:** All code already exists. Steps 1–2 are pure execution (run scripts, verify output). Step 3 is a config change. No source files need modification for the core tasks. The Phase 3 HMM upgrade is explicitly gated on 60 days of live data per `docs/roadmap.md` and is out of scope here.

**Tech Stack:** Python 3.11+, asyncio, yfinance, SQLite (aiosqlite), statsmodels, FastAPI + HTMX, Slack webhooks (optional)

---

## Task 1: Verify backtest plumbing (fast smoke run)

Run with 6 symbols and 150 bars to confirm the full sweep pipeline executes without errors before committing to the 90-minute full run.

**Files:**
- Execute: `scripts/run_backtest.py` (already complete — no edits needed)
- Output: `docs/backtest-report.md` (will be overwritten by Task 2)

- [ ] **Step 1: Run quick smoke sweep**

```bash
cd C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha
python scripts/run_backtest.py --symbols SPY QQQ TLT GLD NVDA AMD --bars 150 --log-level INFO
```

Expected output (watch for these log lines in order):
```
INFO Downloading daily bars for 6 symbols (period=3y)...
INFO Fetched data for 6 / 6 symbols
INFO Pre-screening: N candidate pairs from 6 symbols (threshold=0.50)
INFO Running base replay...
INFO Base replay complete: N bars processed, N ACTIVE signals
INFO Base hit rate: N.NNN (N/N signals evaluated)
INFO Starting parameter sweep (448 combinations)...
INFO   sweep progress: 50 / 448
...
INFO   sweep progress: 448 / 448
INFO Best combo: corr=N.NN gp=N.NN dr=N.N tz=N.N hit_rate=N.NNN mean_pnl=N.Nbps evaluated=N
INFO Report written to .../docs/backtest-report.md
```

If it completes without a Python traceback, the plumbing works.

- [ ] **Step 2: Verify the report file was created**

```bash
ls -la C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha/docs/backtest-report.md
```

Expected: a file ≥ 2 KB with a `.md` extension.

```bash
head -30 C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha/docs/backtest-report.md
```

Expected: starts with `# NexusAlpha Phase 1.5 Backtesting Report` and contains a best-threshold table.

- [ ] **Step 3: Commit the smoke report**

```bash
cd C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha
git add docs/backtest-report.md
git commit -m "chore: add smoke backtest report (6 symbols, 150 bars)"
```

---

## Task 2: Full parameter sweep (all 30 symbols, 600 bars)

This takes 60–120 minutes. Run it and let it finish. It overwrites `docs/backtest-report.md` with the authoritative Phase 1.5 report.

**Files:**
- Execute: `scripts/run_backtest.py` (no edits)
- Output: `docs/backtest-report.md` (final report)

- [ ] **Step 1: Run the full sweep**

```bash
cd C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha
python scripts/run_backtest.py --bars 600 --log-level INFO
```

No `--symbols` flag = uses the full default list of 30 symbols. Progress is logged every 50 combos.

Expected final log lines:
```
INFO   sweep progress: 448 / 448
INFO Best combo: corr=N.NN gp=N.NN ...
INFO Report written to .../docs/backtest-report.md
```

- [ ] **Step 2: Read the report — note the recommended thresholds**

```bash
cat C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha/docs/backtest-report.md
```

Note the "Best Threshold Configuration" table. If the best thresholds differ materially from the `config.yaml` defaults, update them:

| config.yaml key | default | update if best differs |
|---|---|---|
| `gates.correlation_threshold` | 0.70 | yes |
| `gates.granger_p_threshold` | 0.05 | yes |
| `gates.directionality_ratio` | 3.0 | yes |
| `gates.te_z_threshold` | 2.0 | yes |

To update `config.yaml` with the best values found, edit the `gates:` section:

```yaml
# config.yaml — gates section
gates:
  correlation_threshold: <best_value>   # e.g. 0.75
  granger_p_threshold: <best_value>     # e.g. 0.05
  directionality_ratio: <best_value>    # e.g. 3.0
  te_z_threshold: <best_value>          # e.g. 2.0
  # ... leave all other keys unchanged
```

- [ ] **Step 3: Commit the final report (and optional config update)**

```bash
cd C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha
git add docs/backtest-report.md config.yaml
git commit -m "feat: Phase 1.5 backtest report — optimal thresholds documented"
```

This commit meets the Phase 1.5 milestone.

---

## Task 3: Smoke-test the live pipeline

Run `python -m nexusalpha` for 3–5 minutes with the default yfinance source. Verify all agents start, data is ingested, and the system shuts down cleanly.

**Files:**
- Execute: `src/nexusalpha/__main__.py` (already complete — no edits)
- Reads: `config.yaml`, `data/nexusalpha.db`

- [ ] **Step 1: Start the system**

```bash
cd C:/Users/nikla/.gemini/antigravity/scratch/nexusalpha
python -m nexusalpha --log-level INFO
```

Expected startup log lines (in order, within ~10 seconds):
```
INFO nexusalpha.core.database ... Database initialized
INFO nexusalpha.agents.ingestion ... IngestionAgent started
INFO nexusalpha.agents.statistical ... StatisticalAgent started
INFO nexusalpha.agents.orchestrator ... OrchestratorAgent started
INFO nexusalpha.agents.alerting ... AlertingAgent started
INFO nexusalpha.agents.guardian ... GuardianAgent started
INFO nexusalpha.agents.scanner ... ScannerAgent started
INFO nexusalpha.agents.semantic ... SemanticAgent started
INFO __main__ NexusAlpha started — monitoring N symbols
```

After ~60 seconds the ingestion agent fires its first poll:
```
INFO nexusalpha.agents.ingestion ... Fetching SPY ...
...
INFO nexusalpha.agents.ingestion ... PriceUpdate published: SPY ...
```

- [ ] **Step 2: Let it run for 2–3 minutes, then stop**

Press `Ctrl+C`. Expected:
```
INFO __main__ Received signal 2 — shutting down
INFO __main__ Stopping NexusAlpha...
INFO __main__ NexusAlpha stopped cleanly
```

If the process hangs on shutdown (>5 seconds), that is a bug — the bus stop or agent stop is blocking. Kill with `Ctrl+C` again and note which agent stalled.

- [ ] **Step 3: Verify database state**

```bash
python - <<'EOF'
import sqlite3
con = sqlite3.connect("data/nexusalpha.db")
for table in ["instruments", "signals", "signal_state_changes", "signal_outcomes"]:
    count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"{table}: {count} rows")
con.close()
EOF
```

Expected: `instruments` should have ≥ 1 row per polled symbol. `signals` may be 0 (fine — only 1 poll, probably not enough bars for gates to activate). No Python errors.

- [ ] **Step 4: Commit a note if any startup issues were found**

If all is clean, no commit needed. If you had to patch anything, commit the fix:

```bash
git add <changed files>
git commit -m "fix: <describe what was broken>"
```

---

## Task 4: Enable Slack alerting

Set the Slack webhook URL in config so ACTIVE signals are delivered to a channel. The Slack integration is already implemented in `agents/alerting.py` — this is purely configuration.

**Files:**
- Modify: `config.yaml` (the `alerts.slack` section)

- [ ] **Step 1: Get a Slack incoming webhook URL**

In Slack: Apps → Incoming Webhooks → Add to Workspace → select channel → copy the webhook URL (starts with `https://hooks.slack.com/services/...`).

- [ ] **Step 2: Set via environment variable (preferred — keeps secrets out of config.yaml)**

```bash
# In your shell session or .env file (never commit .env)
set NEXUSALPHA_ALERTS_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
```

Alternatively, edit `config.yaml` directly (only if this repo is private):

```yaml
alerts:
  slack:
    enabled: true
    webhook_url: "https://hooks.slack.com/services/T.../B.../..."
```

- [ ] **Step 3: Test the webhook manually**

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"NexusAlpha Slack test — alerts are wired up."}' \
  https://hooks.slack.com/services/T.../B.../...
```

Expected: `ok` response from Slack and a message in your channel.

- [ ] **Step 4: Restart the system and verify**

```bash
python -m nexusalpha --log-level DEBUG
```

Watch for:
```
DEBUG nexusalpha.agents.alerting ... Slack enabled, webhook configured
```

When an ACTIVE signal fires (may take hours of real operation), a Slack message will appear in the format defined in `agents/alerting.py`.

- [ ] **Step 5: Commit the config change (if you wrote the key into config.yaml)**

If you used an env var, no commit needed. If you put it in config.yaml (private repo only):

```bash
git add config.yaml
git commit -m "feat: enable Slack alerting"
```

---

## Out of scope (requires 60 days of live data)

**Phase 3 HMM upgrade** (`agents/guardian.py` regime detection): The roadmap gates this on 60+ days of live operation with provenance data. The current simplified CUSUM proxy in `guardian.py` is sufficient for Phase 2. Return to this after live data accumulates.
