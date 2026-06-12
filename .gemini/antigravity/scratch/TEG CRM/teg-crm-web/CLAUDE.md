# TEG CRM Web App — Claude Code Project Instructions

## What this is

The **interactive front door** to the TEG CRM: a team-wide, install-free web app that replaces the long terminal commands (`contact_logger.py`, `message_gen.py`) for the daily LinkedIn sales workflow — logging contacts, ingesting LinkedIn profiles, generating outreach messages, handling replies, batch-capturing screenshots, and viewing the pipeline.

**Read these before coding:**
- Design spec: `docs/superpowers/specs/2026-06-03-crm-web-app-design.md` (what & why — source of truth)
- Implementation plan: `docs/superpowers/plans/2026-06-03-crm-web-app.md` (how — task-by-task)

## Relationship to the Python repo (`../teg-crm`)

- **Notion is the single source of truth and the integration contract.** This app and the Python repo both read/write the same 7 Notion databases; neither calls the other.
- **The Python automation stays and is unchanged:** daily follow-up reminders + weekly report run on GitHub Actions. Do NOT reimplement them here.
- This app **supersedes only the interactive daily UI**. The Python `config/event.json` and `config/team.json` are the data contract — they are **copied into `config/` here** and must be kept in sync (the JSON is the contract, not the Python code).

## Stack

- Next.js 15 (App Router) · React · TypeScript
- Tailwind CSS + shadcn/ui (Radix) · Lucide icons
- `@notionhq/client` · `openai` (gpt-4o-mini text, gpt-4o vision; Anthropic optional fallback)
- Vitest (unit) · Playwright (light e2e) · Vercel (free hosting)

## Locked product decisions (do not relitigate without the user)

1. **Home = "Today" action queue** (one-click to-dos). Pipeline board + Contacts table are other tabs.
2. **Add contact:** bookmarklet pre-fills URL+name; optional collapsed "paste profile" box auto-fills + is reused for messaging.
3. **Ingestion is authored-only:** the extraction engine MUST exclude reposts/shares (a real profile contained a reposted political meme — never feed that into a message). Never hallucinate missing fields. Use the top-of-profile headline as canonical.
4. **Messaging returns 3 editable variants** on different angles; user picks/edits/copies/logs.
5. **The app cannot send LinkedIn messages** (ban risk). It copies to clipboard + logs; the human sends.
6. **Enrichment is non-destructive:** only fill EMPTY Notion fields; never overwrite manual edits.
7. **Dedup:** LinkedIn URL = strong key, name = weak fallback; screenshot(name-only)+later URL ⇒ **merge**, never silent duplicate.
8. **Auth:** one shared team password; all secrets server-side.

## Conventions

- **TDD is mandatory for `src/lib/**`** (extraction, dedup/merge, Notion mapping, message parsing). Real fixtures live in `tests/fixtures/` (the two committed profile pastes). Write the failing test first.
- **All Notion/OpenAI calls run in server code only** (Route Handlers under `src/app/api/**` or Server Actions). The browser never sees a secret.
- Keep files focused and small (one responsibility). Follow the file structure in the plan.
- Notion rate limit is 3 req/s → always go through `withRetry` (exp backoff).
- Conventional commits; commit after each passing task.

## Commands

```bash
npm run dev          # local dev (localhost:3000)
npm test             # vitest run
npm run test:watch   # vitest watch
npm run build        # production build (run before deploy)
npm run lint
```

- ALWAYS run `npm test` after changing anything in `src/lib/**`.
- ALWAYS run `npm run build` before deploying.

## Security rules

- NEVER hardcode the Notion token, OpenAI key, app password, or AUTH_SECRET. They come from env (`.env.local` locally, Vercel env vars in prod).
- NEVER commit `.env.local` or any real secret. `.env.example` (no values) is the only env file committed.
- NEVER make any network call to LinkedIn. Ingestion is manual copy-paste / screenshots only (ban-safe by design).
- Validate/normalize the LinkedIn URL server-side.

## Notion schema (summary)

Uses the existing 7 databases (full schema in `../teg-crm/CLAUDE.md` and the design spec §9). The app primarily reads/writes the **Contacts** DB (incl. `LinkedIn Outreach Status` = Request Sent/Connected/Messaged, `Outreach Owner`) and creates **Interactions**. Recommended additive fields (optional, backward compatible): `Location`, `Request Sent Date`, `Profile Summary`, and extending `LinkedIn Outreach Status` with `No Response`/`Withdrawn` for phase-2 reject analytics.

## File organization

- `src/app/**` — routes (UI pages + `api/` route handlers)
- `src/lib/**` — domain logic (TDD): `notion/`, `extraction/`, `message/`, `config.ts`, `types.ts`
- `src/components/**` — shadcn/ui + app components
- `config/**` — copied `event.json` + `team.json` (the contract)
- `tests/**` — vitest + fixtures
- `public/bookmarklet.html` — the ＋TEG bookmarklet install page
- `docs/**` — spec, plan, team quickstart
