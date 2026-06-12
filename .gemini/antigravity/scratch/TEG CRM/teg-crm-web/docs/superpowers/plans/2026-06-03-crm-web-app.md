# TEG CRM Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, team-wide, install-free web app that becomes the single interactive front door to the TEG CRM (log contacts, ingest LinkedIn profiles, generate outreach messages, handle replies, batch-capture screenshots, view pipeline) — replacing the long terminal commands, while Notion stays the single source of truth and the existing Python automation keeps running.

**Architecture:** Next.js (App Router) + TypeScript on Vercel. All Notion/OpenAI calls run in server code (Route Handlers / Server Actions) holding secrets; the browser only talks to our server. A shared-password gate guards everything. Notion is the integration contract shared with the unchanged Python cron jobs.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, `@notionhq/client`, `openai`, Vitest + Playwright, Vercel.

---

## How to read this plan

- Read the design spec first: `docs/superpowers/specs/2026-06-03-crm-web-app-design.md`. It is the source of truth for *what* and *why*; this plan is *how*.
- Phases are sequential (each builds on the last) but each ends shippable. A fresh session may execute one phase at a time.
- **TDD is mandatory for `src/lib/**`** (extraction, dedup/merge, Notion mapping, message parsing) — these are the domain crown jewels with real fixtures. UI scaffolding uses exact commands + acceptance criteria rather than reproducing framework boilerplate.
- Commit after every passing task. Conventional commit messages.

## File structure (locked decomposition)

```
teg-crm-web/
├── CLAUDE.md                       # project instructions (already written)
├── .env.example                    # all env vars (already written)
├── .env.local                      # real secrets (gitignored)
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── middleware.ts                   # auth guard for all routes
├── config/
│   ├── event.json                  # COPIED from teg-crm/config/event.json (the contract)
│   └── team.json                   # COPIED from teg-crm/config/team.json
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── (app)/                  # auth-guarded group
│   │   │   ├── layout.tsx          # sidebar shell
│   │   │   ├── today/page.tsx
│   │   │   ├── add/page.tsx
│   │   │   ├── messages/[contactId]/page.tsx
│   │   │   ├── screenshots/page.tsx
│   │   │   ├── contacts/page.tsx
│   │   │   └── pipeline/page.tsx
│   │   └── api/
│   │       ├── auth/login/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── contacts/route.ts          # create + dedup/merge
│   │       ├── contacts/search/route.ts   # find by url/name
│   │       ├── today/route.ts             # queue data
│   │       ├── extract/route.ts           # profile paste → structured
│   │       ├── message/route.ts           # 3 variants
│   │       ├── followup/route.ts
│   │       ├── interactions/route.ts      # log + status update
│   │       └── screenshots/route.ts       # vision batch
│   ├── lib/
│   │   ├── env.ts                  # typed env access
│   │   ├── auth.ts                 # cookie sign/verify
│   │   ├── notion/
│   │   │   ├── client.ts           # singleton + with-retry
│   │   │   ├── props.ts            # property builders (title/select/url/date/richtext/relation)
│   │   │   ├── contacts.ts         # query/create/update/merge contacts
│   │   │   └── map.ts              # Notion page <-> Contact domain type
│   │   ├── extraction/
│   │   │   ├── prompt.ts           # extraction system prompt
│   │   │   ├── extract.ts          # call LLM, parse, validate JSON
│   │   │   └── types.ts            # ExtractedProfile
│   │   ├── message/
│   │   │   ├── systemPrompt.ts     # build from event.json (port of build_system_prompt)
│   │   │   ├── generate.ts         # 3-variant generation
│   │   │   ├── followup.ts
│   │   │   └── parse.ts            # parse fit/seniority/anrede/variants/charcount
│   │   ├── config.ts               # load event.json + team.json, blacklist, UTM
│   │   └── types.ts                # Contact, OutreachStatus, etc.
│   └── components/                 # shadcn/ui + app components
├── public/
│   └── bookmarklet.html            # install page for the ＋TEG bookmarklet
└── tests/
    ├── fixtures/
    │   ├── profile-jonas.txt       # real paste (committed; public profile text)
    │   └── profile-max.txt
    ├── extraction.test.ts
    ├── dedup-merge.test.ts
    ├── notion-map.test.ts
    └── message-parse.test.ts
```

---

## Phase 0 — Scaffold, tooling, config port

### Task 0.1: Create the Next.js app

**Files:** Create `teg-crm-web/` (whole app).

- [ ] **Step 1:** From the parent dir (`TEG CRM/`), scaffold:

```bash
npx create-next-app@latest teg-crm-web --ts --tailwind --eslint --app --src-dir --use-npm --no-import-alias
cd teg-crm-web
```
Expected: app created, `npm run dev` serves a default page on :3000.

- [ ] **Step 2:** Add deps:

```bash
npm i @notionhq/client openai
npm i -D vitest @vitejs/plugin-react jsdom @types/node
```

- [ ] **Step 3:** Init shadcn/ui:

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input select badge card table dialog textarea toast sonner tabs dropdown-menu skeleton
```

- [ ] **Step 4:** Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5:** Commit.

```bash
git init && git add -A && git commit -m "chore: scaffold Next.js TEG CRM web app with shadcn + vitest"
```

### Task 0.2: Port the config contract

**Files:** Create `config/event.json`, `config/team.json`, `src/lib/config.ts`, `src/lib/env.ts`.

- [ ] **Step 1:** Copy `teg-crm/config/event.json` and `teg-crm/config/team.json` into `teg-crm-web/config/` verbatim. (These are the data contract — see spec §9. If they don't exist yet in the Python repo, build them from the Python repo's improvements spec.)

- [ ] **Step 2:** Create `src/lib/env.ts`:

```ts
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
export const env = {
  notionToken: () => req("NOTION_TOKEN"),
  contactsDb: () => req("NOTION_CONTACTS_DB_ID"),
  companiesDb: () => process.env.NOTION_COMPANIES_DB_ID ?? "",
  interactionsDb: () => req("NOTION_INTERACTIONS_DB_ID"),
  openaiKey: () => process.env.OPENAI_API_KEY ?? "",
  anthropicKey: () => process.env.ANTHROPIC_API_KEY ?? "",
  appPassword: () => req("APP_PASSWORD"),
  authSecret: () => req("AUTH_SECRET"),
};
```

- [ ] **Step 3:** Create `src/lib/config.ts` that imports the two JSON files and exposes typed accessors (`getEvent()`, `getTeam()`, `utmFor(name)`, `blacklist`). Mirror the Python defaults: `DEFAULT_BLACKLIST = ["Netlight", "Oliver Wyman", "Accenture"]` plus `OUTREACH_BLACKLIST_COMPANIES` env (comma-split).

- [ ] **Step 4:** Commit: `git commit -am "feat: port event.json/team.json config contract"`.

---

## Phase 1 — Auth (shared password)

### Task 1.1: Cookie sign/verify

**Files:** Create `src/lib/auth.ts`; Test `tests/auth.test.ts`.

- [ ] **Step 1: Write failing test** `tests/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "../src/lib/auth";
describe("auth cookie", () => {
  it("round-trips a valid session", () => {
    const token = signSession("secret123");
    expect(verifySession(token, "secret123")).toBe(true);
  });
  it("rejects a tampered token", () => {
    const token = signSession("secret123");
    expect(verifySession(token + "x", "secret123")).toBe(false);
  });
  it("rejects under a different secret", () => {
    const token = signSession("secret123");
    expect(verifySession(token, "other")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail:** `npm test -- tests/auth.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/auth.ts`:

```ts
import { createHmac, timingSafeEqual } from "crypto";
const PAYLOAD = "teg-crm-authed";
export function signSession(secret: string): string {
  const sig = createHmac("sha256", secret).update(PAYLOAD).digest("hex");
  return `${PAYLOAD}.${sig}`;
}
export function verifySession(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const expected = signSession(secret);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run, verify pass:** `npm test -- tests/auth.test.ts` → PASS.

- [ ] **Step 5: Commit:** `git commit -am "feat: HMAC session cookie sign/verify"`.

### Task 1.2: Login route + middleware + login page

**Files:** Create `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `middleware.ts`, `src/app/login/page.tsx`.

- [ ] **Step 1:** `src/app/api/auth/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { signSession } from "@/lib/auth";
export async function POST(req: Request) {
  const { password } = await req.json();
  if (password !== env.appPassword()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("teg_session", signSession(env.authSecret()), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
```
(`logout/route.ts`: clear the cookie, return ok.)

- [ ] **Step 2:** `middleware.ts` (guards everything except `/login`, `/api/auth/*`, static):

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname.startsWith("/login") || pathname.startsWith("/api/auth") ||
               pathname.startsWith("/_next") || pathname === "/favicon.ico";
  if (open) return NextResponse.next();
  const ok = verifySession(req.cookies.get("teg_session")?.value, process.env.AUTH_SECRET!);
  if (!ok) {
    const url = req.nextUrl.clone(); url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
```

- [ ] **Step 3:** `src/app/login/page.tsx` — a centered card: password input + submit → POST `/api/auth/login` → on 200 redirect to `?next` or `/today`; on 401 show "Wrong password". Use shadcn `Card`, `Input`, `Button`.

- [ ] **Step 4: Manual verify:** `npm run dev`; visiting `/today` redirects to `/login`; correct password lands on `/today` (404 page for now, fine); wrong password shows error.

- [ ] **Step 5: Commit:** `git commit -am "feat: shared-password login + route guard middleware"`.

---

## Phase 2 — Notion client, domain types, Today queue (read)

### Task 2.1: Notion client + retry + property builders

**Files:** Create `src/lib/notion/client.ts`, `src/lib/notion/props.ts`; Test `tests/notion-props.test.ts`.

- [ ] **Step 1: Failing test** `tests/notion-props.test.ts` (port of the Python property builders):

```ts
import { describe, it, expect } from "vitest";
import { title, select, url, date, richText, relation } from "../src/lib/notion/props";
describe("notion props", () => {
  it("builds title", () => {
    expect(title("Anna")).toEqual({ title: [{ text: { content: "Anna" } }] });
  });
  it("builds select", () => {
    expect(select("Tier 1")).toEqual({ select: { name: "Tier 1" } });
  });
  it("builds url and date and relation", () => {
    expect(url("https://x")).toEqual({ url: "https://x" });
    expect(date("2026-06-03")).toEqual({ date: { start: "2026-06-03" } });
    expect(relation("pid")).toEqual({ relation: [{ id: "pid" }] });
  });
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3:** `src/lib/notion/props.ts`:

```ts
export const title = (s: string) => ({ title: [{ text: { content: s } }] });
export const richText = (s: string) => ({ rich_text: [{ text: { content: s } }] });
export const select = (s: string) => ({ select: { name: s } });
export const url = (s: string) => ({ url: s });
export const date = (iso: string) => ({ date: { start: iso } });
export const relation = (pageId: string) => ({ relation: [{ id: pageId }] });
```

- [ ] **Step 4:** Run → PASS.

- [ ] **Step 5:** `src/lib/notion/client.ts` (singleton + with-retry, mirroring `notion_helpers.with_retry`, exp backoff on 429/5xx, max 5 tries):

```ts
import { Client } from "@notionhq/client";
let _c: Client | null = null;
export function notion(): Client {
  if (!_c) _c = new Client({ auth: process.env.NOTION_TOKEN! });
  return _c;
}
export async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 400;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      const code = e?.status ?? e?.code;
      const retryable = code === 429 || (typeof code === "number" && code >= 500);
      if (!retryable || i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, delay)); delay *= 2;
    }
  }
  throw new Error("unreachable");
}
```

- [ ] **Step 6: Commit:** `git commit -am "feat: notion client with retry + property builders"`.

### Task 2.2: Contact domain type + page mapping

**Files:** Create `src/lib/types.ts`, `src/lib/notion/map.ts`; Test `tests/notion-map.test.ts`.

- [ ] **Step 1: Failing test** — given a sample Notion page object (inline fixture), `pageToContact()` extracts `id, name, linkedinUrl, jobTitle, company, tier, pipelineStage, outreachStatus, outreachOwner, lastContactDate`. Assert each field, and that a page missing optional fields yields empty strings (no throw). Write the inline page fixture with the real Notion property shapes (`properties["Name"].title[0].plain_text`, `properties["LinkedIn URL"].url`, `properties["LinkedIn Outreach Status"].select.name`, etc.).

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3:** Implement `src/lib/types.ts` (the `Contact` interface, `OutreachStatus = "Request Sent" | "Connected" | "Messaged" | "No Response" | "Withdrawn"`) and `src/lib/notion/map.ts` `pageToContact(page)` with defensive optional chaining for every property.

- [ ] **Step 4:** Run → PASS.

- [ ] **Step 5: Commit.**

### Task 2.3: Today queue data + page

**Files:** Create `src/lib/notion/contacts.ts`, `src/app/api/today/route.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/today/page.tsx`.

- [ ] **Step 1:** `src/lib/notion/contacts.ts`: `queryAll(filter?)` (paginated, mirrors `paginated_query`), plus `getTodayBuckets(owner)` returning `{ noMessage, staleRequests, replies, dueFollowups }` using these rules (from spec §6.1, matching the Python logic):
  - **noMessage:** `LinkedIn Outreach Status = Connected` (no Interaction / not yet Messaged).
  - **staleRequests:** `LinkedIn Outreach Status = Request Sent` AND `created_time` older than `STALE_REQUEST_DAYS` (default 5), filtered in JS (Notion can't filter `created_time`).
  - **dueFollowups:** `Follow-Up Due Date <= today` AND `Follow-Up Complete = false`.
  - **replies:** contacts flagged needing reply (v1: a `Tags` value or a Notes marker; document the chosen signal).

- [ ] **Step 2:** `src/app/api/today/route.ts`: GET → returns the buckets for the current user (owner from a `?owner=` param or default first team member). Server-side only.

- [ ] **Step 3:** `(app)/layout.tsx`: the sidebar shell (Today / Add / Contacts / Pipeline / Screenshots + logout). `(app)/today/page.tsx`: server component fetching buckets, rendering grouped action rows with one-click buttons linking to `/messages/[id]` etc. Match the approved wireframe (colored pills per bucket).

- [ ] **Step 4: Manual verify:** with real Notion creds in `.env.local`, `/today` shows real buckets.

- [ ] **Step 5: Commit:** `git commit -am "feat: Today action queue (read) + app shell"`.

---

## Phase 3 — Add contact + dedup/merge + bookmarklet

### Task 3.1: Dedup/merge logic (TDD)

**Files:** Extend `src/lib/notion/contacts.ts`; Test `tests/dedup-merge.test.ts`.

- [ ] **Step 1: Failing test** `tests/dedup-merge.test.ts` — pure functions with a mocked `queryAll`:
  - `findByUrl(url)` returns existing page id when a contact has that exact `LinkedIn URL`.
  - `findByName(name)` case-insensitive fallback when no url.
  - `resolveMerge(incoming, existing)` returns a property patch that **only fills empty existing fields** (non-destructive): if existing has `jobTitle` set, incoming title is ignored; if existing `LinkedIn URL` empty and incoming has one, it fills (this is the screenshot→URL merge). Assert non-destructive behavior explicitly.

```ts
it("merge is non-destructive: keeps existing job title", () => {
  const patch = resolveMerge(
    { jobTitle: "New Title", linkedinUrl: "https://x" },
    { jobTitle: "Old Title", linkedinUrl: "" }
  );
  expect(patch["Job Title"]).toBeUndefined();        // not overwritten
  expect(patch["LinkedIn URL"]).toEqual({ url: "https://x" }); // filled empty
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `findByUrl`, `findByName`, `resolveMerge` in `contacts.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit:** `git commit -am "feat: non-destructive dedup/merge for contacts"`.

### Task 3.2: Create-contact API + Add page

**Files:** Create `src/app/api/contacts/route.ts`, `src/app/api/contacts/search/route.ts`, `src/app/(app)/add/page.tsx`.

- [ ] **Step 1:** `POST /api/contacts` body `{ url, name, jobTitle?, company?, tier?, status?, owner?, profileText? }`:
  1. `findByUrl(url)`; if found → if any incoming fields fill blanks, apply `resolveMerge` patch and return `{ merged: true, pageId }`; else return `{ existing: true, pageId }`.
  2. else `createContact` with defaults: `Pipeline Stage: Awareness`, `Source: LinkedIn`, `Last Contact Date: today`, status map `{request_sent:"Request Sent", connected:"Connected"}`, `Outreach Owner` rich text.
  3. If `profileText` present, call `/extract` logic and fill structured empty fields + store a `Profile Summary`.
  Return the created/updated page id + Notion URL.

- [ ] **Step 2:** `GET /api/contacts/search?url=` and `?name=` → used by message screen + merge UI.

- [ ] **Step 3:** `(app)/add/page.tsx`: client form pre-filled from `?url=&name=` query (bookmarklet). Fields per spec §6.2; collapsed "Paste profile" `Textarea`. On submit → POST; show success toast with Notion link, or a **merge card** if `merged/existing`.

- [ ] **Step 4: Manual verify:** add a real contact; re-add same URL → no duplicate (existing/merge path).

- [ ] **Step 5: Commit:** `git commit -am "feat: add-contact form + create/merge API"`.

### Task 3.3: Bookmarklet

**Files:** Create `public/bookmarklet.html`.

- [ ] **Step 1:** Define the bookmarklet source (reads URL + name, opens the add page):

```js
javascript:(function(){
  var u=encodeURIComponent(location.href.split('?')[0]);
  var t=document.title.replace(/^\(\d+\)\s*/,'').replace(/\s*\|\s*LinkedIn.*$/,'').trim();
  var n=encodeURIComponent(t);
  window.open('https://YOUR-APP.vercel.app/add?url='+u+'&name='+n,'_blank');
})();
```

- [ ] **Step 2:** `public/bookmarklet.html`: an install page that explains "drag this button to your bookmarks bar," with the draggable link containing the minified bookmarklet (the deploy URL substituted at deploy time). Include the desktop-only note + the phone-pending-request workflow from the spec.

- [ ] **Step 3: Manual verify:** drag to bookmarks bar; on a LinkedIn profile, click → add page opens pre-filled with URL + name.

- [ ] **Step 4: Commit:** `git commit -am "feat: one-click ＋TEG bookmarklet + install page"`.

---

## Phase 4 — Ingestion / extraction engine (TDD with real fixtures)

This is the crown jewel. The two real profiles must pass.

### Task 4.1: Fixtures + types

**Files:** Create `tests/fixtures/profile-jonas.txt`, `tests/fixtures/profile-max.txt`, `src/lib/extraction/types.ts`.

- [ ] **Step 1:** Save the two real pastes from the brainstorm (Jonas Böhrer, Maximilian Wiese) verbatim as the fixture files. (They are public profile text used as test data; no secrets.)
- [ ] **Step 2:** `src/lib/extraction/types.ts`: the `ExtractedProfile` interface exactly matching spec §7.2 (name, headline, current_title, current_company, location, industry, seniority_estimate, education[], experience[], skills[], authored_posts[], personalization_signals[], about, excluded_reposts_count).
- [ ] **Step 3: Commit:** `git commit -am "test: add real LinkedIn profile fixtures + ExtractedProfile type"`.

### Task 4.2: Extraction prompt + parser (TDD)

**Files:** Create `src/lib/extraction/prompt.ts`, `src/lib/extraction/extract.ts`; Test `tests/extraction.test.ts`.

- [ ] **Step 1: Failing test** `tests/extraction.test.ts`. Because real LLM calls are nondeterministic/cost money, test the **parser/validator** against a recorded LLM JSON response (record once, commit as `tests/fixtures/extract-max.json`), AND test the **prompt builder** asserts the critical rules are present:

```ts
import { describe, it, expect } from "vitest";
import { buildExtractionPrompt } from "../src/lib/extraction/prompt";
import { parseExtraction } from "../src/lib/extraction/extract";
import maxResp from "./fixtures/extract-max.json";

describe("extraction prompt", () => {
  it("instructs to exclude reposts and not hallucinate", () => {
    const p = buildExtractionPrompt();
    expect(p).toMatch(/repost/i);
    expect(p).toMatch(/authored/i);
    expect(p).toMatch(/do not (invent|hallucinate)/i);
    expect(p).toMatch(/JSON/);
  });
});

describe("extraction parser", () => {
  it("parses a valid LLM JSON response", () => {
    const r = parseExtraction(JSON.stringify(maxResp));
    expect(r.current_company).toContain("CLOUDPILOTS");
    expect(r.about).toBe("");                 // Max has no About → blank, not invented
    expect(r.personalization_signals.join(" ")).toMatch(/Gemini|Agentic/);
  });
  it("strips markdown fences and throws on non-JSON", () => {
    expect(parseExtraction("```json\n{\"name\":\"X\",\"personalization_signals\":[]}\n```").name).toBe("X");
    expect(() => parseExtraction("not json")).toThrow();
  });
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3:** Implement `src/lib/extraction/prompt.ts` — the system prompt encoding spec §7.1 rules. Key content (must include verbatim intent):

```ts
export function buildExtractionPrompt(): string {
  return `You convert a messy, copy-pasted LinkedIn profile into strict JSON.

RULES:
- Return ONLY a JSON object, no markdown, no commentary.
- AUTHORED vs REPOSTED: the feed mixes the person's own posts with REPOSTS/SHARES of
  others' content. Lines like "<Name> reposted this", "View company:", or a different
  author byline mark REPOSTED content. Put ONLY content the person AUTHORED into
  authored_posts and personalization_signals. NEVER include reposted/shared content
  (e.g. political memes, other companies' posts) — count them in excluded_reposts_count.
- DO NOT invent or hallucinate. If a field (e.g. About) is absent, return "" or [].
- Deduplicate posts (LinkedIn shows each post under both Featured and Activity).
- The canonical headline is the one at the TOP of the profile (under the name), not a
  post byline.
- Keep ALL current roles in experience[] with current:true; current_company = the first
  company in the headline.
- Strip noise: "· 1st", "Message", "More", "Connect", "Endorse", "Show translation",
  "… more", "View image", "1/3", reaction/comment/repost counts, "N followers",
  "N connections", mutual-connection lines, hashtags, emojis.
- personalization_signals = short topical phrases from AUTHORED posts + role/industry
  (e.g. "Gemini Enterprise", "Agentic AI"). German or English as written.

Output JSON shape:
{"name","headline","current_title","current_company","location","industry",
 "seniority_estimate","education":[{"school","degree","years"}],
 "experience":[{"title","company","dates","current"}],"skills":[],
 "authored_posts":[{"summary","topics":[]}],"personalization_signals":[],
 "about","excluded_reposts_count"}`;
}
```

And `src/lib/extraction/extract.ts`:

```ts
import OpenAI from "openai";
import { buildExtractionPrompt } from "./prompt";
import type { ExtractedProfile } from "./types";

export function parseExtraction(raw: string): ExtractedProfile {
  const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/,"").trim();
  const obj = JSON.parse(cleaned);
  return {
    name: obj.name ?? "", headline: obj.headline ?? "",
    current_title: obj.current_title ?? "", current_company: obj.current_company ?? "",
    location: obj.location ?? "", industry: obj.industry ?? "",
    seniority_estimate: obj.seniority_estimate ?? "",
    education: obj.education ?? [], experience: obj.experience ?? [],
    skills: obj.skills ?? [], authored_posts: obj.authored_posts ?? [],
    personalization_signals: obj.personalization_signals ?? [],
    about: obj.about ?? "", excluded_reposts_count: obj.excluded_reposts_count ?? 0,
  };
}

export async function extractProfile(profileText: string, apiKey: string): Promise<ExtractedProfile> {
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildExtractionPrompt() },
      { role: "user", content: profileText },
    ],
  });
  return parseExtraction(resp.choices[0].message.content ?? "");
}
```

- [ ] **Step 4:** Run → PASS. (Record `tests/fixtures/extract-max.json` by running `extractProfile` once against the Max fixture with a real key, then hand-verify the Söder repost is excluded and About is empty; commit the recorded JSON.)

- [ ] **Step 5: Commit:** `git commit -am "feat: LinkedIn profile extraction engine (authored-only) + tests"`.

### Task 4.3: Extract API

**Files:** Create `src/app/api/extract/route.ts`.

- [ ] **Step 1:** `POST /api/extract` `{ profileText }` → `extractProfile` → returns `ExtractedProfile`. Guard: if no `OPENAI_API_KEY`, return 501 with a clear message so the UI can fall back to manual entry.
- [ ] **Step 2:** Wire the Add page's "Paste profile" box to call it and fill empty fields.
- [ ] **Step 3: Commit:** `git commit -am "feat: /api/extract endpoint + add-form autofill"`.

---

## Phase 5 — Messaging (3 variants) + copy/log + follow-up

### Task 5.1: System prompt port + message parser (TDD)

**Files:** Create `src/lib/message/systemPrompt.ts`, `src/lib/message/parse.ts`; Test `tests/message-parse.test.ts`.

- [ ] **Step 1: Failing test** — `buildSystemPrompt(event)` includes event name, agenda, speakers, risk tiers, opening/closing libraries (port of Python `build_system_prompt`); and `parseVariants(response)` extracts an array of `{angle, text}` plus `parseFit/parseAnrede/parseSeniority` (port of the Python regex parsers). Provide a recorded multi-variant response fixture and assert 3 variants, fit int, anrede Du|Sie, charCount per variant.

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `systemPrompt.ts` (direct port of `message_gen.build_system_prompt`, reading `getEvent()`), extended to instruct **3 variants on different angles** in a parseable format (e.g. `**Variante 1 — [angle]:** ...`). Implement `parse.ts` with the regex parsers + char counts.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit:** `git commit -am "feat: port system prompt + 3-variant message parser"`.

### Task 5.2: Generate API + message screen

**Files:** Create `src/lib/message/generate.ts`, `src/app/api/message/route.ts`, `src/app/(app)/messages/[contactId]/page.tsx`.

- [ ] **Step 1:** `generate.ts`: build user message (name + profile signals + invite URL with the owner's UTM from `team.json` + `event.luma_url`); call gpt-4o-mini (anthropic fallback) → return parsed `{ fit, seniority, template, anrede, variants[] }`.
- [ ] **Step 2:** `POST /api/message` `{ contactId, profileText?, owner }` → look up contact, reuse stored profile if present, generate, return analysis + variants. Enforce "no log below fit 3" at the UI layer.
- [ ] **Step 3:** Message screen per approved wireframe (§6.3): analysis row, **3 editable variants with live char counts**, pre-flight, **Copy** + **Mark as messaged + log** + Regenerate/Discard.
- [ ] **Step 4: Commit:** `git commit -am "feat: message screen with 3 editable variants + analysis"`.

### Task 5.3: Interactions log + status update

**Files:** Create `src/app/api/interactions/route.ts`; extend `src/lib/notion/contacts.ts`.

- [ ] **Step 1:** `POST /api/interactions` `{ contactId, summary, type, nextAction }` → create Interaction page (port of `_log_interaction`), set contact `Last Contact Date = today`, set `LinkedIn Outreach Status = Messaged`. Return ok.
- [ ] **Step 2:** Wire "Mark as messaged + log" to call it; optimistic UI + toast.
- [ ] **Step 3: Manual verify:** logging creates an Interaction row in Notion and flips status.
- [ ] **Step 4: Commit:** `git commit -am "feat: log interaction + status update on send"`.

### Task 5.4: Follow-up mode

**Files:** Create `src/lib/message/followup.ts`, `src/app/api/followup/route.ts`; add a follow-up panel to the message screen.

- [ ] **Step 1:** Port `_build_followup_prompt` (uses `event.followup_examples`, Du/Sie, 1–3 sentences, no re-pitch). `POST /api/followup` `{ contactId, reply, anrede }` → generate short reply.
- [ ] **Step 2:** UI: enter the contact's reply → draft → Copy + log Interaction (`Next Action: Await further response`); if reply positive (keyword check: spannend/interessant/gerne/...), offer **Pipeline Stage → Engaged**.
- [ ] **Step 3: Commit:** `git commit -am "feat: follow-up reply generator + optional Engaged promotion"`.

---

## Phase 6 — Screenshots (vision) batch

### Task 6.1: Vision extraction

**Files:** Create `src/lib/extraction/screenshot.ts`; Test `tests/screenshot-parse.test.ts`.

- [ ] **Step 1: Failing test** — `parseScreenshotJson(raw)` returns `[{name, job_title, company}]`, strips fences, returns `[]` for empty, throws on invalid (port of the Python `extract_contacts_from_image` parsing contract).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement parser + `extractFromImage(base64, apiKey)` calling gpt-4o vision with the Python system prompt (spec §6.5 / Python improvements spec). Reuse that exact prompt.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit:** `git commit -am "feat: screenshot vision extraction + parser"`.

### Task 6.2: Screenshots screen + create API

**Files:** Create `src/app/api/screenshots/route.ts`, `src/app/(app)/screenshots/page.tsx`.

- [ ] **Step 1:** `POST /api/screenshots` (multipart or base64 list) → for each image, `extractFromImage` → return combined extracted rows (no Notion writes yet).
- [ ] **Step 2:** Screen: drag/drop images → call API → **editable preview table** → on confirm, POST each row to `/api/contacts` (status `request_sent`, no URL, note "URL not yet captured", dedupe by name → merge path reused).
- [ ] **Step 3: Manual verify:** a real "Sent Invitations" screenshot creates reviewed contacts.
- [ ] **Step 4: Commit:** `git commit -am "feat: in-app screenshot batch capture (instant)"`.

---

## Phase 7 — Contacts table, Pipeline board, Dashboard

### Task 7.1: Contacts table

**Files:** Create `src/app/(app)/contacts/page.tsx`, `src/app/api/contacts/list/route.ts`.

- [ ] **Step 1:** `GET /api/contacts/list?stage=&tier=&owner=&q=` → paginated, mapped `Contact[]`.
- [ ] **Step 2:** Table with filters/search (shadcn `Table`); row click → side `Dialog` with details + "Write message" link. Inline edit of Stage/Tier/Status → PATCH to a small update endpoint (with confirm for Stage, per spec).
- [ ] **Step 3: Commit:** `git commit -am "feat: contacts table with filters + side panel"`.

### Task 7.2: Pipeline board

**Files:** Create `src/app/(app)/pipeline/page.tsx`.

- [ ] **Step 1:** 5 columns (Awareness→Activated); cards from the Contacts list. Drag → confirm dialog → PATCH `Pipeline Stage`. (Use a lightweight DnD: HTML5 drag events or `@dnd-kit/core`.)
- [ ] **Step 2: Commit:** `git commit -am "feat: pipeline kanban board with confirmed stage moves"`.

### Task 7.3: Dashboard

**Files:** Create `src/app/(app)/pipeline/page.tsx` dashboard tab or `src/app/(app)/dashboard/page.tsx`, `src/app/api/stats/route.ts`.

- [ ] **Step 1:** `GET /api/stats` → aggregate counts by stage/tier/source/month (port of `generate_dashboard` aggregation).
- [ ] **Step 2:** Render charts (Recharts). 
- [ ] **Step 3: Commit:** `git commit -am "feat: live pipeline dashboard"`.

---

## Phase 8 — Deploy + onboarding

### Task 8.1: Vercel deploy

- [ ] **Step 1:** Push the repo to GitHub (private). In Vercel: import the repo, set env vars from `.env.example` (NOTION_TOKEN, all DB ids, OPENAI_API_KEY, APP_PASSWORD, AUTH_SECRET). Deploy.
- [ ] **Step 2:** Substitute the real deploy URL into `public/bookmarklet.html` and the bookmarklet source; redeploy.
- [ ] **Step 3:** Smoke test the full loop on the deployed URL: login → add (bookmarklet) → message (3 variants) → log → today queue updates.

### Task 8.2: Team onboarding doc

- [ ] **Step 1:** Write `docs/team-quickstart.md`: the app URL, the shared password, how to install the bookmarklet (drag from `/bookmarklet.html`), the daily loop, and the phone-pending-request workflow. Keep it non-technical.
- [ ] **Step 2: Commit + done.**

---

## Phase 9 (fast-follow, not v1) — Reject analytics

Per spec §8: periodic screenshot snapshots + reconciliation against the Connections.csv import to derive "No Response" outcomes; a small analytics view ("who ignores us, by seniority/company"). Plan this as its own spec+plan once snapshots accumulate. Add `No Response`/`Withdrawn` to the status options and a `Request Sent Date` field first.

---

## Self-Review (completed against the spec)

- **Spec coverage:** §4 architecture → Phases 0–2; §6.1 Today → 2.3; §6.2 Add + bookmarklet → 3.2/3.3; §6.3 Messages(3 variants) → 5.1/5.2; §6.4 follow-up → 5.4; §6.5 screenshots → Phase 6; §6.6 contacts/pipeline/dashboard → Phase 7; §7 ingestion (authored-only) → Phase 4 (with the two fixtures); §8 reject analytics → Phase 9; §10 auth → Phase 1; §11 errors → retry (2.1), merge cards (3.2), vision preview (6.2), 501 fallback (4.3); §12 testing → TDD tasks throughout; §13 relationship to Python → config port (0.2), automation untouched. No uncovered requirement found.
- **Placeholder scan:** code steps contain real code; UI scaffolding steps give exact commands + acceptance criteria (framework boilerplate intentionally generated by `create-next-app`/`shadcn`, not transcribed). No "TBD/TODO/handle edge cases".
- **Type consistency:** `ExtractedProfile` (4.1) is consumed unchanged in 4.2/5.2; `Contact`/`OutreachStatus` (2.2) used in 2.3/3.x/5.x/7.x; `pageToContact`, `findByUrl`, `findByName`, `resolveMerge`, `parseExtraction`, `parseVariants` names are stable across tasks.
