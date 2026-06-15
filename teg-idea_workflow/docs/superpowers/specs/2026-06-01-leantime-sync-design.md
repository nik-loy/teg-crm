# Leantime → Notion Sync — Full Design Spec
**Date:** 2026-06-01
**Feature:** Bidirectional idea lifecycle tracking with weekly Leantime status digest, completion detection, and two-level staleness escalation
**Approach selected:** Approach A — dedicated Sunday cron

---

## 1. Problem Statement

The existing system is one-directional: Notion → Vercel → Leantime. Once Leantime tickets are created and their IDs written back to Notion, the system goes silent. There is no way to know whether:

- Work is progressing on any given ticket
- All tickets for an idea have been completed
- An idea has been quietly abandoned in Leantime

This feature adds a return loop: every Sunday the system reads all active Leantime ticket statuses, writes a human-readable summary back to Notion, detects completion, and escalates if nothing is moving.

---

## 2. Architecture

### Existing flow (unchanged)
```
Notion ──[5-min cron, GitHub Actions]──→ POST /api/cron
                                              ↓
                                        Notion (status updates)
                                        Leantime (ticket creation)
                                        Resend (emails)
```

### New flow (added)
```
[Sunday 9am cron, GitHub Actions] ──→ POST /api/leantime-sync
                                            ↓
                               getTicket(id) × N per idea
                               (leantime.rpc.Tickets.getTicket)
                                            ↓
                               Notion: write status snapshot,
                                       trigger completion,
                                       update staleness counter
                                            ↓
                               Resend: staleness alerts (L1/L2),
                                       completion notification
```

No webhooks — Leantime does not support them. No new environment variables — all required secrets already exist (`LEANTIME_URL`, `LEANTIME_API_KEY`, `CRON_SECRET`, `RESEND_API_KEY`).

---

## 3. Notion Schema Changes

Five new properties added to the **Ideas** database. No new databases.

| Property | Notion Type | Purpose |
|----------|-------------|---------|
| `Leantime Status Raw` | Text | Machine-readable JSON snapshot: `{"123":0,"456":4}` — compared week-to-week to detect staleness |
| `Leantime Summary` | Text | Human-readable weekly snapshot — visible in Notion views and the Strategy inbox |
| `Leantime Last Synced` | Date | Timestamp of last successful sync — used to skip ideas that have never been synced |
| `Staleness Alert Count` | Number | `0` = no alert sent, `1` = Level 1 sent (dept lead), `2` = Level 2 sent (Strategy + submitter) |
| `Mark Complete` | Checkbox | Manual override — when checked, idea is marked Completed regardless of Leantime state |

The existing `Leantime Ticket IDs` (comma-separated IDs) and `Status` (select, already includes "Completed") fields are reused without changes.

### New Notion view — "Completed Ideas"
A filtered view of the **Ideas** database: `Status = "Completed"`, sorted by `Last Processed At` descending. This is the "completed folder" — no separate database needed. Link bookmarked in relevant Notion spaces.

---

## 4. Leantime API

### Read method
```
Method: leantime.rpc.Tickets.getTicket
Params: { "id": "<ticketId>" }
Returns: ticket object or false
```

### Relevant status values (integers, fixed — cannot change even if admins relabel them)
| Integer | Meaning |
|---------|---------|
| `0` | Done ✅ |
| `-1` | Archived ✅ (treated as done) |
| `3` | New 🔵 |
| `4` | In Progress 🟡 |
| `1` | Blocked 🔴 |
| `2` | Waiting for Approval ⏳ |

**Completion condition:** all tracked ticket statuses are `0` or `-1`.

**Staleness detection:** Leantime has no `dateTimeUpdated` field. Staleness is therefore detected by comparing the current status snapshot `{id: status}` to the snapshot stored in `Leantime Status Raw` from the previous sync. If no status value changed, no progress occurred.

---

## 5. Sunday Sync Processing Logic

The sync processes only ideas with `Status ∈ {Routing, Partially Acknowledged, Fully Acknowledged}` AND `Leantime Ticket IDs` not empty. All other ideas (Draft, Rejected, Completed, etc.) are excluded by the Notion filter — never fetched.

### Per-idea processing order

**Step 1 — Manual override check**
If `Mark Complete` checkbox is `true`: set `Status = "Completed"`, set `Leantime Last Synced`, send completion email, skip remaining steps.

**Step 2 — Fetch Leantime statuses**
Parse `Leantime Ticket IDs` (split by `,`). For each ID: call `getTicket(id)`, extract `status` integer. Build current snapshot: `{id: status, ...}`.
- If `getTicket` returns `false` for a ticket ID: log a warning, skip that ticket (do not crash the sync for this idea).

**Step 3 — Detect completion**
If all fetched statuses are `0` or `-1`: set `Status = "Completed"`, send completion email (email #13), write summary, skip staleness logic.

**Step 4 — Detect staleness (for non-completed ideas)**
Parse `Leantime Status Raw` from Notion (the previous snapshot). Compare to current snapshot:

- **Any status changed** → progress detected → reset `Staleness Alert Count` to `0`
- **No status changed**:
  - Count = `0` → send Level 1 alert (email #11 to dept lead(s)) → set Count = `1`
  - Count = `1` → send Level 2 alert (email #12 to Strategy Head + submitter) → set Count = `2`
  - Count = `2` → already fully escalated, no further emails; log in summary only

Staleness alert recipients for Level 1: the dept lead for **each department whose ticket has not changed status**. If only one dept is stale, only that lead is emailed. If all are stale, all leads are emailed.

**Step 5 — Write results to Notion**
For every idea processed (regardless of outcome):
- Overwrite `Leantime Status Raw` with current snapshot JSON
- Overwrite `Leantime Summary` with human-readable text (see format below)
- Set `Leantime Last Synced` to today

### Leantime Summary format

Normal state:
```
✅ Marketing: Done · 🟡 Operations: In Progress · 🔵 IT: New
Last synced: Sun 1 Jun 2026
```

Stale state (L1 sent):
```
⚠️ No progress since last week — Operations and IT leads notified
✅ Marketing: Done · 🟡 Operations: In Progress (no change) · 🔵 IT: New (no change)
Last synced: Sun 1 Jun 2026
```

Escalated state (L2 sent):
```
🚨 Escalated — Strategy Head and submitter notified (2 weeks no progress)
✅ Marketing: Done · 🟡 Operations: In Progress (no change) · 🔵 IT: New (no change)
Last synced: Sun 1 Jun 2026
```

---

## 6. Email Templates

### Email #11 — Staleness Level 1 (dept lead)
- **Trigger:** No Leantime status change since previous Sunday, `Staleness Alert Count` = 0 → 1
- **Recipient:** Dept lead for each stale ticket (from `config/departments.ts`)
- **Subject:** `Action needed: no progress on your Leantime ticket for [idea title]`
- **Body:** Idea summary, current Leantime ticket status, direct Notion link, "Please update your Leantime ticket or let Strategy know if there is a blocker."

### Email #12 — Staleness Level 2 (escalation)
- **Trigger:** No change for a second consecutive week, Count = 1 → 2
- **Recipients:** Strategy Head + original submitter
- **Subject:** `Escalation: [idea title] has had no Leantime activity for 2 weeks`
- **Body:** Idea summary, which departments are stalled, current ticket statuses, Notion link, "This requires your attention."

### Email #13 — Idea completed
- **Trigger:** All tickets status `0`/`-1`, or `Mark Complete` checked
- **Recipients:** Original submitter + Strategy Head (FYI)
- **Subject:** `Your idea is complete: [idea title]`
- **Body:** Congratulations, summary of departments that contributed, submission date, completion date, Notion link.

---

## 7. New Files

| File | Purpose |
|------|---------|
| `src/app/api/leantime-sync/route.ts` | POST endpoint, auth guard, calls sync function, returns summary JSON |
| `src/core/leantime-sync.ts` | All sync logic: fetch ideas, fetch tickets, detect completion, staleness, write back |
| `.github/workflows/leantime-sync.yml` | Sunday 9am GitHub Actions cron trigger |

## 8. Modified Files

| File | Change |
|------|--------|
| `src/lib/leantime.ts` | Add `getTicketStatus(id): Promise<number \| null>` — calls `getTicket`, extracts `status`, returns null if ticket not found or error |
| `src/lib/notion.ts` | Add `getActiveIdeasForSync()`, `setLeantimeSync(ideaId, raw, summary, syncDate)`, `setStalenessCount(ideaId, count)`, `setIdeaCompleted(ideaId)`, `getMarkComplete(ideaId)` |
| `src/lib/email.ts` | Add `sendStalenessL1`, `sendStalenessL2`, `sendIdeaCompleted` |
| `src/types/index.ts` | Add `LeantimeStatusSnapshot` type: `Record<string, number>` |
| `docs/notion-setup.md` | Add instructions for the 5 new Notion properties and the Completed Ideas view |

---

## 9. Error Handling

- If `getTicket` fails for one ticket: log warning, treat that ticket as "unknown status", skip it in completion and staleness checks for this run. Do not fail the entire idea.
- If a Notion write fails after the Leantime fetch: log error, continue to next idea. The snapshot may be stale for one week — acceptable.
- If Resend fails for a staleness email: log error, do not increment the staleness counter (retry next week).
- The endpoint never throws — returns a 200 with an `errors` array on partial failures, same pattern as `/api/cron`.

---

## 10. Testing

- Unit test `src/core/leantime-sync.ts`:
  - All tickets `0` → completion triggered
  - `Mark Complete` checked → completion triggered even if tickets not done
  - No status change week-over-week → staleness counter increments
  - Status changed → staleness counter resets to 0
  - Count = 2 already → no further emails
  - One ticket returns null (`getTicket` fails) → idea not crashed, skipped ticket
- Mock `src/lib/leantime.ts`, `src/lib/notion.ts`, `src/lib/email.ts` in all tests
- Mock `src/lib/env.ts` (same pattern as existing processor tests)

---

## 11. Deployment

1. Add the 5 new properties to the Notion Ideas database (see `docs/notion-setup.md`)
2. Create the "Completed Ideas" view in Notion
3. No new environment variables needed
4. Deploy updated Vercel app
5. Enable the new GitHub Actions workflow
6. Test via `workflow_dispatch` on the new workflow — verify at least one active idea gets its `Leantime Summary` updated in Notion
