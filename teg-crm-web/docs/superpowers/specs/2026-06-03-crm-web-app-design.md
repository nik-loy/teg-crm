# TEG CRM Web App — Design Spec

**Date:** 2026-06-03
**Status:** Approved (brainstorm complete) — ready for implementation planning
**Author:** Niklas Loycke (with Claude)
**Supersedes:** the terminal-based interactive workflow (`contact_logger.py`, `message_gen.py` as the daily UI). It does **not** supersede the scheduled Python automation.

---

## 1. Why this exists

The existing TEG CRM is a well-built **batch + automation layer on Notion** (Python scripts + GitHub Actions). Its weak point is **interactive, single-contact daily work**, which today lives entirely in long terminal commands, e.g.:

```
python -m src.linkedin.contact_logger --url https://www.linkedin.com/in/anna-mueller-123 \
  --name "Anna Müller" --title "Senior Consultant" --status request_sent --owner "Niklas Loycke"
```

Three root problems were identified and validated during brainstorming:

1. **Interface friction** — long commands, unmemorable flags, fragile quoting. For a single contact, this is *slower and worse* than typing into Notion by hand. (Confirmed: the only CLI wins are dedup + auto-defaults, which don't outweigh the friction.)
2. **Context-switch friction** — the data lives in the browser (LinkedIn + Notion), but the entry point is the terminal. The tool is in the wrong place.
3. **Team-scaling problem** — everything is bound to one machine (`cd "C:\Users\nikla\..."`, one `.env`, one Python install). A 3–4 person non-technical sales team cannot each run Python scripts.

A doc/code drift was also found: `docs/team_guide.md` promises an interactive `contact_logger` that prompts for URL/name/company/title — **that mode does not exist** (`--url` is a required flag; only `--name` is ever prompted).

**Decision:** build a polished, install-free, team-wide **web app** as the single interactive front door to the CRM, while keeping the working scheduled automation in Python.

## 2. Goals / Non-goals

**Goals**
- Log a LinkedIn contact in ~5 seconds from the desktop, no terminal, deduplicated.
- Move the entire daily LinkedIn workflow (log → message → handle reply) off the terminal.
- Be usable by the whole sales team (Jonas, Abdul, Markus, Niklas) with zero install.
- One paste of a LinkedIn profile both **enriches the CRM record** and **drafts the outreach message**.
- Keep everything on free tiers. Keep Notion as the single source of truth.
- A delightful, fast, app-like UX (this is an explicit success criterion).

**Non-goals**
- Sending LinkedIn messages programmatically (ban risk — the app copies + logs; the human sends).
- Scraping LinkedIn (philosophy unchanged: manual copy-paste / screenshots only).
- Rebuilding the already-automated jobs (daily reminders, weekly report) — they stay in Python.
- Per-person SSO/auth in v1 (a shared team password is sufficient; upgradeable later).
- A native mobile app (desktop-first; phone is only used to *send* connection requests, logged later at the desk).

## 3. Locked decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| D1 | Stack | **Next.js (App Router) + React + TypeScript on Vercel** (free tier). Rebuild the interactive paths in TS; keep crown-jewel assets (system prompt, `event.json`, Notion schema) verbatim. |
| D2 | Home screen | **"Today" action queue** (one-click to-dos). Pipeline board + Contacts table are other tabs. |
| D3 | Add contact | **Bookmarklet pre-fills URL + name**; an **optional, collapsed "paste profile" box** auto-fills title/company and is reused for messaging. |
| D4 | Ingestion | One paste → structured fields (fills empty Notion fields, **non-destructive**) + personalization signals. **Only authored content** feeds the message — **reposts/shares are excluded.** |
| D5 | Messaging | AI returns **3 short variants on different angles**; user picks/edits, copies, one-click logs. |
| D6 | Send flow | App **cannot send** LinkedIn messages. It copies to clipboard + "Mark as messaged + log." |
| D7 | Auth | **One shared team password**, server-side secrets. |
| D8 | Identity / dedup | **LinkedIn URL = strong key; name = weak fallback.** Screenshot (name-only) + later URL ⇒ **merge prompt**, never silent duplicate. |
| D9 | Automation | Scheduled jobs (reminders, weekly report) **stay in Python/GitHub Actions**, unchanged. Screenshot processing **moves into the app** (on-demand, instant). |

## 4. Architecture

```
CAPTURE (team, mostly desktop)
  ＋ Bookmarklet   |   Paste full profile   |   Screenshot batch   |   CSV import
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│  THE WEB APP  —  Next.js / React / TS  on Vercel (free)       │
│  Screens: Today · Add · Messages(3 variants) · Screenshots ·  │
│           Contacts · Pipeline/Dashboard                       │
│  🔒 Login: one shared team password                           │
│  Secrets (server-side only): NOTION_TOKEN · OPENAI_API_KEY    │
│  Server (Route Handlers / Server Actions) call Notion+OpenAI  │
└──────────────────────────────────────────────────────────────┘
          │  reads / writes            ▲
          ▼                            │
┌──────────────────────────────────────────────────────────────┐
│  NOTION — single source of truth (7 databases)               │
└──────────────────────────────────────────────────────────────┘
          ▲                            ▲
          │ (unchanged)                │
┌───────────────────────────┐   ┌───────────────────────────────┐
│ Python + GitHub Actions   │   │ OpenAI                        │
│ daily reminders, weekly   │   │ gpt-4o-mini: extract + msg    │
│ report → Resend email     │   │ gpt-4o: screenshot vision     │
└───────────────────────────┘   └───────────────────────────────┘
```

**Key principle — Notion is the integration contract.** Because the new TS app and the existing Python both read/write the same Notion databases, neither needs to know the other exists. This lets us add a polished front door without touching working automation.

**Why secrets force a backend:** the Notion token is a secret and can never live in client JS (or a bookmarklet). All Notion/OpenAI calls run in Next.js server code (Route Handlers / Server Actions). The browser only talks to our own server.

## 5. Tech stack

- **Framework:** Next.js (App Router), React, TypeScript.
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives). Lucide icons. Aim for a calm, fast, Linear/Superhuman-grade feel.
- **Notion:** `@notionhq/client` (official JS SDK).
- **LLM:** `openai` SDK (gpt-4o-mini for text, gpt-4o for vision). Anthropic optional fallback (`@anthropic-ai/sdk`) mirroring the Python fallback.
- **Charts (dashboard):** Recharts (or keep it simple with the existing Chart.js approach embedded).
- **Hosting:** Vercel Hobby (free). No keep-warm needed (serverless is warm enough; the slow Vision job is the only long call and is user-initiated).
- **Auth:** lightweight — a login route checks `APP_PASSWORD`, sets a signed httpOnly cookie; Next.js middleware guards all routes. (Vercel's built-in password protection is paid, so we DIY.)

## 6. Screens & UX

### 6.1 Today (home)
Personal, action-first list answering "what do I do right now?" Sections, each row a one-click action:
- **Connected, no message yet** → `Write ▸`
- **Stale requests** (sent > N days, still pending) → `Nudge ▸` / `Withdraw`
- **Replies to handle** → `Reply ▸`
- **Follow-ups due today** (from Notion `Follow-Up Due Date` + owner) → `Do ▸`

Scoped to the logged-in person by default, with a "whole team" toggle. Data comes from the Contacts DB (status, dates, owner) — same fields the Python `follow_up_bot` and `outreach_queue` already use.

### 6.2 Add contact (+ bookmarklet)
- Bookmarklet (kept in the bookmarks bar) reads `window.location.href` (100% reliable) and the profile name from `document.title` (LinkedIn title format: `(N) Name | LinkedIn` — reliable, always editable). Opens `/<app>/add?url=...&name=...` in a new tab.
- Form: URL + Name (pre-filled), Job title, Company, Tier (default Tier 3), Status segmented control (Request sent / Connected), Owner (defaults to logged-in user). Optional collapsed **"Paste profile"** box (D3/D4).
- On save: dedupe by URL (strong key), create/merge in Contacts with defaults (`Pipeline Stage: Awareness`, `Source: LinkedIn`, `Last Contact Date: today`). Instant feedback + link to Notion page.

### 6.3 Messages (3 variants)
- Entered from Today (`Write ▸`) or a contact page. Shows contact header + status.
- If a profile is "on file" (pasted at add time) it's reused; otherwise prompt to paste.
- AI returns: **Fit-Rating (1–5 + reason)**, **Seniority check** (warn for Partner/Director/VP/C-level + per-company `risk_tiers`), **Template (Intern/Extern)**, **Anrede (Du/Sie)**, and **3 message variants** on different angles (e.g. authored-posts / role / event-format).
- Each variant: **editable**, **live character count** (target 350–450, max 500), pre-flight checklist (Fit ✓, Seniority ✓, Blacklist clear, Length ✓, UTM link).
- Below Fit 3 ⇒ do not offer logging (mirror current behavior).
- Actions: **Copy** (clipboard) → user pastes in LinkedIn → **Mark as messaged + log** (creates Interaction, sets `Last Contact Date`, status → Messaged). Regenerate / Discard.
- Invite link uses the owner's UTM tag (from `team.json` mapping) and `event.json` `luma_url`.

### 6.4 Follow-up (reply handling)
- From a contact who replied: paste/enter their reply → AI drafts a short (1–3 sentence) warm, non-pushy response in the right Du/Sie register, using `event.json` `followup_examples`.
- On confirm: log Interaction, update `Last Contact Date`; if reply is positive, offer **Pipeline Stage → Engaged**.

### 6.5 Screenshots (batch capture)
- Drag/drop one or more "Sent Invitations" screenshots → gpt-4o Vision extracts `[{name, job_title, company}]` → **preview table** for review/edit → confirm → create contacts (`Status: Request Sent`, no URL, note "URL not yet captured", dedupe by name).
- Replaces the 15-min Notion-inbox cron with instant, in-app processing (the Python `screenshot_processor` / Screenshot Inbox DB may remain as an optional fallback or be retired).
- Sets up the **reject-analytics** path (§8).

### 6.6 Contacts (table) & Pipeline (board)
- **Contacts:** filterable/sortable table over the Contacts DB; click → side panel with details + "Write message". Inline edit of key fields (writes back to Notion).
- **Pipeline:** 5-stage kanban (Awareness → First Attendance → Engaged → Deepening → Activated). Drag a card = update `Pipeline Stage` in Notion (with confirm, since the current system never moves stage without approval).
- **Dashboard:** live charts (by stage / tier / source / month) — the live version of the existing static dashboard.

## 7. Ingestion & extraction engine (the crown jewel)

One LLM call (gpt-4o-mini) turns a messy pasted profile into:

**(a) Structured fields** → mapped to Notion (only fills **empty** fields; never overwrites manual edits):
`name, headline (canonical = top profile headline), current_title, current_company, location, industry (inferred), education[], experience[] (role/company/dates), skills[], seniority_estimate`.

**(b) Personalization signals** for messaging → extracted **only from content the person authored.**

### 7.1 Hard rules proven by real examples (Jonas Böhrer, Maximilian Wiese)
- 🚨 **Authored vs reposted.** A profile feed contains the person's posts **and** reposts/shares of others' content. Max's feed included a **political meme about Markus Söder/CSU he merely reposted** — folding that into a message could badly offend a prospect. **The extractor MUST label each post authored vs reposted and use only authored content for personalization.** (Detect via "reposted this" / "View company:" / a different author byline.)
- **Deduplicate posts.** LinkedIn shows each post twice (Featured + Activity). Collapse duplicates.
- **Never hallucinate missing data.** Max has *no* About section ⇒ leave `about` empty. Same for any absent field.
- **Headline drift.** The top-of-profile headline (e.g. "Sales Representative @TEG") can differ from a post byline ("Sales Manager @TEG"). **Use the top profile headline as canonical.**
- **Multiple current roles.** Jonas is "Founders Associate @ triply" *and* "Sales Manager @ TEG" simultaneously. Keep all `current` roles; treat the first in the headline as primary company.
- **Strip noise:** `· 1st`, `Message`, `More`, `Connect`, `Follow`, `Endorse`, `Show translation`, `… more`, `View image`, `1/3`, reaction/comment/repost counts, `N followers`, `N connections`, mutual-connection lines, hashtags, emojis.
- **German + English mixed** is normal; preserve original language in signals.

### 7.2 Output contract (extraction)
Return strict JSON:
```json
{
  "name": "", "headline": "", "current_title": "", "current_company": "",
  "location": "", "industry": "", "seniority_estimate": "",
  "education": [{"school": "", "degree": "", "years": ""}],
  "experience": [{"title": "", "company": "", "dates": "", "current": true}],
  "skills": [],
  "authored_posts": [{"summary": "", "topics": []}],
  "personalization_signals": [],
  "about": "",
  "excluded_reposts_count": 0
}
```
The message step consumes `personalization_signals` + `authored_posts` + role/company; it never sees reposts. (Extraction and message generation may be one call or two; two is cleaner — extract once, then generate. Cost is fractions of a cent either way.)

### 7.3 Worked example (target: Maximilian Wiese)
- Fields: Cloud Sales Consultant @ CLOUDPILOTS, Munich, Industry = Tech/Cloud/Consulting (inferred), MBA, ~15 yrs exp.
- Signals (authored only): Gemini Enterprise, Agentic AI, GenAI in real workflows, AI + Customer Experience, Cloud transformation.
- Excluded: 3 reposts (incl. the political meme), duplicate posts, all nav/count noise; no About → blank.
- Result fit **4/5**, **Sie**, no seniority warning, draft ~362/500 chars referencing his GenAI posts + naming McKinsey/BCG/IBM as credibility.

## 8. Reject analytics (phase 2)

LinkedIn never reports "X rejected you." A sent request stays **Pending** until accepted (becomes a connection) or it silently expires/withdraws (~2–3 weeks). "Rejection" is therefore **derived**, not stored.

Approach: periodic "Sent Invitations" screenshots build a time series. Reconciliation logic: *a name that was Pending last snapshot, is gone this snapshot, and is NOT now a connection ⇒ "No Response / did not accept."* Cross-reference connections via the LinkedIn Connections.csv import. Surface analytics ("which seniorities/companies ignore us"). This is a fast-follow once snapshots accumulate — not v1.

Suggested status lifecycle on the contact: `Request Sent → (Connected | No Response | Withdrawn) → Messaged → Engaged …`.

## 9. Notion data model & mapping

Uses the existing 7 databases unchanged as the baseline (see the Python repo's `CLAUDE.md` for full schema). The app reads/writes these **Contacts** fields: `Name, Email, Phone, LinkedIn URL, Company (relation), Job Title, Industry, Tier, Pipeline Stage, Source, Tags, Last Contact Date, Follow-Up Due Date, Follow-Up Owner, Follow-Up Complete, Notes, LinkedIn Outreach Status (Request Sent/Connected/Messaged), Outreach Owner`. Interactions are logged to the **Interactions** DB exactly as `message_gen.py` does today.

**Recommended additive (optional) fields** for richer UX — all backward compatible:
- `Location` (rich_text) — from extraction.
- `Request Sent Date` (date) — precise staleness vs. relying on Notion `created_time`.
- `Profile Summary` (rich_text) — store extracted signals / structured summary for reuse across sessions and team members.
- Extend `LinkedIn Outreach Status` options with `No Response`, `Withdrawn` (phase 2 analytics).

Reuse, do not duplicate: `config/event.json` (event + system-prompt data, incl. `risk_tiers`, `opening_lines`, `closing_lines`, `message_examples`, `followup_examples`, `personalization_keywords`), `config/team.json` (UTM + emails), and the blacklist. These should be readable by the web app (copy the JSON into the web app or read from a shared location; the JSON is the contract, not the Python code).

## 10. Auth & security
- Single shared password in `APP_PASSWORD`. Login route verifies it, sets a signed httpOnly, Secure, SameSite cookie; middleware guards every route + API.
- All secrets server-side (Vercel env vars). The bookmarklet contains **no secrets** — it only opens a URL with query params.
- No LinkedIn network calls of any kind (ban-safe by construction).
- Notion rate limit (3 req/s): central client with retry + exponential backoff (mirror `notion_helpers.with_retry`).
- Validate/normalize the LinkedIn URL server-side; reject obviously malformed input.

## 11. Error handling
- **Notion 429 / 5xx:** retry w/ backoff; surface a clear toast on final failure; never lose the user's typed input.
- **LLM failure / bad JSON:** show raw output + "retry"; for extraction, fall back to manual field entry (the form still works without AI).
- **Screenshot partial extraction:** always show the editable preview table; let the user fix/remove rows before creating.
- **Dedup/merge conflict:** if a URL already exists, or a name-only record matches an incoming URL, present a **merge** card (keep existing, fill blanks) rather than duplicating.
- **Auth expiry:** redirect to login, preserve intended destination.

## 12. Testing strategy
- **Extraction unit tests (highest value):** feed the two real pastes (Jonas, Max) as fixtures; assert authored-vs-reposted separation (the Söder meme is excluded), post dedup, missing-About handling, canonical headline, multi-current-role handling, noise stripping.
- **Dedup/merge tests:** URL match, name fallback, screenshot→URL merge.
- **Notion mapping tests:** property builders produce valid Notion payloads (mock the SDK).
- **Message tests:** fit-threshold gating (no log < 3), char-count, UTM link assembly, 3-variant parsing.
- **E2E (light):** add → message → log happy path (Playwright optional).
- Store the two real profiles as committed fixtures (no secrets; public profile text used only as test data).

## 13. Relationship to the existing Python repo
- **Stays (unchanged):** `follow_up_bot.py` + daily cron, `weekly_report.py` + cron, `config.py`/`event.json`/`team.json` as the data contract, `setup_notion_dbs.py`/`discover_users.py` for Notion provisioning, CSV importers (can also be triggered from the app later).
- **Superseded as the daily UI:** `contact_logger.py`, `message_gen.py`, `outreach_queue.py` (their logic is re-expressed in the web app; the Python files can remain for power use / reference).
- **Migrated into the app:** screenshot processing (instant, in-app) instead of the 15-min `screenshot_processor` cron.

## 14. Phasing (detail lives in the implementation plan)
1. **Scaffold + auth + Notion read** — Next.js, Tailwind/shadcn, login, Today queue (read-only).
2. **Add contact + bookmarklet + dedup/merge** — the #1 pain, end-to-end.
3. **Ingestion engine + tests** — paste → structured + authored-only signals (the two fixtures must pass).
4. **Messaging (3 variants) + copy/log + follow-up** — the daily workhorse.
5. **Screenshots (vision) batch** — instant in-app capture.
6. **Contacts table + Pipeline board + live Dashboard.**
7. **Deploy to Vercel + team onboarding (bookmarklet install, shared password).**
8. **(Fast-follow) Reject analytics.**

Each phase is independently shippable and testable.

## 15. Open questions for implementation
- Exact home for the shared config JSON (copy into web app vs. read from the Python repo path vs. a tiny Notion "config" page). Recommendation: copy `event.json`/`team.json` into the web app and keep a note to sync; revisit if drift becomes a problem.
- Whether to retire the Screenshot Inbox DB + cron once in-app processing ships (recommend: keep one release as fallback, then retire).
- Recharts vs. embedding the existing Chart.js template for the dashboard (low stakes).
