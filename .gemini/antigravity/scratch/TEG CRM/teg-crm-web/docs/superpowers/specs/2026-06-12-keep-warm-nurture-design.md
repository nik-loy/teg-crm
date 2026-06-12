# Keep-Warm Nurture Module — Design Spec

**Date:** 2026-06-12
**Status:** Approved (Approach B, phased)
**Repo:** `teg-crm-web`

## 1. Problem

The CRM is entirely **event-cycle-driven**. The Today queue (`getTodayBuckets`) only surfaces contacts mid-outreach: Connected-without-message, stale requests, due follow-ups, replies. Once a contact completes a cycle — or isn't picked for the next event — **no query ever selects them again**. High-value connections (potential future speakers, sponsors, mentors) silently rot in the Contacts table. The Tier field exists but drives no action.

## 2. Goal

Add a **relationship-nurture loop** parallel to the event-outreach loop, so flagged high-value contacts are periodically resurfaced for light-touch contact and can be found again when a matching event comes up.

## 3. User decisions (locked)

1. **Identification** is a hybrid funnel: (a) manual flag by the rep, (b) rule-based auto-suggest (seniority/company), (c) AI-suggested from profile summary + notes. NOT tier-based automatic.
2. **Nurture actions**: periodic touchpoint cadence, event-match resurfacing, review digest, and speaker/partner shortlists — built in phases, cadence first.
3. **Scale**: medium today (300–1500 contacts, 30–150 keep-warm), may grow.
4. **Ownership**: shared pool. Every keep-warm contact is visible to the whole team; the original connector (`Outreach Owner`) is always displayed so that person can do the personal follow-up.
5. **Flag metadata**: category (multi-select) + free-text reason.

## 4. Architecture constraints

- **Notion is the single source of truth and the integration contract.** All keep-warm state lives as additive fields on the existing Contacts DB. The web app and the Python repo (`../teg-crm`) never call each other.
- Additive fields only — fully backward compatible with the Python automation.
- All Notion/AI calls server-side only. TDD mandatory for `src/lib/**`.
- No LinkedIn API calls ever (ban risk). The app drafts; the human sends.

## 5. Data model (additive Notion fields on Contacts DB)

| Field | Notion type | Values / semantics |
|---|---|---|
| `Keep Warm Status` | Select | *(empty)* = normal contact · `Suggested` (AI/rule proposed, awaiting confirm) · `Active` · `Snoozed` · `Dropped` |
| `Keep Warm Category` | Multi-select | `Future Speaker`, `Sponsor/Partner`, `Mentor/Expert`, `VIP Guest`, `Other` |
| `Keep Warm Reason` | Rich text | One-liner why this person matters |
| `Next Touch Date` | Date | Drives the cadence bucket. Default = flag date + 90 days; bumped +90d on every logged touch; snooze = +30/+90/+180 |

Reused (not duplicated): `Outreach Owner` = original connector (displayed for transparency); `Last Contact Date` = last touch. `Tier` and `Pipeline Stage` stay untouched — keep-warm is an orthogonal track (pipeline = event engagement; keep-warm = relationship value independent of events).

`Snoozed` semantics: still in the pool and shown on the Relationships page, but its `Next Touch Date` was pushed out manually. (Status is informational; the date alone drives due-ness.)

## 6. Phases

### Phase 1 — the leak-stopper (manual flag + cadence + shortlists)

- **Flagging UI**: "Keep Warm" action in the contact card (Contacts page) opening a small dialog: status, categories, reason; saves all keep-warm fields in one PATCH.
- **Today queue**: fifth bucket **"Keep Warm — touch due"** = `Keep Warm Status = Active` AND `Next Touch Date <= today`. Action button → messages page in nurture mode.
- **Relationships page** (`/relationships`, new nav tab): the shared-pool + shortlist view. Lists all contacts with non-empty keep-warm status, grouped by category (a contact with 2 categories appears in both groups), each row showing name, title/company, original connector, reason, last touch, next touch, status. Row actions: Touch now (→ nurture message), Snooze +30/+90/+180, Drop.
- **Touch logging**: when an interaction is logged for a contact whose `Keep Warm Status = Active`, also set `Next Touch Date = today + 90d` (and `Status` back to `Active` if it was `Snoozed`).
- **Nurture message mode**: the message generator gets a second prompt mode (`mode: "nurture"`) — light-touch relationship message (congrats / article / check-in), explicitly NOT an event invite. Reached via `?mode=nurture` on the messages page.

### Phase 2 — the safety net (rules + AI suggestions)

- **Rules**: `config/keepwarm-rules.json` — seniority keywords (e.g. Partner, Director, Principal, Head of, VP, C-level) + target companies. A pure function `matchesKeepWarmRules(contact)` returns a match reason or null.
- **AI pass**: batch endpoint `POST /api/keepwarm/scan` scans contacts with `LinkedIn Outreach Status ∈ {Connected, Messaged}` and empty `Keep Warm Status`. Rules first (free); contacts with a `Profile Summary` then go through Gemini (OpenAI fallback, same pattern as `/api/followup`) asking "is this a future speaker/sponsor/mentor?" Matches are written back as `Keep Warm Status = Suggested` + drafted category + reason (prefixed `Rule:` or `AI:`).
- **Confirm queue**: the Relationships page shows a "Suggested" section with one-click **Confirm** (→ Active, sets Next Touch Date) / **Dismiss** (→ Dropped). Humans always confirm; AI never auto-activates.
- Scan is triggered manually by a button on the Relationships page (cron later if wanted).

### Phase 3 — the payoff (event-match + digest)

- **Event-match**: `POST /api/keepwarm/match` ranks all `Active`/`Snoozed` keep-warm contacts against the current `config/event.json` (name, speakers, agenda, keywords) via one AI call, returning top fits + one-line justification each. Button "Match against current event" on the Relationships page renders the ranked list with Message actions.
- **Weekly digest** (cross-repo): extend the existing Python weekly report in `../teg-crm` with a keep-warm section — counts by status, overdue touches (Next Touch Date < today), suggested awaiting confirmation. Reads the same Notion fields; no new infrastructure.

## 7. Out of scope (YAGNI)

- No separate Notion Relationships DB (relations are clunky over the API; fields on Contacts suffice at this scale).
- No auto-sending of anything. No LinkedIn scraping.
- No per-category cadence defaults (one 90-day default + manual snooze is enough for v1).
- No cron for the AI scan in Phase 2 (manual button; revisit if usage proves it).

## 8. Error handling

- Notion calls go through existing `withRetry` (3 req/s rate limit).
- AI scan degrades gracefully: rules still apply if no AI key / quota exhausted; per-contact AI failures are skipped and reported in the scan summary, never abort the batch.
- Pages render an error card on Notion failure (same pattern as Today page).

## 9. Testing

- TDD for all of `src/lib/**`: cadence math (`keepwarm.ts`), Notion mapping extensions (`map.ts`), rules matching (`keepwarm-rules.ts`), AI prompt build + response parsing (`keepwarm-suggest.ts`, `nurture.ts`), bucket logic.
- Route handlers and pages follow existing conventions (thin, logic in lib).

## 10. Manual setup (one-time, before Phase 1 deploy)

Add the four fields from §5 to the Notion Contacts DB by hand (Notion API can't add select options reliably without schema update permissions; manual is 2 minutes). Exact names matter — they are the contract.
