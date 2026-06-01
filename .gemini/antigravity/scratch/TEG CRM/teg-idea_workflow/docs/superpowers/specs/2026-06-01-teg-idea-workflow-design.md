# TEG Idea Workflow — Full Design Spec
**Date:** 2026-06-01
**Club:** TEG e.V. (student club, event organisation)
**Status:** Approved — ready for implementation

---

## 1. Overview

A workflow automation system that routes idea submissions and inter-department requests from a Notion form through a structured approval process into Leantime project management tickets. The system lives entirely within tools the club already uses: Notion (UI), Vercel (engine), GitHub Actions (scheduler), Resend (email), and Leantime (task management).

**Design principles:**
- Notion is the only user interface. No web portal, no login screens.
- All state lives in Notion. The Vercel app is stateless.
- Polling every 5 minutes. Reliability over speed — club workflows unfold over days.
- Completely free. No paid services anywhere.
- Departments are configuration, not code. Add/remove in one file.

---

## 2. System Architecture

```
NOTION (only UI)
  ↕ polled every 5 min
GITHUB ACTIONS (cron scheduler, free)
  → calls POST /api/cron on Vercel
VERCEL (stateless Next.js API routes)
  → reads/writes Notion
  → sends email via Resend
  → creates Leantime tickets via JSON-RPC
```

**Five components:**

| Component | Role | Cost |
|-----------|------|------|
| Notion | Submission form, strategy inbox, dept inbox, all state | Free |
| Vercel (Next.js) | API-only app — processes state changes, sends emails, creates tickets | Free (Hobby) |
| GitHub Actions | Cron trigger every 5 min → calls Vercel endpoint | Free |
| Resend | Email delivery | Free (3k/month) |
| Leantime (tegtime.myteg-ev.de) | Department task management | Already self-hosted |

---

## 3. Submission Form (Notion)

A Notion form linked to the Ideas database. All club members can access it.

### Required Fields
| Field | Type | Notes |
|-------|------|-------|
| Idea Title | Short text | Name of the idea |
| Submitter Name | Short text | Full name |
| Submitter Email | Email | Used for all notifications back to submitter |
| Submitter Department | Select | From department list |
| Submission Type | Select | **Club Initiative** or **Inter-dept Request** — determines entire routing path |
| Category | Select | Club Initiative: Event, Campaign, Internal Process, Partnership, Tool Request / Inter-dept: Design Request, Content Request, Logistics Request, Data/IT Request, Finance Request, Other |
| Description | Long text | Full explanation of the idea |
| Goal | Long text | What problem it solves or opportunity it captures |
| Success Criteria | Long text | How we know it worked |
| Departments Needed | Multi-select | Which teams need to be involved |
| Proposed Timeline | Date | Target date or timeframe |
| Priority | Select | Low / Medium / High / Critical |

### Optional Fields
| Field | Type | Notes |
|-------|------|-------|
| Inspiration / References | URL or text | Links, examples, similar initiatives |
| Proposed Owner | Short text | Who should lead if approved |
| Risks / Concerns | Long text | Known blockers or risks |
| Dependencies | Long text | What this relies on |

### Inter-dept Request Only
| Field | Type | Notes |
|-------|------|-------|
| Responsible Department | Select | The dept that does the work (e.g. Marketing for business cards) |

> Note: Submitter's own department is automatically tagged as the Dependent Department by the cron processor.

---

## 4. Routing Workflows

### 4A — Club Initiative

```
1. Submitted → Status: "Draft"
       ↓ (cron picks up)
2. Status: "Awaiting Strategy Review"
   → Email to Strategy Head: "New idea pending your review" + Notion link
       ↓ (Strategy Head edits idea, adds notes, sets Status in Notion)
3a. Status: "Strategy Rejected"
   → Email to submitter: rejection + Strategy Notes as reason
   
3b. Status: "Strategy Approved"
   → Cron creates one Department Response row per dept in Departments Needed
   → Status: "Routing"
   → Email to each dept lead: "New assignment in your Notion inbox" + Notion inbox link
       ↓
4a. Dept lead sets Dept Response Status → "Accepted"
   → Cron creates Leantime ticket for that dept
   → When ALL depts have accepted → Idea Status: "Fully Acknowledged"

4b. Dept lead sets Dept Response Status → "Declined"
   → Must fill Decline Reason field (validated by cron — reminder sent if empty)
   → Idea Status: "Returned to Strategy"
   → Email to Strategy Head: "Department declined — [dept] feedback attached"
       ↓
5. Strategy Head re-reviews (back to step 3)
```

**Reminder rules:**
- Strategy hasn't acted after 48h → reminder email to Strategy Head
- Dept lead hasn't responded after 48h → reminder email to dept lead
- Every reminder → submitter gets "your idea is still pending at [stage]" update
- Reminder count tracked; escalation logic can be added later

---

### 4B — Inter-dept Request

```
1. Submitted → Status: "Draft"
       ↓ (cron picks up — NO strategy approval gate)
2. Status: "Routing"
   → SIMULTANEOUSLY:
     → FYI email to Strategy Head: "New inter-dept request submitted" + Notion link
       (Strategy can leave notes at any time, no action required — ever)
     → Email to Responsible Dept lead: "New request assigned to your dept" + Notion inbox link
       ↓
3a. Responsible Dept lead sets Status → "Accepted"
   → Cron creates Leantime ticket — BOTH depts tagged (responsible + dependent/submitter's dept)
   → Idea Status: "Fully Acknowledged"

3b. Responsible Dept lead sets Status → "Declined" or "Pushed Back"
   → Must fill Decline Reason + Dept Notes fields
   → FYI email to Strategy Head: "Inter-dept request had pushback" + notes
   → Email to BOTH submitter AND submitter's dept head:
     "Your request was pushed back — [dept] notes: [reason]. Please review and accept or revise."
       ↓
4. EITHER submitter OR their dept head sets Status → "Accepted" (first to act is enough)
   → Cron creates Leantime ticket with revised terms
   → Idea Status: "Fully Acknowledged"
```

**Reminder rules:**
- Responsible dept hasn't responded after 48h → reminder
- Submitter/dept head haven't responded after 48h post-pushback → reminder
- Submitter gets "your request is still pending at [dept]" on every reminder cycle

---

## 5. Notion Database Schema

### Database 1: Ideas

**Property name → Notion type → allowed values**

| Property | Type | Values / Notes |
|----------|------|----------------|
| `Name` | Title | Idea title |
| `Submitter Name` | Text | — |
| `Submitter Email` | Email | — |
| `Submitter Department` | Select | Strategy, Operations, Marketing, Sales, Administration and Finance, IT |
| `Submission Type` | Select | Club Initiative, Inter-dept Request |
| `Category` | Select | Event, Campaign, Internal Process, Partnership, Tool Request, Design Request, Content Request, Logistics Request, Data/IT Request, Finance Request, Other |
| `Description` | Text | — |
| `Goal` | Text | — |
| `Success Criteria` | Text | — |
| `Departments Needed` | Multi-select | Strategy, Operations, Marketing, Sales, Administration and Finance, IT |
| `Responsible Department` | Select | Same options as Departments Needed |
| `Proposed Timeline` | Date | — |
| `Priority` | Select | Low, Medium, High, Critical |
| `Inspiration References` | Text | Optional |
| `Proposed Owner` | Text | Optional |
| `Risks Concerns` | Text | Optional |
| `Dependencies` | Text | Optional |
| `Status` | Select | Draft, Awaiting Strategy Review, Strategy Approved, Strategy Rejected, Routing, Partially Acknowledged, Fully Acknowledged, Returned to Strategy, Completed |
| `Strategy Notes` | Text | Editable by Strategy Head only (by convention) |
| `Submitted At` | Date | Set by cron on first pick-up |
| `Last Processed At` | Date | Updated by cron each run — prevents double-processing |
| `Leantime Ticket IDs` | Text | Comma-separated, filled once tickets created |

**Views to create in Notion:**
- **Strategy Inbox**: filter `Status = "Awaiting Strategy Review" OR "Returned to Strategy"` — sorted by Submitted At ascending
- **All Ideas** (Strategy Head): no filter, all properties visible
- **[Dept] Inbox** (one per dept): filter `Status = "Routing"`, Gallery view — each dept only sees their assigned items (via Department Responses database)

---

### Database 2: Department Responses

One row created per (idea × department) pair when an idea is routed.

| Property | Type | Values / Notes |
|----------|------|----------------|
| `Name` | Title | Auto-set: "[Idea Title] — [Dept Name]" |
| `Idea` | Relation | → Ideas database |
| `Department` | Select | Strategy, Operations, Marketing, Sales, Administration and Finance, IT |
| `Department Lead Email` | Email | Copied from config at row creation |
| `Status` | Select | **Pending**, Accepted, Declined, Pushed Back |
| `Decline Reason` | Text | Required when Status = Declined or Pushed Back |
| `Dept Notes` | Text | Additional feedback, comments, revised terms |
| `Response Date` | Date | Set by cron when status change detected |
| `Processed At` | Date | Set by cron after processing the response — prevents double-processing |
| `Leantime Ticket ID` | Text | Set once ticket created |
| `Reminder Count` | Number | Incremented each reminder sent |
| `Last Reminder At` | Date | Timestamp of last reminder |

**Views to create in Notion (one per dept):**
- **[Dept] Inbox**: filter `Department = "[dept]" AND Status = "Pending"`, Gallery view
- This is the "swipe through" view the user described
- Each dept's page is bookmarked/linked from their team's Notion space

---

## 6. Vercel API Routes

### POST /api/cron
Protected by `Authorization: Bearer {CRON_SECRET}` header.
Main processing loop — called every 5 minutes by GitHub Actions.

**Processing order (each run):**
1. Fetch Ideas where `Status = "Draft"` → transition to `"Awaiting Strategy Review"` + send Strategy email
2. Fetch Ideas where `Status = "Awaiting Strategy Review"` and `Last Processed At` < strategy's edit timestamp → check for strategy decision (Status change to Approved/Rejected)
3. Fetch Ideas where `Status = "Strategy Approved"` → create Dept Response rows + send routing emails
4. Fetch Dept Responses where `Status != "Pending" AND Processed At is empty` → process each response
5. Fetch stale items for reminder logic

### GET /api/health
Returns `{ status: "ok", timestamp }` — used by GitHub Actions to verify the app is up.

---

## 7. Email Templates

All emails sent via Resend. Sender: configured `FROM_EMAIL` (e.g. `workflow@teg-ev.de`).

| # | Trigger | Recipient | Subject |
|---|---------|-----------|---------|
| 1 | New submission picked up | Strategy Head | "New idea pending your review: [title]" |
| 2 | Strategy approved (Club Initiative) | Each dept lead | "New assignment for [dept]: [title]" |
| 3 | Strategy approved (Inter-dept) | Responsible dept lead | "New request assigned to [dept]: [title]" |
| 4 | Strategy approved (Inter-dept) | Strategy Head | "FYI: Inter-dept request in progress: [title]" |
| 5 | Strategy rejected | Submitter | "Update on your idea: [title]" |
| 6 | Dept declined (Club Initiative) | Strategy Head | "[dept] declined assignment — review needed: [title]" |
| 7 | Dept pushed back (Inter-dept) | Strategy Head | "FYI: [dept] pushed back on request: [title]" |
| 8 | Dept pushed back (Inter-dept) | Submitter + submitter's dept head | "Your request needs your attention: [title]" |
| 9 | Reminder (any pending action) | Whoever is blocking | "Reminder: action required on [title]" |
| 10 | Reminder cycle | Submitter | "Your idea is still in progress: [title]" |

Every email contains:
- Summary of the idea (title, type, description excerpt)
- Current status
- Direct link to the relevant Notion page
- Strategy Notes (if any)
- Clear next action instruction

---

## 8. Leantime Integration

**API endpoint:** `https://tegtime.myteg-ev.de/api/jsonrpc/`
**Method:** `leantime.rpc.Tickets.addTicket`

**Ticket created for Path A (Club Initiative):**
- One ticket per department that accepted
- Project: the dept's configured Leantime project ID
- Title: `[TEG] [Idea Title]`
- Description: full idea details + Strategy Notes + link to Notion idea page
- Due date: Proposed Timeline from idea

**Ticket created for Path B (Inter-dept Request):**
- One ticket in the Responsible Department's Leantime project
- Description includes: request details + "Requested by: [submitter dept]" + submitter name + Notion link
- Tags/labels: both responsible and dependent dept names

**On ticket creation:** cron writes the ticket ID back to the Notion row (`Leantime Ticket ID` field).

---

## 9. Department Configuration

Managed entirely in `config/departments.ts`. No code changes needed to add/remove departments.

```typescript
export interface Department {
  id: string;               // kebab-case, used in internal logic
  name: string;             // display name, must match Notion select values exactly
  teamLeadName: string;
  teamLeadEmail: string;
  leantimeProjectId: string; // numeric string, from Leantime project URL
}

export interface AppConfig {
  strategyHead: {
    name: string;
    email: string;
  };
  departments: Department[];
  reminders: {
    strategyReviewHours: number;   // default: 48
    deptResponseHours: number;     // default: 48
    submitterUpdateHours: number;  // default: 72
  };
}
```

---

## 10. GitHub Actions Cron

File: `.github/workflows/cron.yml`

Runs every 5 minutes. Calls POST /api/cron with `Authorization: Bearer $CRON_SECRET`.
On non-200 response, logs the error (GitHub Actions UI shows failures).

```yaml
on:
  schedule:
    - cron: '*/5 * * * *'
```

---

## 11. Environment Variables

See `.env.example` for full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `NOTION_API_KEY` | Notion integration secret |
| `NOTION_IDEAS_DB_ID` | Ideas database ID from Notion URL |
| `NOTION_DEPT_RESPONSES_DB_ID` | Department Responses database ID |
| `CRON_SECRET` | Random secret shared between GitHub Actions and Vercel |
| `RESEND_API_KEY` | From resend.com dashboard |
| `FROM_EMAIL` | Sender address (must be verified in Resend) |
| `LEANTIME_URL` | `https://tegtime.myteg-ev.de` |
| `LEANTIME_API_KEY` | From Leantime admin settings |
| `APP_URL` | Your Vercel deployment URL |

---

## 12. Project File Structure

```
teg-idea_workflow/
├── CLAUDE.md                          # AI coding rules (this project)
├── .env.example                       # All required env vars with descriptions
├── package.json
├── tsconfig.json
├── next.config.ts
├── config/
│   └── departments.ts                 # All dept config — edit here to add/remove depts
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── cron/
│   │       │   └── route.ts           # POST /api/cron
│   │       └── health/
│   │           └── route.ts           # GET /api/health
│   ├── lib/
│   │   ├── env.ts                     # Zod env validation — crashes on startup if vars missing
│   │   ├── notion.ts                  # Notion API client + all DB read/write functions
│   │   ├── leantime.ts                # Leantime JSON-RPC client
│   │   └── email.ts                   # Resend client + all email template functions
│   ├── core/
│   │   ├── processor.ts               # Main cron state machine
│   │   ├── router.ts                  # Path A vs Path B routing logic
│   │   └── reminders.ts               # Reminder scheduling logic
│   └── types/
│       └── index.ts                   # All shared TypeScript interfaces
├── docs/
│   ├── superpowers/specs/
│   │   └── 2026-06-01-teg-idea-workflow-design.md  # This file
│   ├── implementation-plan.md
│   └── notion-setup.md
└── .github/
    └── workflows/
        └── cron.yml                   # GitHub Actions 5-min cron trigger
```
