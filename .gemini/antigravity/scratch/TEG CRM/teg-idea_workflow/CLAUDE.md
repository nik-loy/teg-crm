# TEG Idea Workflow — Project Rules

## What This Is
A workflow automation backend for TEG e.V. student club. It polls Notion every 5 minutes, processes idea submission state changes, sends email notifications via Resend, and creates tickets in Leantime. There is NO user-facing frontend — Notion is the only UI anyone touches.

## Full Design Spec
Read this before writing any code:
`docs/superpowers/specs/2026-06-01-teg-idea-workflow-design.md`

## Notion Setup Guide
The Notion databases must be created manually before the app works:
`docs/notion-setup.md`

## Tech Stack
- **Framework**: Next.js 14, App Router, TypeScript strict mode
- **Hosting**: Vercel Hobby (free) — API routes only, no pages needed
- **Scheduler**: GitHub Actions cron (`.github/workflows/cron.yml`) — calls POST /api/cron every 5 min
- **Notion**: `@notionhq/client` — all state lives here
- **Email**: Resend (`resend` package) — 3k free emails/month
- **Leantime**: JSON-RPC over HTTPS — `https://tegtime.myteg-ev.de/api/jsonrpc/`
- **Validation**: `zod` for env vars and all external data

## Hard Constraints
- NEVER introduce a paid service or dependency
- NEVER build frontend pages — this app serves API routes only
- NEVER store state outside Notion — no database, no Redis, no files
- Polling interval is 5 minutes — do not add real-time or webhook logic
- Department configuration lives ONLY in `config/departments.ts` — never hardcode dept names in logic

## Project Structure
```
config/departments.ts    ← ONLY place to add/remove departments
src/lib/env.ts           ← Zod validation, crashes at startup if any env var missing
src/lib/notion.ts        ← ALL Notion API calls go here, nowhere else
src/lib/leantime.ts      ← ALL Leantime API calls go here
src/lib/email.ts         ← ALL email sends go here
src/core/processor.ts    ← Main state machine (called by /api/cron)
src/core/router.ts       ← Path A (Club Initiative) vs Path B (Inter-dept Request) logic
src/core/reminders.ts    ← Reminder scheduling logic
src/types/index.ts       ← Shared TypeScript interfaces
```

## Coding Rules
- TypeScript strict mode, no `any`
- All functions that call external APIs must return typed results
- Validate every value that comes from Notion before using it
- Log every cron processing step: `console.log('[cron] processing idea:', ideaId)`
- Never swallow errors silently — log and re-throw
- Keep files under 300 lines — split by responsibility if growing

## State Machine
Ideas move through these statuses in Notion (set by either the cron or a human):

**Set by humans in Notion:**
- `Strategy Approved` — Strategy Head approves
- `Strategy Rejected` — Strategy Head rejects (must have Strategy Notes)
- `Accepted` / `Declined` / `Pushed Back` — on Department Response rows

**Set by cron:**
- `Awaiting Strategy Review` — after picking up a Draft
- `Routing` — after strategy approves, dept response rows created
- `Returned to Strategy` — after a dept declines a Club Initiative
- `Fully Acknowledged` — all depts have accepted, all tickets created

## Two Routing Paths
**Path A (Club Initiative):** Submission → Strategy approval gate → Dept routing → Leantime tickets
**Path B (Inter-dept Request):** Submission → Simultaneous notify (Strategy FYI + responsible dept) → Dept acceptance → Leantime tickets

The `Submission Type` field on the idea determines which path. See design spec section 4 for full state transitions.

## /api/cron Processing Order
Each invocation processes in this exact order to avoid race conditions:
1. New drafts → transition to "Awaiting Strategy Review" + email Strategy
2. Strategy-decided ideas → route to departments
3. Dept response changes → create Leantime tickets or re-route
4. Reminder checks — stale items

## Notion Property Names
Property names in code MUST match Notion EXACTLY (case-sensitive). The canonical list is in the design spec section 5. If a Notion property is renamed, update `src/lib/notion.ts` — that is the only file with property name strings.

## Email System
9 email templates defined in `src/lib/email.ts`. Every email must include:
- Idea title and type
- Current status
- Direct link to the Notion page
- Strategy Notes (if set)
- Clear next action instruction for the recipient

## Leantime Tickets
- Title format: `[TEG] {ideaTitle}`
- Description: full idea details + Strategy Notes + Notion page URL
- Path B tickets: mention both responsible and dependent dept in description
- Write ticket ID back to the Notion row after creation

## Environment Variables
Copy `.env.example` to `.env.local` before running. All vars are required — the app crashes at startup if any are missing (see `src/lib/env.ts`).

## Testing
- Unit test `src/core/processor.ts` and `src/core/router.ts`
- Mock all external clients (Notion, Leantime, Resend) in tests
- Test each state transition with a representative fixture
- Run: `npm test`

## Build & Run
```bash
npm install
cp .env.example .env.local   # fill in all values
npm run dev                   # local dev
npm run build                 # verify build before deploying
npm test                      # run tests
```

## Deployment Checklist
1. Notion databases created and IDs copied to env vars (see docs/notion-setup.md)
2. Resend account created, domain/email verified, API key in env
3. Leantime API key obtained from tegtime.myteg-ev.de admin settings
4. All env vars set in Vercel dashboard
5. `CRON_SECRET` set in both Vercel env vars AND GitHub Actions secret `CRON_SECRET`
6. GitHub Actions workflow enabled
7. Deploy to Vercel: `vercel --prod`
8. Test: submit a test idea in Notion, wait 5 min, verify email received
