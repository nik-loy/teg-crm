# TEG Idea Workflow — Implementation Plan

## Before You Start
1. Read the full design spec: `docs/superpowers/specs/2026-06-01-teg-idea-workflow-design.md`
2. Set up Notion databases manually: `docs/notion-setup.md`
3. Create accounts: Resend (resend.com), Vercel, ensure GitHub repo exists
4. Copy `.env.example` to `.env.local` and fill in all values

---

## Phase 1 — Project Scaffold
**Goal:** Working Next.js project with correct folder structure and dependencies

Tasks:
- [ ] `npx create-next-app@latest . --typescript --app --no-src-dir --no-tailwind --no-eslint` in the project root (adjust flags as needed, we DO want src/ dir)
- [ ] Install dependencies: `npm install @notionhq/client resend zod`
- [ ] Install dev dependencies: `npm install -D @types/node jest ts-jest @types/jest`
- [ ] Delete default Next.js pages/app content (we only need API routes)
- [ ] Create folder structure: `config/`, `src/lib/`, `src/core/`, `src/types/`, `.github/workflows/`
- [ ] Verify `npm run build` succeeds on empty project

**Output:** Clean Next.js project that builds

---

## Phase 2 — Types and Configuration
**Goal:** All TypeScript interfaces defined, department config in place

Tasks:
- [ ] Create `src/types/index.ts` with interfaces:
  - `IdeaStatus` (union type of all status strings)
  - `DeptResponseStatus` (union type)
  - `SubmissionType` ("Club Initiative" | "Inter-dept Request")
  - `Idea` (all Notion properties typed)
  - `DeptResponse` (all Notion properties typed)
  - `Department` (id, name, teamLeadName, teamLeadEmail, leantimeProjectId)
  - `AppConfig` (strategyHead, departments[], reminders config)
  - `ProcessingResult` (what the cron returns after each run)
- [ ] Create `config/departments.ts` with all 6 departments + strategy head + reminder defaults:
  - Strategy (mark as `isStrategy: true`)
  - Operations
  - Marketing
  - Sales
  - Administration and Finance
  - IT
  - `strategyHead: { name, email }` (fill with real values)
  - `reminders: { strategyReviewHours: 48, deptResponseHours: 48, submitterUpdateHours: 72 }`
- [ ] Create `src/lib/env.ts` with Zod schema validating ALL env vars from `.env.example`. Must throw on startup if any missing.

**Output:** All types defined, config populated, env validation in place

---

## Phase 3 — Notion Client
**Goal:** Full typed wrapper around the Notion API

Tasks:
- [ ] Create `src/lib/notion.ts` with a `NotionClient` class or module
- [ ] Implement read functions:
  - `getDraftIdeas()` → Ideas where Status = "Draft"
  - `getIdeasAwaitingStrategyReview()` → Status = "Awaiting Strategy Review"
  - `getStrategyApprovedIdeas()` → Status = "Strategy Approved" AND Last Processed At is empty
  - `getStrategyRejectedIdeas()` → Status = "Strategy Rejected" AND Last Processed At is empty
  - `getUnprocessedDeptResponses()` → Status != "Pending" AND Processed At is empty
  - `getStaleDeptResponses(hours: number)` → Status = "Pending" AND Last Reminder At older than N hours
  - `getStaleStrategyReviews(hours: number)` → Status = "Awaiting Strategy Review" AND Submitted At older than N hours
- [ ] Implement write functions:
  - `updateIdeaStatus(ideaId, status, extraProps?)`
  - `setIdeaLastProcessed(ideaId)`
  - `setIdeaSubmittedAt(ideaId, date)`
  - `createDeptResponseRow(ideaId, deptName, deptLeadEmail)` → creates one row
  - `updateDeptResponseStatus(responseId, status, processedAt)`
  - `setDeptResponseLeantime(responseId, ticketId)`
  - `setDeptResponseReminder(responseId, count, lastAt)`
  - `setIdeaLeantimeIds(ideaId, ticketIds: string[])`
- [ ] All Notion property names as constants at the top of the file (single source of truth)
- [ ] Parse Notion API response types into clean internal types

**Output:** Full Notion client with typed read/write operations

---

## Phase 4 — Email System
**Goal:** All 10 email templates implemented and sendable

Tasks:
- [ ] Create `src/lib/email.ts` with Resend client
- [ ] Implement one function per email template (see design spec section 7):
  1. `sendNewSubmissionToStrategy(idea, strategyHead)`
  2. `sendDeptRoutingEmail(idea, dept)` — Club Initiative path
  3. `sendInterdeptRequestToDept(idea, responsibleDept)` — Path B
  4. `sendInterdeptFYIToStrategy(idea, strategyHead)` — Path B simultaneous FYI
  5. `sendRejectionToSubmitter(idea)` — includes Strategy Notes
  6. `sendDeptDeclinedToStrategy(idea, deptResponse, strategyHead)` — Path A
  7. `sendInterdeptPushbackFYIToStrategy(idea, deptResponse, strategyHead)` — Path B FYI
  8. `sendInterdeptPushbackToSubmitter(idea, deptResponse, submitter, deptHead)` — Path B to submitter/dept head
  9. `sendReminderToApprover(idea, recipientEmail, recipientName, stuckAt)`
  10. `sendSubmitterProgressUpdate(idea)` — "still in progress"
- [ ] Each email: plain HTML template with idea title, status, description excerpt, Notion link, Strategy Notes (if set), clear next action
- [ ] All emails include subject lines from design spec section 7

**Output:** All email templates implemented and testable

---

## Phase 5 — Leantime Client
**Goal:** Can create tickets in Leantime via JSON-RPC

Tasks:
- [ ] Create `src/lib/leantime.ts` with `createTicket(params)` function
- [ ] JSON-RPC call to `https://tegtime.myteg-ev.de/api/jsonrpc/`
- [ ] Method: `leantime.rpc.Tickets.addTicket`
- [ ] Params: `projectId`, `headline`, `description`, `type` (default: "task"), `status`, `dateToFinish`
- [ ] Implement `createClubInitiativeTicket(idea, dept)` → returns Leantime ticket ID
- [ ] Implement `createInterdeptTicket(idea, responsibleDept, dependentDept)` → returns ticket ID
  - Description includes "Requested by: [dependentDept]" + submitter name + Notion link
- [ ] Handle API errors gracefully — log and return null (don't crash the cron run)
- [ ] Verify the Leantime API by checking the admin panel at tegtime.myteg-ev.de for the correct method signature (it may differ slightly by version)

**Output:** Leantime ticket creation working against real instance

---

## Phase 6 — Core Processor (State Machine)
**Goal:** Full cron processing logic implemented

Tasks:
- [ ] Create `src/core/router.ts`:
  - `isClubInitiative(idea)` → boolean
  - `isInterdeptRequest(idea)` → boolean
  - `getDeptLeadEmail(deptName)` → looks up from config
  - `getSubmitterDeptHead(submitterDept)` → returns dept lead email for submitter's dept

- [ ] Create `src/core/reminders.ts`:
  - `checkStrategyReminders(staleIdeas, config)` → sends reminders to Strategy Head
  - `checkDeptReminders(staleDeptResponses, config)` → sends reminders to dept leads + submitter progress updates

- [ ] Create `src/core/processor.ts` — main state machine, called by /api/cron:

  ```
  processNewDrafts()
    → for each Draft idea:
       setIdeaSubmittedAt, updateIdeaStatus("Awaiting Strategy Review")
       sendNewSubmissionToStrategy()
       setIdeaLastProcessed()

  processStrategyDecisions()
    → for each Strategy Approved idea (Last Processed At empty):
       if Club Initiative: createDeptResponseRows for each dept in Departments Needed
                           updateIdeaStatus("Routing"), sendDeptRoutingEmail to each dept
       if Inter-dept Request: createDeptResponseRow for Responsible Dept
                              updateIdeaStatus("Routing")
                              sendInterdeptRequestToDept() + sendInterdeptFYIToStrategy() simultaneously
       setIdeaLastProcessed()
    → for each Strategy Rejected idea (Last Processed At empty):
       sendRejectionToSubmitter()
       setIdeaLastProcessed()

  processDeptResponses()
    → for each unprocessed Dept Response (Status != Pending, Processed At empty):
       if Accepted:
         createLeantime ticket
         setDeptResponseLeantime(ticketId)
         check if ALL responses for this idea are Accepted → if yes updateIdeaStatus("Fully Acknowledged")
         else updateIdeaStatus("Partially Acknowledged")
       if Declined/Pushed Back:
         validate Decline Reason is not empty (if empty: send reminder, skip)
         if Club Initiative: updateIdeaStatus("Returned to Strategy"), sendDeptDeclinedToStrategy()
         if Inter-dept Request: sendInterdeptPushbackFYIToStrategy(), sendInterdeptPushbackToSubmitter()
       updateDeptResponseStatus(processedAt = now)

  processReminders()
    → checkStrategyReminders()
    → checkDeptReminders()
  ```

**Output:** Full state machine that correctly handles all transitions from design spec

---

## Phase 7 — API Routes
**Goal:** /api/cron endpoint wired up and protected

Tasks:
- [ ] Create `src/app/api/cron/route.ts`:
  - Validate `Authorization: Bearer {CRON_SECRET}` header → 401 if missing/wrong
  - Call processor in order: processNewDrafts, processStrategyDecisions, processDeptResponses, processReminders
  - Log start/end timestamps and counts
  - Return `{ processed: { drafts, decisions, responses, reminders }, duration_ms }`
  - Never throw — catch all errors, log, return 500 with error message
- [ ] Create `src/app/api/health/route.ts`:
  - Returns `{ status: "ok", timestamp: new Date().toISOString() }`

**Output:** Working API endpoints, cron protected and functional

---

## Phase 8 — GitHub Actions Cron
**Goal:** Automated 5-minute trigger deployed and running

Tasks:
- [ ] Create `.github/workflows/cron.yml`:
  ```yaml
  name: Idea Workflow Cron
  on:
    schedule:
      - cron: '*/5 * * * *'
    workflow_dispatch:  # allows manual trigger for testing
  jobs:
    trigger:
      runs-on: ubuntu-latest
      steps:
        - name: Trigger cron
          run: |
            response=$(curl -s -o /dev/null -w "%{http_code}" \
              -X POST "${{ secrets.APP_URL }}/api/cron" \
              -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}")
            echo "Response: $response"
            if [ "$response" != "200" ]; then exit 1; fi
  ```
- [ ] Add GitHub Actions secrets: `APP_URL`, `CRON_SECRET`
- [ ] Test via `workflow_dispatch` before relying on schedule

**Output:** Automated 5-minute cron running in GitHub Actions

---

## Phase 9 — Tests
**Goal:** Core logic is unit tested

Tasks:
- [ ] Configure Jest with ts-jest
- [ ] Mock `src/lib/notion.ts`, `src/lib/email.ts`, `src/lib/leantime.ts`
- [ ] Test `src/core/router.ts`: all routing decisions
- [ ] Test `src/core/processor.ts`:
  - Draft → Awaiting Strategy Review transition
  - Club Initiative: approved → Routing, dept accepted → Leantime ticket
  - Club Initiative: dept declined → Returned to Strategy
  - Inter-dept: approved → simultaneous FYI + dept routing
  - Inter-dept: dept pushed back → submitter notified, either accepts → ticket
  - Reminder logic: 48h stale → reminder sent, reminder count incremented

**Output:** Passing test suite covering all state transitions

---

## Phase 10 — Deployment
**Goal:** Live on Vercel, cron running, tested end-to-end

Tasks:
- [ ] Run `npm run build` — fix any TypeScript errors
- [ ] Deploy to Vercel: `npx vercel --prod` (or via GitHub integration)
- [ ] Set ALL env vars in Vercel dashboard (from `.env.example`)
- [ ] Verify `/api/health` returns 200
- [ ] Trigger cron manually via GitHub Actions `workflow_dispatch`
- [ ] Verify cron run logs appear in Vercel function logs
- [ ] Submit a test idea via Notion form
- [ ] Wait up to 5 minutes — verify Strategy Head receives email
- [ ] Change status to "Strategy Approved" in Notion
- [ ] Wait up to 5 minutes — verify dept lead email received, Dept Response row created
- [ ] Change Dept Response status to "Accepted" in Notion
- [ ] Wait up to 5 minutes — verify Leantime ticket created and ticket ID written back to Notion

**Output:** Fully working system, end-to-end verified

---

## Dependency Order
```
Phase 1 → Phase 2 → Phase 3
                  → Phase 4
                  → Phase 5
Phase 3 + 4 + 5 → Phase 6 → Phase 7 → Phase 8
Phase 6 → Phase 9
Phase 7 + 8 → Phase 10
```

Phases 3, 4, 5 can be built in parallel once Phase 2 is done.
