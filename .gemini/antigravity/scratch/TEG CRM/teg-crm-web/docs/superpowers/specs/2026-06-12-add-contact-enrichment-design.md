# Add-Contact LinkedIn Enrichment — Design Spec

**Date:** 2026-06-12
**Status:** Approved (Approach A — single server "prepare" step)
**Repo:** `teg-crm-web`

## 1. Problem

The daily sales workflow is: reps fire many LinkedIn connection requests, and each
pending request is logged into Notion early via the **Pending Requests** importer with
only sparse data (name + job title, status `Request Sent`). So **the contact almost
always already exists** in the CRM. When the person *accepts*, the rep opens the **Add
Contact** page, pastes the person's **entire LinkedIn profile** into the *LinkedIn
Profile Text* box, and expects the app to (a) recognise which existing contact this is,
(b) enrich it with the profile data, and (c) store enough structured data that a
personalised event message can be generated later.

Today this flow is unreliable and largely broken:

1. **Notion's 2000-char-per-rich-text limit silently breaks every paste-to-save.**
   `props.ts` writes `rich_text: [{ text: { content: s } }]` with no chunking. A full
   profile paste (3,000–8,000+ chars) makes the Notion `pages.update`/`create` call
   return a 400. In enrich mode this surfaces as a failed / "no changes" save. **This is
   the primary "it's not working."**
2. **In enrich mode the extraction result is discarded.** `handleProfilePaste` runs
   extraction but the enrich branch does nothing with it (`// already loaded from
   contact`). The name is never inferred to find the contact; job title / company never
   auto-fill from the paste.
3. **No auto-match from the paste.** The page defaults to **"new"**, but the real
   workflow is almost always **enrich**. To enrich today you must manually toggle modes,
   type a search, and click a result.
4. **The rich structured extraction is thrown away.** `/api/extract` returns
   `about`, `experience`, `education`, `skills`, `personalization_signals`,
   `authored_posts` — exactly the material a personalised message needs — but the form
   keeps only `name`/`current_title`/`current_company`, and only the *raw,
   repost-contaminated* paste is (attempted to be) stored.
5. **Merge gating bug.** `resolveMerge` gates `Profile Summary` on `!existing.notes`
   (wrong field) instead of `!existing.profileSummary`.
6. **The profile is pasted twice.** The Message page (`messages/[contactId]/page.tsx`)
   makes the rep paste the profile *again* and never reads the stored `Profile Summary`,
   so the captured data is never reused.

## 2. Goal

Make Add Contact **paste-first and reliable**: a rep pastes the full LinkedIn profile
once, the app **automatically infers the name, matches the existing contact, shows it
for one-tap confirmation**, and on save **reliably stores all relevant structured data
(crucially the full Experience and Education history) into Notion without losing
anything** — so a personalised message can later be generated from it without a second
paste. As automatic as possible while remaining reliable: **never silently write to the
wrong contact, never silently create a duplicate, never lose pasted information.**

## 3. User decisions (locked)

1. **Save behaviour = auto-detect + 1-tap confirm.** Paste → app infers the name, finds
   the matching existing contact, shows it **pre-selected** with a confidence chip +
   reason and the extracted fields filled in; the rep glances and taps **Save**. One
   confirmation, zero typing. No fully-automatic silent save.
2. **Storage = structured fields + a lossless catch-all.** Use dedicated structured
   Notion fields for the high-value bits, **plus** a misc/overflow store so any relevant
   info that has no dedicated field is still captured. **No important info may be lost.**
3. **Experience and Education are CRUCIAL.** Both the full employment/experience history
   and the full education history must be reliably extracted and written into dedicated
   Notion fields (not merely summarised away).
4. **Scope** includes the Add/Enrich page, extraction, matching, storage, merge fixes,
   **and** one downstream link: the Message step reuses the stored profile (no second
   paste). The message **system prompt stays the authoritative guideline** — it is not
   rewritten; it is only fed cleaner profile info.
5. **Personalization Signals** is a simple comma-joined rich-text field for v1
   (multi-select deferred).

## 4. Architecture constraints

- **Notion is the single source of truth and the integration contract.** All new state
  lives as **additive** fields on the existing Contacts DB. The web app and the Python
  repo (`../teg-crm`) never call each other; additive fields stay backward-compatible
  with the Python automation.
- **All Notion / AI calls server-side only** (Route Handlers). The browser never sees a
  secret and never runs matching logic.
- **TDD mandatory for `src/lib/**`** (extraction, matching, chunking, merge). Use the
  committed fixtures `tests/fixtures/profile-max.txt` and `profile-jonas.txt`.
- **No LinkedIn API calls ever** (ban risk). Ingestion is manual copy-paste only.
- **Non-destructive enrichment** (locked decision #6 of the app): only fill **empty**
  Notion fields; never overwrite a value already present.
- Notion rate limit 3 req/s → all calls go through `withRetry`.

## 5. Recommended approach — one server-side "prepare" step

Extraction + name inference + contact matching happen in a single new endpoint
`POST /api/enrich/prepare`. The client sends the raw paste once and receives
`{ profile, inferredName, candidates }`. Rejected alternatives: client-side orchestration (chatty;
matching untestable; violates "logic server-side"); instant-deterministic-name + parallel
LLM (fastest feel but race conditions / more state). We get testability *and* most of the
speed by putting a deterministic name heuristic **inside** `prepare`.

```
Client paste ──POST /api/enrich/prepare──▶ server:
   1. extractProfile(text)            → ExtractedProfile (LLM, Gemini→OpenAI fallback)
   2. inferName(text, profile.name)   → { name, confidence } (LLM name ⨉ first-line heuristic)
   3. matchContacts(name, dbId)       → candidates: { contact, score, reason }[]
   ◀── { profile, inferredName, candidates }
Client renders match card / candidate list / create-new, then:
   - Enrich:  PATCH /api/contacts/[id]   (structured fields, non-destructive, chunked)
   - Create:  POST  /api/contacts        (same extracted fields, structured storage)
```

## 6. UX flow & states (`add/page.tsx`)

One prominent textarea is the entry point ("Paste the full LinkedIn profile"). On paste
(debounced ~600 ms) call `/api/enrich/prepare`, then render one of:

- **Confident unique match** (`score ≥ 0.9 && unique`): a **match card** showing the
  contact, a confidence chip + human reason ("exact name match" / "matched ignoring
  middle name" / "fuzzy 88%"), a **[change]** link, and a **"fields to fill" preview**
  listing *only the empty Notion fields* that will be written (each with its extracted
  value; fields that already have a value are shown struck-through and will NOT be
  overwritten). One button: **Save enrichment**.
- **Multiple / low-confidence matches**: a ranked candidate list to pick from, plus a
  **"＋ Create new contact"** option.
- **No match**: "No match found — create new?" with all extracted fields pre-filled.

**[change]** lets the rep re-pick another candidate or switch to create-new. The old
two-mode (New / Enrich) toggle is replaced by this single smart flow; a collapsible
manual "New Contact" form remains as a fallback, pre-filled from the same extraction.

Progressive feedback while waiting: "Reading profile…" → "Finding contact…".

## 7. Extraction changes (`src/lib/extraction/`)

`prompt.ts` is hardened; `types.ts` gains `other_notes`. The `ExtractedProfile` shape
becomes (additions in **bold**):

```ts
interface ExtractedProfile {
  name, headline, current_title, current_company, location, industry,
  seniority_estimate,
  education:  Array<{ school; degree; years }>,      // ALL entries — crucial, complete
  experience: Array<{ title; company; dates; current }>, // ALL roles — crucial, complete
  skills: string[],
  authored_posts: Array<{ summary; topics: string[] }>,
  personalization_signals: string[],
  about: string,
  other_notes: string[],   // NEW — relevant info with no dedicated field
  excluded_reposts_count: number,
}
```

Prompt rules added / emphasised:
- **Capture the COMPLETE experience list** — every role with title, company, dates;
  never drop past roles or collapse them into a summary. `current:true` for present roles.
- **Capture the COMPLETE education list** — every school with degree + years.
- `other_notes` = genuinely relevant facts that fit no dedicated field (languages,
  certifications, awards, volunteering, publications). Never invent; `[]` if none.
- `location` taken from the line under the headline (e.g. "Munich, Bavaria, Germany").
- Keep existing repost-exclusion and "top-of-profile headline is canonical" rules.

**Deterministic name safety net (`inferName`):** the LLM `name` is cross-checked against
a **first-substantive-line heuristic** (first non-empty line that isn't UI noise like
"Message"/"Connect", isn't a section header, contains no digits). On agreement →
confidence `high`. On disagreement → keep matching with the LLM name but mark confidence
`low` so the rep confirms. If the LLM name is empty/garbage, fall back to the heuristic.

## 8. Name normalization + matching (`src/lib/match/`, new — TDD)

- **`normalize.ts`** — `normalizeName(raw): string`: lowercase; strip diacritics
  (ü→u, ö→o, ä→a, ß→ss); strip leading titles (Dr., Prof., Dipl.-Ing., Herr, Frau);
  strip trailing credentials (PhD, MBA, M.Sc., B.Sc.); strip pronoun parentheticals
  ("(she/her)"); strip emojis and verification ticks; collapse whitespace. Also exposes
  `nameTokens(raw): { first, last, all[] }`.
- **`match.ts`** — `scoreMatch(inferred, contact): { score, reason }` and
  `rankCandidates(inferred, contacts): {contact,score,reason}[]` (sorted desc, filtered
  `score ≥ 0.55`, top 5):
  - exact normalized equality → `1.0` ("exact name match")
  - same first + last token, extra middle tokens ignored → `0.92` ("matched ignoring middle name")
  - one normalized name contains the other → `0.8` ("partial name match")
  - Jaro-Winkler similarity for typos/variants → graded `0.55–0.88` ("fuzzy {n}%")
- **Candidate sourcing**: `prepare` queries Notion `Name title contains <lastNameRaw>`
  (cheap, case-insensitive); if 0, retries with `<firstNameRaw>`; scores the returned
  set in memory. (Contacts DB is small — hundreds — so reads stay within rate limits.)
- **Auto-select rule**: a single candidate with `score ≥ 0.9` is pre-selected; anything
  else shows the picker. **Matching never triggers a silent create or a silent merge.**

## 9. Data model — Notion storage (additive fields on Contacts DB)

| Notion property | Notion type | Source | Write rule |
|---|---|---|---|
| `Job Title` (existing) | rich_text | `current_title` | fill-if-empty |
| `Location` (additive) | rich_text | `location` | fill-if-empty |
| **`Experience` (additive)** | **rich_text, chunked** | **full `experience[]` — each `Title · Company · Dates`, newline-joined, ALL roles** | **fill-if-empty — crucial** |
| **`Education` (additive)** | **rich_text, chunked** | **full `education[]` — each `School · Degree · Years`, newline-joined, ALL entries** | **fill-if-empty — crucial** |
| `Personalization Signals` (additive) | rich_text | `personalization_signals` comma-joined | fill-if-empty |
| `Profile Summary` (existing) | rich_text, chunked | **full clean render**: headline, location, about, **experience, education**, skills, signals, `other_notes` | fill-if-empty (lossless mirror) |

- **`Company` is a relation** (to a Companies DB) and is **not** written here;
  `current_company` lives in the summary/Notes only.
- **Experience and Education are written to their own dedicated fields AND mirrored into
  Profile Summary** — belt-and-suspenders so they are individually usable and can never
  be lost.
- **Schema-aware writes (losslessness guarantee):** before writing, `prepare`'s sibling
  save path reads the Contacts DB schema once (`databases.retrieve`, cached per process).
  Each additive field is written **only if the property exists**; if a property is
  missing, its content is **folded into `Profile Summary`** instead. Therefore **no info
  is lost even if the optional Notion fields are never added.**
- A clean structured renderer `src/lib/extraction/summary.ts` (`renderSummary(profile)`)
  produces the Profile Summary text and the per-field strings; it is pure + unit-tested.

**Optional one-time Notion setup** (documented, not required for correctness): add
rich-text properties `Location`, `Experience`, `Education`, `Personalization Signals` to
the Contacts DB to get them as first-class columns. Until then everything lands losslessly
in `Profile Summary`.

## 10. Save flows & non-destructive merge

- **Chunking (`src/lib/notion/chunk.ts`, new — TDD):** `richTextChunks(s): RichText[]`
  splits any string into ≤2000-char chunks (prefer splitting on newline/space boundaries)
  and returns the Notion rich-text array. `props.ts` `richText` is reimplemented on top of
  it so **every** rich-text write is safe, app-wide.
- **`resolveMerge` (fixed + extended):** correct the gating bug
  (`!existing.profileSummary`), and add non-destructive handling for `location`,
  `experience`, `education`, `personalizationSignals`. Still: only fills empty fields,
  never overwrites.
- **Enrich** `PATCH /api/contacts/[id]`: accepts the structured fields, runs schema-aware
  + non-destructive write, returns `{ updated, pageId, filledFields[] }` so the UI can
  show exactly what was added.
- **Create** `POST /api/contacts`: same extracted fields + structured storage for the rare
  brand-new contact; existing URL/name dedup preserved.

## 11. Message reuse (scope boundary — no prompt rewrite)

`/api/message` (and `messages/[contactId]/page.tsx`) load the contact's stored
`Profile Summary` and use it as `profileText` when the rep doesn't paste anything — so the
profile captured at enrich time is reused and the **double paste is eliminated**. The
manual paste box remains as an override. `buildSystemPrompt` is **unchanged**; only the
`Profil-Infos` it receives become cleaner (structured, repost-free). The optional paste box
on the message page stays for ad-hoc cases.

## 12. Bugs fixed (summary)

- Notion 2000-char rich-text → chunked (root cause of save failures).
- Enrich mode discarding extraction → enrich is now the primary, auto-matched path.
- `resolveMerge` wrong-field gating → fixed.
- Rich extraction discarded → structured fields + lossless summary persisted.
- Double paste → message step reuses stored summary.

## 13. File changes

**New**
- `src/app/api/enrich/prepare/route.ts` — extract + infer + match orchestration.
- `src/lib/match/normalize.ts`, `src/lib/match/match.ts` — name normalize + ranking.
- `src/lib/notion/chunk.ts` — ≤2000-char rich-text chunking.
- `src/lib/extraction/summary.ts` — structured → clean Profile Summary + per-field strings.
- Tests: `tests/match-normalize.test.ts`, `tests/match.test.ts`, `tests/notion-chunk.test.ts`,
  `tests/extraction-summary.test.ts` (+ extend `extraction.test.ts`, `dedup-merge.test.ts`).

**Edited**
- `src/app/(app)/add/page.tsx` — paste-first UX (match card / picker / create-new).
- `src/lib/extraction/prompt.ts`, `types.ts` — complete experience/education, `other_notes`, location.
- `src/lib/notion/props.ts` — `richText` reimplemented on chunking.
- `src/lib/notion/contacts.ts` — `resolveMerge` fix + new fields; schema-aware helper.
- `src/app/api/contacts/route.ts`, `src/app/api/contacts/[id]/route.ts` — structured + schema-aware writes.
- `src/app/api/message/route.ts`, `messages/[contactId]/page.tsx` — reuse stored Profile Summary.

## 14. Testing (TDD — failing test first)

- `match-normalize`: diacritics, titles, credentials, pronouns, emojis, whitespace.
- `match`: exact / ignore-middle / partial / fuzzy ranking; ambiguity (multi-match → no
  auto-select); zero-match.
- `notion-chunk`: <2000 single chunk; >2000 multi-chunk; boundary-preferred splits; 5,000+
  char profile round-trips without error.
- `extraction` (extend): from `profile-max.txt` / `profile-jonas.txt` assert **all** three
  experience roles and **both** education entries are captured, location parsed, signals
  exclude reposts, `other_notes` populated when present.
- `extraction-summary`: renderer includes experience + education; never exceeds losslessness
  (every extracted field appears somewhere).
- `dedup-merge` (extend): non-destructive fill of new fields; gating-bug regression.

## 15. Out of scope

- Rewriting the message system prompt (stays the guideline).
- `Personalization Signals` as multi-select (v1 = comma-joined text).
- Writing the `Company` relation.
- Any LinkedIn network/API call or auto-send.
- Keep-warm / nurture concerns (separate spec).

## 16. Open setup note

The four additive Notion properties (`Location`, `Experience`, `Education`,
`Personalization Signals`) are **optional** for correctness — schema-aware writes fold
missing fields into `Profile Summary`. Recommend adding them as rich-text columns to get
first-class Experience/Education columns in Notion. A short note will go in the team
quickstart.
