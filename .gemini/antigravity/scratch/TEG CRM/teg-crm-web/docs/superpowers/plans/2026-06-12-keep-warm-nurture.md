# Keep-Warm Nurture Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a relationship-nurture loop to teg-crm-web so high-value LinkedIn connections (future speakers, sponsors, mentors) are flagged, periodically resurfaced for light-touch contact, and findable when a matching event comes up — instead of rotting in the Contacts table after their event cycle ends.

**Architecture:** All keep-warm state lives as four additive fields on the existing Notion Contacts DB (Notion stays the single source of truth shared with the Python repo). The web app adds: a flag UI, a fifth Today-queue bucket driven by `Next Touch Date`, a `/relationships` shared-pool page (shortlists by category, original connector always visible), a nurture mode for the message generator, plus (Phase 2) rule-based + AI suggestion scanning into a human-confirm queue, and (Phase 3) AI event-matching.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind + shadcn/ui, `@notionhq/client`, Gemini 2.0 Flash with gpt-4o-mini fallback (existing pattern), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-12-keep-warm-nurture-design.md` — read it first.

**Repo conventions that apply (from CLAUDE.md):**
- TDD mandatory for `src/lib/**` — failing test first, every time.
- All Notion/AI calls server-side only, always through `withRetry`.
- Enrichment non-destructive; conventional commits; `npm test` after every `src/lib/**` change; `npm run build` before deploy.

**File map:**

| File | Status | Responsibility |
|---|---|---|
| `src/lib/types.ts` | modify | `KeepWarmStatus` type + 4 new `Contact` fields |
| `src/lib/notion/map.ts` | modify | parse the 4 new Notion props |
| `src/lib/keepwarm.ts` | create | cadence math, categories, snooze constants |
| `src/lib/keepwarm-rules.ts` | create (Phase 2) | rule matcher |
| `src/lib/keepwarm-suggest.ts` | create (Phase 2) | AI scan prompt + response parser |
| `src/lib/keepwarm-match.ts` | create (Phase 3) | event-match prompt + parser |
| `src/lib/message/nurture.ts` | create | nurture system prompt + user message |
| `src/lib/message/generate.ts` | modify | `mode` parameter |
| `src/lib/notion/contacts.ts` | modify | `keepWarmDue` bucket |
| `src/app/api/contacts/[id]/keepwarm/route.ts` | create | PATCH all keep-warm fields |
| `src/app/api/keepwarm/scan/route.ts` | create (Phase 2) | rules + AI suggestion scan |
| `src/app/api/keepwarm/match/route.ts` | create (Phase 3) | event-match ranking |
| `src/app/api/message/route.ts` | modify | accept `mode` |
| `src/app/api/interactions/route.ts` | modify | bump Next Touch Date on touch |
| `src/app/(app)/relationships/page.tsx` | create | shared pool / shortlist page |
| `src/components/KeepWarmSection.tsx` | create | flag UI inside contact detail |
| `src/components/KeepWarmRowActions.tsx` | create | row actions (touch/snooze/drop/confirm) |
| `src/components/KeepWarmScanButton.tsx` | create (Phase 2) | trigger scan |
| `src/components/EventMatchPanel.tsx` | create (Phase 3) | event-match UI |
| `src/app/(app)/contacts/page.tsx` | modify | embed KeepWarmSection |
| `src/app/(app)/today/page.tsx` | modify | fifth bucket |
| `src/app/(app)/messages/[contactId]/page.tsx` | modify | nurture mode param |
| `src/app/(app)/layout.tsx` | modify | nav entry |
| `config/keepwarm-rules.json` | create (Phase 2) | seniority keywords + target companies |
| `tests/keepwarm.test.ts` etc. | create | unit tests |

---

# PHASE 1 — The leak-stopper

### Task 0: Manual Notion schema setup (no code)

**One-time, in the Notion UI, on the Contacts database.** Exact names matter — they are the API contract.

- [ ] **Step 1:** Add property `Keep Warm Status` — type **Select**, options: `Suggested`, `Active`, `Snoozed`, `Dropped` (leave default empty).
- [ ] **Step 2:** Add property `Keep Warm Category` — type **Multi-select**, options: `Future Speaker`, `Sponsor/Partner`, `Mentor/Expert`, `VIP Guest`, `Other`.
- [ ] **Step 3:** Add property `Keep Warm Reason` — type **Text** (rich text).
- [ ] **Step 4:** Add property `Next Touch Date` — type **Date**.
- [ ] **Step 5:** Verify with a quick manual test: set one contact to `Active` with a reason in Notion, then continue (Task 1's mapping test uses fixtures, but the live fields must exist before deploying).

---

### Task 1: Contact type + Notion mapping for keep-warm fields

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/notion/map.ts`
- Test: `tests/notion-map.test.ts`

- [ ] **Step 1: Write the failing test** — in `tests/notion-map.test.ts`, add the four new properties to the existing `fullPage` fixture's `properties` object:

```ts
    "Keep Warm Status": { type: "select", select: { name: "Active" } },
    "Keep Warm Category": {
      type: "multi_select",
      multi_select: [{ name: "Future Speaker" }, { name: "Mentor/Expert" }],
    },
    "Keep Warm Reason": {
      type: "rich_text",
      rich_text: [{ plain_text: "Partner at BCG, GenAI strategy talk" }],
    },
    "Next Touch Date": { type: "date", date: { start: "2026-09-10" } },
```

And to the `emptyPage` fixture:

```ts
    "Keep Warm Status": { type: "select", select: null },
    "Keep Warm Category": { type: "multi_select", multi_select: [] },
    "Keep Warm Reason": { type: "rich_text", rich_text: [] },
    "Next Touch Date": { type: "date", date: null },
```

Add assertions inside the existing `"extracts all fields from a full page"` test:

```ts
    expect(c.keepWarmStatus).toBe("Active");
    expect(c.keepWarmCategories).toEqual(["Future Speaker", "Mentor/Expert"]);
    expect(c.keepWarmReason).toBe("Partner at BCG, GenAI strategy talk");
    expect(c.nextTouchDate).toBe("2026-09-10");
```

And inside `"returns empty strings (not undefined) for missing optional fields"`:

```ts
    expect(c.keepWarmStatus).toBe("");
    expect(c.keepWarmCategories).toEqual([]);
    expect(c.keepWarmReason).toBe("");
    expect(c.nextTouchDate).toBe("");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/notion-map.test.ts`
Expected: FAIL — `keepWarmStatus` is `undefined`.

- [ ] **Step 3: Extend the types** — in `src/lib/types.ts`, add above the `Contact` interface:

```ts
export type KeepWarmStatus = "" | "Suggested" | "Active" | "Snoozed" | "Dropped";
```

And add to the `Contact` interface (after `events?: string[];`):

```ts
  keepWarmStatus: KeepWarmStatus | string;
  keepWarmCategories: string[];
  keepWarmReason: string;
  nextTouchDate: string;
```

- [ ] **Step 4: Extend the mapper** — in `src/lib/notion/map.ts`, inside `pageToContact`, add after the `events` extraction:

```ts
  const kwCatProp = p["Keep Warm Category"];
  const keepWarmCategories =
    kwCatProp?.type === "multi_select"
      ? kwCatProp.multi_select.map((o) => o.name)
      : [];
```

And add to the returned object (after `events: ...`):

```ts
    keepWarmStatus: getText(p, "Keep Warm Status"),
    keepWarmCategories,
    keepWarmReason: getText(p, "Keep Warm Reason"),
    nextTouchDate: getText(p, "Next Touch Date"),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS (the full suite — other tests construct `Contact` objects; if any fail on the new required fields, add the four fields with empty defaults to those fixtures).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/notion/map.ts tests/notion-map.test.ts
git commit -m "feat(keepwarm): add keep-warm fields to Contact type and Notion mapping"
```

---

### Task 2: Cadence domain logic

**Files:**
- Create: `src/lib/keepwarm.ts`
- Test: `tests/keepwarm.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/keepwarm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  addDaysIso,
  isTouchDue,
  KEEP_WARM_CADENCE_DAYS,
  KEEP_WARM_CATEGORIES,
  SNOOZE_OPTIONS,
} from "../src/lib/keepwarm";

describe("addDaysIso", () => {
  it("adds days within a month", () => {
    expect(addDaysIso("2026-06-01", 10)).toBe("2026-06-11");
  });
  it("rolls over months and the default cadence", () => {
    expect(addDaysIso("2026-06-12", KEEP_WARM_CADENCE_DAYS)).toBe("2026-09-10");
  });
  it("rolls over years", () => {
    expect(addDaysIso("2026-12-15", 30)).toBe("2027-01-14");
  });
});

describe("isTouchDue", () => {
  it("is due when next touch is today", () => {
    expect(isTouchDue("2026-06-12", "2026-06-12")).toBe(true);
  });
  it("is due when next touch is past", () => {
    expect(isTouchDue("2026-06-01", "2026-06-12")).toBe(true);
  });
  it("is not due when next touch is in the future", () => {
    expect(isTouchDue("2026-07-01", "2026-06-12")).toBe(false);
  });
  it("is never due without a date", () => {
    expect(isTouchDue("", "2026-06-12")).toBe(false);
  });
});

describe("constants", () => {
  it("exposes the locked category list", () => {
    expect(KEEP_WARM_CATEGORIES).toEqual([
      "Future Speaker",
      "Sponsor/Partner",
      "Mentor/Expert",
      "VIP Guest",
      "Other",
    ]);
  });
  it("exposes snooze options", () => {
    expect(SNOOZE_OPTIONS).toEqual([30, 90, 180]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/keepwarm.test.ts`
Expected: FAIL — cannot resolve `../src/lib/keepwarm`.

- [ ] **Step 3: Implement** — create `src/lib/keepwarm.ts`:

```ts
/**
 * Keep-warm nurture domain logic.
 * A contact with `Keep Warm Status = Active` and `Next Touch Date <= today`
 * is due for a light-touch contact. Dates are ISO date strings (YYYY-MM-DD),
 * which compare correctly as strings.
 */

export const KEEP_WARM_CADENCE_DAYS = 90;

export const SNOOZE_OPTIONS = [30, 90, 180] as const;

export const KEEP_WARM_CATEGORIES = [
  "Future Speaker",
  "Sponsor/Partner",
  "Mentor/Expert",
  "VIP Guest",
  "Other",
] as const;

export const KEEP_WARM_STATUSES = ["Suggested", "Active", "Snoozed", "Dropped"] as const;

/** Adds `days` to an ISO date string, UTC-safe. */
export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(`${fromIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/** Today as an ISO date string. */
export function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

/** Default next touch date counted from today. */
export function nextTouchFromToday(days: number = KEEP_WARM_CADENCE_DAYS): string {
  return addDaysIso(todayIso(), days);
}

/** A touch is due when the next-touch date exists and is today or earlier. */
export function isTouchDue(nextTouchDate: string, today: string): boolean {
  if (!nextTouchDate) return false;
  return nextTouchDate <= today;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/keepwarm.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/keepwarm.ts tests/keepwarm.test.ts
git commit -m "feat(keepwarm): cadence math and category/snooze constants"
```

---

### Task 3: Keep-warm PATCH API route

**Files:**
- Create: `src/app/api/contacts/[id]/keepwarm/route.ts`

No unit test (thin route handler, follows existing route conventions — logic lives in `src/lib/keepwarm.ts` which is tested).

- [ ] **Step 1: Implement** — create `src/app/api/contacts/[id]/keepwarm/route.ts`:

```ts
import { NextResponse } from "next/server";
import { notion, withRetry } from "@/lib/notion/client";
import { select, multiSelect, richText, date } from "@/lib/notion/props";
import {
  KEEP_WARM_CATEGORIES,
  KEEP_WARM_STATUSES,
  nextTouchFromToday,
} from "@/lib/keepwarm";

const VALID_STATUSES = new Set<string>(KEEP_WARM_STATUSES);
const VALID_CATEGORIES = new Set<string>(KEEP_WARM_CATEGORIES);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, categories, reason, nextTouchDate } = body as {
    status?: string;
    categories?: string[];
    reason?: string;
    nextTouchDate?: string;
  };

  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` },
      { status: 400 }
    );
  }
  if (categories !== undefined) {
    if (!Array.isArray(categories) || categories.some((c) => !VALID_CATEGORIES.has(c))) {
      return NextResponse.json(
        { error: `categories must be a subset of: ${[...VALID_CATEGORIES].join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Activating without an explicit date starts the default 90-day cadence.
  const resolvedNextTouch =
    nextTouchDate?.trim() || (status === "Active" ? nextTouchFromToday() : "");

  const properties: Record<string, unknown> = {
    "Keep Warm Status": select(status),
  };
  if (categories !== undefined) properties["Keep Warm Category"] = multiSelect(categories);
  if (reason !== undefined) properties["Keep Warm Reason"] = richText(reason);
  if (resolvedNextTouch) properties["Next Touch Date"] = date(resolvedNextTouch);

  try {
    await withRetry(() =>
      notion().pages.update({
        page_id: id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: properties as any,
      })
    );
    return NextResponse.json({ ok: true, nextTouchDate: resolvedNextTouch || null });
  } catch (e) {
    console.error("[contacts/keepwarm]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/contacts/[id]/keepwarm/route.ts"
git commit -m "feat(keepwarm): PATCH route writing all keep-warm fields in one update"
```

---

### Task 4: Flag UI — KeepWarmSection in the contact detail dialog

**Files:**
- Create: `src/components/KeepWarmSection.tsx`
- Modify: `src/app/(app)/contacts/page.tsx`

- [ ] **Step 1: Create the component** — `src/components/KeepWarmSection.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KEEP_WARM_CATEGORIES } from "@/lib/keepwarm";
import type { Contact } from "@/lib/types";

interface Props {
  contact: Contact;
  onUpdated: (updated: Contact) => void;
}

/**
 * Inline keep-warm flag editor for the contact detail dialog.
 * Saving with status "Active" lets the server start the 90-day cadence.
 */
export function KeepWarmSection({ contact, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>(contact.keepWarmCategories ?? []);
  const [reason, setReason] = useState(contact.keepWarmReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = contact.keepWarmStatus;
  const inPool = status === "Active" || status === "Snoozed" || status === "Suggested";

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function save(newStatus: "Active" | "Dropped") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/keepwarm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, categories, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onUpdated({
        ...contact,
        keepWarmStatus: newStatus,
        keepWarmCategories: categories,
        keepWarmReason: reason,
        nextTouchDate: data.nextTouchDate ?? contact.nextTouchDate,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5" />
          Keep Warm
          {inPool && (
            <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium normal-case tracking-normal">
              {status}
            </span>
          )}
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {inPool ? "Edit" : "Flag"}
        </Button>
      </div>

      {inPool && !open && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {contact.keepWarmCategories.length > 0 && (
            <p>{contact.keepWarmCategories.join(" · ")}</p>
          )}
          {contact.keepWarmReason && <p>{contact.keepWarmReason}</p>}
          {contact.nextTouchDate && <p>Next touch: {contact.nextTouchDate}</p>}
        </div>
      )}

      {open && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {KEEP_WARM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                  categories.includes(cat)
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-background text-muted-foreground border-border hover:border-amber-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Why is this person valuable? e.g. "Partner at BCG, GenAI strategy talk"'
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring resize-y"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={() => save("Active")}>
              {inPool ? "Save" : "Keep warm"}
            </Button>
            {inPool && (
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => save("Dropped")}>
                Drop from pool
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Embed it in the contact detail** — in `src/app/(app)/contacts/page.tsx`:

Add the import near the other imports:

```tsx
import { KeepWarmSection } from "@/components/KeepWarmSection";
```

In the `ContactDetail` component, insert this line between the closing `</div>` of the "Inline edit: Outreach Status" block and the `<div className="flex gap-2 pt-2">` action-links block:

```tsx
      <KeepWarmSection contact={contact} onUpdated={onUpdated} />
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev` — open `/contacts`, click a contact, flag it Keep Warm with a category + reason, save. Check in Notion that `Keep Warm Status = Active`, categories/reason set, and `Next Touch Date` ≈ today + 90 days.

- [ ] **Step 4: Commit**

```bash
git add src/components/KeepWarmSection.tsx "src/app/(app)/contacts/page.tsx"
git commit -m "feat(keepwarm): flag UI in contact detail dialog"
```

---

### Task 5: "Keep Warm — touch due" bucket in the Today queue

**Files:**
- Modify: `src/lib/notion/contacts.ts`
- Modify: `src/app/(app)/today/page.tsx`

- [ ] **Step 1: Extend the bucket interface and query** — in `src/lib/notion/contacts.ts`:

Add to the `TodayBuckets` interface:

```ts
  keepWarmDue: Contact[];     // Keep Warm Active AND Next Touch Date <= today
```

In `getTodayBuckets`, add after the Bucket 4 query:

```ts
  // Bucket 5: Keep-warm touches due (shared pool — intentionally NOT owner-filtered,
  // every rep should see them; the original connector is shown on the row)
  const keepWarmDue = await queryAll(dbId, {
    and: [
      { property: "Keep Warm Status", select: { equals: "Active" } },
      { property: "Next Touch Date", date: { on_or_before: today } },
    ],
  });
```

And add to the returned object (note: NOT wrapped in `byOwner`):

```ts
    keepWarmDue,
```

- [ ] **Step 2: Render the bucket** — in `src/app/(app)/today/page.tsx`:

Add `hrefQuery` support. Change the `BucketConfig` interface to:

```tsx
interface BucketConfig {
  key: keyof TodayBuckets;
  label: string;
  badgeClass: string;
  actionLabel: string;
  hrefQuery?: string;
}
```

Append to the `BUCKETS` array:

```tsx
  {
    key: "keepWarmDue",
    label: "Keep Warm — Touch Due",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    actionLabel: "Touch Base",
    hrefQuery: "?mode=nurture",
  },
```

Change `ContactRow` to accept and use the query string:

```tsx
function ContactRow({
  contact,
  actionLabel,
  hrefQuery,
}: {
  contact: Contact;
  actionLabel: string;
  hrefQuery?: string;
}) {
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(" · ") || "—";
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{contact.name || "Unnamed"}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <Link
        href={`/messages/${contact.id}${hrefQuery ?? ""}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
```

And pass it through in `BucketSection`:

```tsx
        {contacts.map((c) => (
          <ContactRow key={c.id} contact={c} actionLabel={config.actionLabel} hrefQuery={config.hrefQuery} />
        ))}
```

- [ ] **Step 3: Run tests + build**

Run: `npm test` then `npm run build`
Expected: PASS / compiles. (If any test constructs a `TodayBuckets` literal, add `keepWarmDue: []`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/notion/contacts.ts "src/app/(app)/today/page.tsx"
git commit -m "feat(keepwarm): keep-warm touch-due bucket in Today queue"
```

---

### Task 6: Nurture message mode

**Files:**
- Create: `src/lib/message/nurture.ts`
- Modify: `src/lib/message/generate.ts`
- Modify: `src/app/api/message/route.ts`
- Modify: `src/app/(app)/messages/[contactId]/page.tsx`
- Test: `tests/nurture-prompt.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/nurture-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildNurturePrompt, buildNurtureUserMessage } from "../src/lib/message/nurture";
import { getEvent } from "../src/lib/config";
import type { Contact } from "../src/lib/types";

const contact: Contact = {
  id: "c1",
  name: "Anna Müller",
  linkedinUrl: "https://linkedin.com/in/anna",
  jobTitle: "Partner",
  company: "BCG",
  tier: "Tier 1",
  pipelineStage: "Engaged",
  outreachStatus: "Messaged",
  outreachOwner: "Jonas",
  lastContactDate: "2026-03-01",
  followUpDueDate: "",
  followUpOwner: "",
  followUpComplete: false,
  notes: "",
  keepWarmStatus: "Active",
  keepWarmCategories: ["Future Speaker"],
  keepWarmReason: "GenAI strategy expertise, great speaker potential",
  nextTouchDate: "2026-06-12",
};

describe("buildNurturePrompt", () => {
  const prompt = buildNurturePrompt(getEvent());

  it("forbids event invites and links", () => {
    expect(prompt).toContain("KEINE Event-Einladung");
    expect(prompt).toContain("KEIN Link");
  });

  it("demands the parseable 3-variant output format", () => {
    expect(prompt).toContain("**Fit-Rating:**");
    expect(prompt).toContain("**Ansprache:**");
    expect(prompt).toContain("**Variante 1 —");
    expect(prompt).toContain("**Variante 3 —");
  });
});

describe("buildNurtureUserMessage", () => {
  it("includes the keep-warm reason and last contact", () => {
    const msg = buildNurtureUserMessage(contact, "");
    expect(msg).toContain("Anna Müller");
    expect(msg).toContain("GenAI strategy expertise");
    expect(msg).toContain("Future Speaker");
    expect(msg).toContain("2026-03-01");
  });

  it("prefers pasted profile text over fallback fields", () => {
    const msg = buildNurtureUserMessage(contact, "PROFILE TEXT HERE");
    expect(msg).toContain("PROFILE TEXT HERE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/nurture-prompt.test.ts`
Expected: FAIL — cannot resolve `../src/lib/message/nurture`.

- [ ] **Step 3: Implement the prompt builders** — create `src/lib/message/nurture.ts`:

```ts
import type { EventConfig } from "../config";
import type { Contact } from "../types";

/**
 * System prompt for keep-warm nurture messages.
 * Output format intentionally matches the invite prompt so the existing
 * parseResponse (parse.ts) works unchanged.
 */
export function buildNurturePrompt(event: EventConfig): string {
  return `Du bist ein Relationship-Assistent für TEG - The Entrepreneurial Group (TUM-Studierendenclub, Organisator von Events wie ${event.name}).

Deine Aufgabe: kurze, natürlich klingende LinkedIn-Nachrichten, um eine bestehende wertvolle Verbindung warmzuhalten — es geht um die Beziehung, NICHT um ein Event.

HARTE REGELN:
- KEINE Event-Einladung, KEIN Verkauf, KEIN Link in der Nachricht.
- Maximal 3 Sätze pro Nachricht. Wie von einer echten Person in 30 Sekunden getippt.
- Beziehe dich konkret auf Profil/Notizen/Keep-Warm-Grund der Person (Thema, Rolle, Firma). Niemals Fakten erfinden.
- Gute Winkel: ehrliche Frage zu ihrem Fachthema, Glückwunsch zu erkennbaren Neuigkeiten, kurzes TEG-Update mit Bezug zu ihrem Thema, Anknüpfung an den letzten Austausch.
- Du/Sie passend zur Person (Beratung senior = Sie, im Zweifel Sie).

ANTWORTFORMAT (exakt einhalten):
**Fit-Rating:** <1-5>/5
**Senioritäts-Check:**
<eine Zeile zur Einschätzung der Person>
**Ansprache:** Du oder Sie
**Variante 1 — <Winkel>:**
<Nachricht>
**Variante 2 — <Winkel>:**
<Nachricht>
**Variante 3 — <Winkel>:**
<Nachricht>`;
}

/** User message carrying the contact's keep-warm context. */
export function buildNurtureUserMessage(contact: Contact, profileText: string): string {
  const fallback = `Job Title: ${contact.jobTitle || "—"}\nNotes: ${contact.notes || "—"}`;
  return `Name: ${contact.name}

Warum wertvoll (Keep-Warm-Grund): ${contact.keepWarmReason || "—"}
Kategorien: ${contact.keepWarmCategories.length > 0 ? contact.keepWarmCategories.join(", ") : "—"}
Letzter Kontakt: ${contact.lastContactDate || "unbekannt"}

Profil-Infos:
${profileText || fallback}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/nurture-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Thread `mode` through the generator** — replace the full contents of `src/lib/message/generate.ts` with:

```ts
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildSystemPrompt } from "./systemPrompt";
import { buildNurturePrompt, buildNurtureUserMessage } from "./nurture";
import { parseResponse, type ParsedMessage } from "./parse";
import { getEvent, utmFor } from "../config";
import type { Contact } from "../types";

export type MessageMode = "invite" | "nurture";

function buildUserMessage(contact: Contact, profileText: string, owner: string): string {
  const event = getEvent();
  const utm = utmFor(owner);
  const inviteUrl = `${event.luma_url}&utm_source=${utm}`;
  return `Name: ${contact.name}

Profil-Infos:
${profileText || `Job Title: ${contact.jobTitle || "—"}\nNotes: ${contact.notes || "—"}`}

Einladungslink für diese Nachricht: ${inviteUrl}`;
}

function buildPrompts(
  contact: Contact,
  profileText: string,
  owner: string,
  mode: MessageMode
): { systemPrompt: string; userMessage: string } {
  const event = getEvent();
  if (mode === "nurture") {
    return {
      systemPrompt: buildNurturePrompt(event),
      userMessage: buildNurtureUserMessage(contact, profileText),
    };
  }
  return {
    systemPrompt: buildSystemPrompt(event),
    userMessage: buildUserMessage(contact, profileText, owner),
  };
}

async function generateWithGemini(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<ParsedMessage | null> {
  try {
    console.log("[message/gemini] Calling gemini-2.0-flash...");
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });
    const response = await model.generateContent(userMessage);
    const text = response.response.text();
    console.log("[message/gemini] Success, parsing response...");
    return parseResponse(text);
  } catch (e) {
    console.error("[message/gemini] Error:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function generateWithOpenAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<ParsedMessage> {
  console.log("[message/openai] Calling gpt-4o-mini fallback...");
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return parseResponse(resp.choices[0].message.content ?? "");
}

export async function generateMessage(
  contact: Contact,
  profileText: string,
  owner: string,
  geminiKey: string,
  openaiKey: string,
  mode: MessageMode = "invite"
): Promise<ParsedMessage> {
  const { systemPrompt, userMessage } = buildPrompts(contact, profileText, owner, mode);

  if (geminiKey) {
    const result = await generateWithGemini(systemPrompt, userMessage, geminiKey);
    if (result !== null) return result;
  }

  if (openaiKey) {
    return generateWithOpenAI(systemPrompt, userMessage, openaiKey);
  }

  throw new Error("No AI provider available — set GEMINI_API_KEY or OPENAI_API_KEY");
}
```

- [ ] **Step 6: Accept `mode` in the API route** — in `src/app/api/message/route.ts`:

Change the body destructuring to:

```ts
  const { contactId, profileText, owner, mode } = body as {
    contactId?: string;
    profileText?: string;
    owner?: string;
    mode?: string;
  };
```

And change the `generateMessage` call to:

```ts
    const result = await generateMessage(
      contact,
      profileText?.trim() ?? "",
      owner?.trim() ?? "",
      geminiKey,
      openaiKey,
      mode === "nurture" ? "nurture" : "invite"
    );
```

- [ ] **Step 7: Pass mode from the messages page** — in `src/app/(app)/messages/[contactId]/page.tsx`, inside `MessageInner` (which already calls `useSearchParams()`):

Add after the `const searchParams = useSearchParams();` line:

```tsx
  const mode = searchParams.get("mode") === "nurture" ? "nurture" : "invite";
```

In the `generate()` function, change the fetch body line to:

```tsx
        body: JSON.stringify({ contactId, profileText: profileText.trim() || undefined, owner: owner.trim() || undefined, mode }),
```

Near the top of the rendered output (next to the page heading), add a badge so the rep knows which mode they're in:

```tsx
      {mode === "nurture" && (
        <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-medium">
          Nurture mode — relationship touch, no event pitch
        </span>
      )}
```

- [ ] **Step 8: Run tests + build, verify manually**

Run: `npm test` then `npm run build` — expected: PASS / compiles.
Manual: open a keep-warm contact via `/messages/<id>?mode=nurture`, generate — the 3 variants must contain no event invite and no link.

- [ ] **Step 9: Commit**

```bash
git add src/lib/message/nurture.ts src/lib/message/generate.ts src/app/api/message/route.ts "src/app/(app)/messages/[contactId]/page.tsx" tests/nurture-prompt.test.ts
git commit -m "feat(keepwarm): nurture message mode (no pitch, no link)"
```

---

### Task 7: Relationships page (shared pool + shortlists) and nav

**Files:**
- Create: `src/app/(app)/relationships/page.tsx`
- Create: `src/components/KeepWarmRowActions.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create the row-actions client component** — `src/components/KeepWarmRowActions.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDaysIso, todayIso, SNOOZE_OPTIONS } from "@/lib/keepwarm";

interface Props {
  contactId: string;
  status: string;
}

/** Row actions on the Relationships page. router.refresh() re-renders the server page. */
export function KeepWarmRowActions({ contactId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/contacts/${contactId}/keepwarm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status === "Suggested") {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" disabled={busy} onClick={() => patch({ status: "Active" })}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => patch({ status: "Dropped" })}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/messages/${contactId}?mode=nurture`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Touch base
      </Link>
      <select
        className="border rounded px-1.5 py-1 text-xs bg-background"
        disabled={busy}
        defaultValue=""
        onChange={(e) => {
          const days = parseInt(e.target.value, 10);
          if (days) {
            patch({ status: "Snoozed", nextTouchDate: addDaysIso(todayIso(), days) });
          }
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          Snooze…
        </option>
        {SNOOZE_OPTIONS.map((d) => (
          <option key={d} value={d}>
            +{d}d
          </option>
        ))}
      </select>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => patch({ status: "Dropped" })}>
        Drop
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create the page** — `src/app/(app)/relationships/page.tsx` (server component, same error pattern as Today):

```tsx
import { queryAll } from "@/lib/notion/contacts";
import { env } from "@/lib/env";
import { todayIso, isTouchDue, KEEP_WARM_CATEGORIES } from "@/lib/keepwarm";
import type { Contact } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeepWarmRowActions } from "@/components/KeepWarmRowActions";

export const dynamic = "force-dynamic";

async function getKeepWarmPool(): Promise<Contact[]> {
  return queryAll(env.contactsDb(), {
    or: [
      { property: "Keep Warm Status", select: { equals: "Active" } },
      { property: "Keep Warm Status", select: { equals: "Snoozed" } },
      { property: "Keep Warm Status", select: { equals: "Suggested" } },
    ],
  });
}

function Row({ contact, today }: { contact: Contact; today: string }) {
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(" · ") || "—";
  const overdue = isTouchDue(contact.nextTouchDate, today);
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-0">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-sm truncate">{contact.name || "Unnamed"}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        {contact.keepWarmReason && (
          <p className="text-xs text-muted-foreground italic truncate">{contact.keepWarmReason}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Connected by <span className="font-medium">{contact.outreachOwner || "—"}</span>
          {contact.lastContactDate && <> · last touch {contact.lastContactDate}</>}
          {contact.nextTouchDate && (
            <>
              {" · next touch "}
              <span className={overdue ? "text-destructive font-medium" : ""}>
                {contact.nextTouchDate}
              </span>
            </>
          )}
          {contact.keepWarmStatus === "Snoozed" && <> · snoozed</>}
        </p>
      </div>
      <KeepWarmRowActions contactId={contact.id} status={contact.keepWarmStatus} />
    </div>
  );
}

export default async function RelationshipsPage() {
  const today = todayIso();

  let pool: Contact[] | null = null;
  let errorMsg: string | null = null;
  try {
    pool = await getKeepWarmPool();
  } catch (e) {
    console.error("[relationships page]", e);
    errorMsg = e instanceof Error ? e.message : "Could not reach Notion. Check your env vars.";
  }

  const suggested = (pool ?? []).filter((c) => c.keepWarmStatus === "Suggested");
  const active = (pool ?? []).filter((c) => c.keepWarmStatus !== "Suggested");

  // Group by category for the shortlist view; a contact with two categories
  // appears in both groups. Uncategorized contacts get their own group.
  const groups: { category: string; contacts: Contact[] }[] = [];
  for (const category of KEEP_WARM_CATEGORIES) {
    const contacts = active.filter((c) => c.keepWarmCategories.includes(category));
    if (contacts.length > 0) groups.push({ category, contacts });
  }
  const uncategorized = active.filter((c) => c.keepWarmCategories.length === 0);
  if (uncategorized.length > 0) groups.push({ category: "Uncategorized", contacts: uncategorized });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Keep Warm</h1>
        <p className="text-sm text-muted-foreground">
          Shared pool of high-value connections. Anyone can act; the original connector is shown
          so the personal follow-up comes from the right account.
        </p>
      </div>

      {errorMsg && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-medium">Failed to load</p>
            <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
          </CardContent>
        </Card>
      )}

      {suggested.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Suggested — confirm or dismiss</span>
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                {suggested.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggested.map((c) => (
              <Row key={c.id} contact={c} today={today} />
            ))}
          </CardContent>
        </Card>
      )}

      {pool && active.length === 0 && suggested.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-2xl mb-2">🔥</p>
            <p className="font-medium">No keep-warm contacts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Flag valuable connections from their contact card to build the pool.
            </p>
          </CardContent>
        </Card>
      )}

      {groups.map(({ category, contacts }) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{category}</span>
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                {contacts.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.map((c) => (
              <Row key={c.id} contact={c} today={today} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add the nav entry** — in `src/app/(app)/layout.tsx`:

Add `Flame` to the lucide import:

```tsx
import { Home, UserPlus, MessageSquare, Camera, Users, KanbanSquare, LayoutDashboard, Inbox, Flame } from "lucide-react";
```

Add to the `NAV` array after the Contacts entry:

```tsx
  { href: "/relationships", label: "Keep Warm", icon: Flame },
```

(Leave `MOBILE_NAV` unchanged — 5 slots are taken; the page is reachable via the desktop sidebar and the Today bucket.)

- [ ] **Step 4: Build + verify manually**

Run: `npm run build` — compiles. Then `npm run dev`: `/relationships` shows the contact flagged in Task 4, grouped under its category, with connector + dates; Snooze pushes next touch; Drop removes it from the pool.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/relationships/page.tsx" src/components/KeepWarmRowActions.tsx "src/app/(app)/layout.tsx"
git commit -m "feat(keepwarm): Relationships page with shortlists, snooze/drop, nav entry"
```

---

### Task 8: Bump Next Touch Date when an interaction is logged

**Files:**
- Modify: `src/app/api/interactions/route.ts`

- [ ] **Step 1: Implement** — replace the full contents of `src/app/api/interactions/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import { pageToContact } from "@/lib/notion/map";
import { title, richText, select, date, relation } from "@/lib/notion/props";
import { addDaysIso, KEEP_WARM_CADENCE_DAYS } from "@/lib/keepwarm";

export async function POST(req: Request) {
  const body = await req.json();
  const { contactId, summary, type, nextAction } = body as {
    contactId?: string;
    summary?: string;
    type?: string;
    nextAction?: string;
  };

  if (!contactId?.trim() || !summary?.trim()) {
    return NextResponse.json(
      { error: "contactId and summary are required" },
      { status: 400 }
    );
  }

  const interactionsDb = env.interactionsDb();
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Create Interaction page
    await withRetry(() =>
      notion().pages.create({
        parent: { database_id: interactionsDb },
        properties: {
          Summary: title(summary.trim()),
          Contact: relation(contactId.trim()),
          Date: date(today),
          Type: select(type ?? "LinkedIn Message"),
          ...(nextAction?.trim() ? { "Next Action": richText(nextAction.trim()) } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
    );

    // 2. Check keep-warm state so a logged touch restarts the cadence
    let keepWarmProps: Record<string, unknown> = {};
    try {
      const page = await withRetry(() =>
        notion().pages.retrieve({ page_id: contactId.trim() })
      );
      const contact = pageToContact(page as PageObjectResponse);
      if (contact.keepWarmStatus === "Active" || contact.keepWarmStatus === "Snoozed") {
        keepWarmProps = {
          "Keep Warm Status": select("Active"),
          "Next Touch Date": date(addDaysIso(today, KEEP_WARM_CADENCE_DAYS)),
        };
      }
    } catch (e) {
      // Non-fatal: the interaction is already logged; cadence bump is best-effort.
      console.warn("[interactions] keep-warm check failed:", e);
    }

    // 3. Set Last Contact Date + flip status to Messaged (+ cadence bump if keep-warm)
    await withRetry(() =>
      notion().pages.update({
        page_id: contactId.trim(),
        properties: {
          "Last Contact Date": date(today),
          "LinkedIn Outreach Status": select("Messaged"),
          ...keepWarmProps,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[interactions]", e);
    return NextResponse.json({ error: "Failed to log interaction" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build + verify manually**

Run: `npm run build` — compiles. Manual: log a message for the keep-warm test contact; in Notion, `Next Touch Date` jumps to today + 90 and the contact disappears from the Today keep-warm bucket.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/interactions/route.ts
git commit -m "feat(keepwarm): logged touches restart the 90-day cadence"
```

**Phase 1 done — deploy checkpoint.** Run `npm test && npm run build`, push, verify on Vercel.

---

# PHASE 2 — The safety net (rules + AI suggestions)

### Task 9: Rule-based matcher

**Files:**
- Create: `config/keepwarm-rules.json`
- Create: `src/lib/keepwarm-rules.ts`
- Test: `tests/keepwarm-rules.test.ts`

- [ ] **Step 1: Create the rules config** — `config/keepwarm-rules.json`:

```json
{
  "seniority_keywords": [
    "Partner",
    "Director",
    "Principal",
    "Head of",
    "VP",
    "Vice President",
    "Chief",
    "CEO",
    "CTO",
    "COO",
    "CFO",
    "Founder",
    "Geschäftsführer",
    "Professor"
  ],
  "target_companies": [
    "BCG",
    "Boston Consulting",
    "McKinsey",
    "Roland Berger",
    "PwC",
    "Bain",
    "Deloitte",
    "EY",
    "KPMG"
  ]
}
```

- [ ] **Step 2: Write the failing test** — create `tests/keepwarm-rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchesKeepWarmRules, type KeepWarmRules } from "../src/lib/keepwarm-rules";

const rules: KeepWarmRules = {
  seniority_keywords: ["Partner", "Head of", "CEO"],
  target_companies: ["BCG", "McKinsey"],
};

describe("matchesKeepWarmRules", () => {
  it("matches a seniority keyword in the job title (case-insensitive)", () => {
    const r = matchesKeepWarmRules(
      { jobTitle: "Senior partner", company: "", profileSummary: "" },
      rules
    );
    expect(r).toBe('Rule: seniority "Partner"');
  });

  it("matches a target company anywhere in title/company/summary", () => {
    const r = matchesKeepWarmRules(
      { jobTitle: "Consultant", company: "", profileSummary: "Strategy work at McKinsey Munich" },
      rules
    );
    expect(r).toBe("Rule: target company McKinsey");
  });

  it("seniority wins over company when both match", () => {
    const r = matchesKeepWarmRules(
      { jobTitle: "Partner", company: "BCG", profileSummary: "" },
      rules
    );
    expect(r).toBe('Rule: seniority "Partner"');
  });

  it("returns null when nothing matches", () => {
    const r = matchesKeepWarmRules(
      { jobTitle: "Working Student", company: "Some GmbH", profileSummary: "" },
      rules
    );
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/keepwarm-rules.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 4: Implement** — create `src/lib/keepwarm-rules.ts`:

```ts
import rulesData from "../../config/keepwarm-rules.json";

export interface KeepWarmRules {
  seniority_keywords: string[];
  target_companies: string[];
}

export function getKeepWarmRules(): KeepWarmRules {
  return rulesData as KeepWarmRules;
}

/**
 * Returns a human-readable match reason, or null.
 * Company is matched across title + company + profile summary because the
 * Contacts DB stores Company as an unresolved relation (often empty here) —
 * the employer usually appears in the job title or profile summary instead.
 */
export function matchesKeepWarmRules(
  contact: { jobTitle: string; company: string; profileSummary?: string },
  rules: KeepWarmRules = getKeepWarmRules()
): string | null {
  const titleLower = contact.jobTitle.toLowerCase();
  const seniority = rules.seniority_keywords.find((k) =>
    titleLower.includes(k.toLowerCase())
  );
  if (seniority) return `Rule: seniority "${seniority}"`;

  const haystack = `${contact.jobTitle} ${contact.company} ${contact.profileSummary ?? ""}`.toLowerCase();
  const company = rules.target_companies.find((c) =>
    haystack.includes(c.toLowerCase())
  );
  if (company) return `Rule: target company ${company}`;

  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/keepwarm-rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add config/keepwarm-rules.json src/lib/keepwarm-rules.ts tests/keepwarm-rules.test.ts
git commit -m "feat(keepwarm): rule-based high-value matcher (seniority + target companies)"
```

---

### Task 10: AI suggestion prompt + response parser

**Files:**
- Create: `src/lib/keepwarm-suggest.ts`
- Test: `tests/keepwarm-suggest.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/keepwarm-suggest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildKeepWarmScanPrompt,
  buildKeepWarmScanInput,
  parseKeepWarmScanResponse,
} from "../src/lib/keepwarm-suggest";

describe("buildKeepWarmScanPrompt", () => {
  it("lists the allowed categories and demands JSON", () => {
    const p = buildKeepWarmScanPrompt();
    expect(p).toContain("Future Speaker");
    expect(p).toContain("Sponsor/Partner");
    expect(p).toContain("JSON");
  });
});

describe("buildKeepWarmScanInput", () => {
  it("includes title, notes and summary", () => {
    const input = buildKeepWarmScanInput({
      name: "Anna Müller",
      jobTitle: "Partner",
      notes: "Met at ACC",
      profileSummary: "20y strategy consulting",
    });
    expect(input).toContain("Anna Müller");
    expect(input).toContain("Partner");
    expect(input).toContain("Met at ACC");
    expect(input).toContain("20y strategy consulting");
  });
});

describe("parseKeepWarmScanResponse", () => {
  it("parses a plain JSON match", () => {
    const r = parseKeepWarmScanResponse(
      '{"match": true, "categories": ["Future Speaker"], "reason": "Senior AI voice"}'
    );
    expect(r).toEqual({ match: true, categories: ["Future Speaker"], reason: "Senior AI voice" });
  });

  it("strips markdown code fences", () => {
    const r = parseKeepWarmScanResponse(
      '```json\n{"match": false, "categories": [], "reason": ""}\n```'
    );
    expect(r).toEqual({ match: false, categories: [], reason: "" });
  });

  it("filters unknown categories", () => {
    const r = parseKeepWarmScanResponse(
      '{"match": true, "categories": ["Future Speaker", "Investor"], "reason": "x"}'
    );
    expect(r?.categories).toEqual(["Future Speaker"]);
  });

  it("returns null on invalid JSON", () => {
    expect(parseKeepWarmScanResponse("not json at all")).toBeNull();
  });

  it("returns null when shape is wrong", () => {
    expect(parseKeepWarmScanResponse('{"match": "yes"}')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/keepwarm-suggest.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement** — create `src/lib/keepwarm-suggest.ts`:

```ts
import { KEEP_WARM_CATEGORIES } from "./keepwarm";

export interface KeepWarmSuggestion {
  match: boolean;
  categories: string[];
  reason: string;
}

/** System prompt: classify one contact as keep-warm-worthy or not. */
export function buildKeepWarmScanPrompt(): string {
  return `You screen LinkedIn contacts for a Munich student club (TEG) that runs industry events with speakers from top consultancies and tech firms.

Decide if the contact below is a HIGH-VALUE long-term relationship worth keeping warm even when no event invitation is pending. High-value means realistic potential as one of: ${KEEP_WARM_CATEGORIES.join(", ")}.

Be strict: ordinary attendees, juniors without distinctive expertise, and unclear profiles are NOT matches.

Answer with ONLY a JSON object, no prose, no markdown:
{"match": true|false, "categories": ["one or more of: ${KEEP_WARM_CATEGORIES.join(", ")}"], "reason": "one short sentence in German"}

If match is false, use empty categories and empty reason.`;
}

/** User message for one contact. */
export function buildKeepWarmScanInput(contact: {
  name: string;
  jobTitle: string;
  notes: string;
  profileSummary?: string;
}): string {
  return `Name: ${contact.name}
Job Title: ${contact.jobTitle || "—"}
Notes: ${contact.notes || "—"}
Profile Summary: ${contact.profileSummary || "—"}`;
}

const VALID_CATEGORIES = new Set<string>(KEEP_WARM_CATEGORIES);

/** Parses the model reply. Tolerates code fences. Returns null when unusable. */
export function parseKeepWarmScanResponse(text: string): KeepWarmSuggestion | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.match !== "boolean") return null;

  const categories = Array.isArray(obj.categories)
    ? obj.categories.filter((c): c is string => typeof c === "string" && VALID_CATEGORIES.has(c))
    : [];
  const reason = typeof obj.reason === "string" ? obj.reason : "";

  return { match: obj.match, categories, reason };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/keepwarm-suggest.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/keepwarm-suggest.ts tests/keepwarm-suggest.test.ts
git commit -m "feat(keepwarm): AI scan prompt and tolerant JSON response parser"
```

---

### Task 11: Scan endpoint + scan button + Suggested queue already renders

**Files:**
- Create: `src/app/api/keepwarm/scan/route.ts`
- Create: `src/components/KeepWarmScanButton.tsx`
- Modify: `src/app/(app)/relationships/page.tsx`

(The "Suggested" section on the Relationships page and its Confirm/Dismiss actions were already built in Task 7 — this task only produces the suggestions.)

- [ ] **Step 1: Create the scan route** — `src/app/api/keepwarm/scan/route.ts`:

```ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";
import { queryAll } from "@/lib/notion/contacts";
import { notion, withRetry } from "@/lib/notion/client";
import { select, multiSelect, richText } from "@/lib/notion/props";
import { matchesKeepWarmRules } from "@/lib/keepwarm-rules";
import {
  buildKeepWarmScanPrompt,
  buildKeepWarmScanInput,
  parseKeepWarmScanResponse,
  type KeepWarmSuggestion,
} from "@/lib/keepwarm-suggest";
import type { Contact } from "@/lib/types";

// AI calls are sequential (Notion 3 req/s + free-tier AI quotas); cap per scan.
const AI_BATCH_LIMIT = 20;

export const maxDuration = 300;

async function classifyWithAI(
  contact: Contact,
  geminiKey: string,
  openaiKey: string
): Promise<KeepWarmSuggestion | null> {
  const systemPrompt = buildKeepWarmScanPrompt();
  const input = buildKeepWarmScanInput(contact);

  if (geminiKey) {
    try {
      const client = new GoogleGenerativeAI(geminiKey);
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt,
      });
      const response = await model.generateContent(input);
      const parsed = parseKeepWarmScanResponse(response.response.text());
      if (parsed) return parsed;
    } catch (e) {
      console.error("[keepwarm/scan gemini]", e instanceof Error ? e.message : e);
    }
  }

  if (openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ],
      });
      return parseKeepWarmScanResponse(resp.choices[0].message.content ?? "");
    } catch (e) {
      console.error("[keepwarm/scan openai]", e instanceof Error ? e.message : e);
    }
  }

  return null;
}

async function markSuggested(
  contactId: string,
  categories: string[],
  reason: string
): Promise<void> {
  const properties: Record<string, unknown> = {
    "Keep Warm Status": select("Suggested"),
    "Keep Warm Reason": richText(reason),
  };
  if (categories.length > 0) properties["Keep Warm Category"] = multiSelect(categories);
  await withRetry(() =>
    notion().pages.update({
      page_id: contactId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: properties as any,
    })
  );
}

export async function POST() {
  const geminiKey = env.geminiKey();
  const openaiKey = env.openaiKey();

  try {
    // Candidates: real connections not yet triaged for keep-warm.
    const candidates = await queryAll(env.contactsDb(), {
      and: [
        {
          or: [
            { property: "LinkedIn Outreach Status", select: { equals: "Connected" } },
            { property: "LinkedIn Outreach Status", select: { equals: "Messaged" } },
          ],
        },
        { property: "Keep Warm Status", select: { is_empty: true } },
      ],
    });

    let ruleMatches = 0;
    let aiMatches = 0;
    let aiCalls = 0;
    let errors = 0;
    const remaining: Contact[] = [];

    // Pass 1: free rule matching
    for (const c of candidates) {
      const ruleReason = matchesKeepWarmRules(c);
      if (ruleReason) {
        try {
          await markSuggested(c.id, [], ruleReason);
          ruleMatches++;
        } catch (e) {
          console.error("[keepwarm/scan] mark failed", c.id, e);
          errors++;
        }
      } else {
        remaining.push(c);
      }
    }

    // Pass 2: AI classification for profiles with enough signal
    if (geminiKey || openaiKey) {
      const withSignal = remaining.filter((c) => (c.profileSummary ?? "").trim().length > 0);
      for (const c of withSignal.slice(0, AI_BATCH_LIMIT)) {
        aiCalls++;
        const suggestion = await classifyWithAI(c, geminiKey, openaiKey);
        if (suggestion?.match) {
          try {
            await markSuggested(c.id, suggestion.categories, `AI: ${suggestion.reason}`);
            aiMatches++;
          } catch (e) {
            console.error("[keepwarm/scan] mark failed", c.id, e);
            errors++;
          }
        }
      }
    }

    return NextResponse.json({
      candidates: candidates.length,
      ruleMatches,
      aiCalls,
      aiMatches,
      errors,
    });
  } catch (e) {
    console.error("[keepwarm/scan]", e);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the scan button** — `src/components/KeepWarmScanButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function KeepWarmScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function scan() {
    setBusy(true);
    setSummary(null);
    try {
      const res = await fetch("/api/keepwarm/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSummary(data.error ?? "Scan failed");
        return;
      }
      setSummary(
        `Scanned ${data.candidates} contacts — ${data.ruleMatches} rule matches, ` +
          `${data.aiMatches}/${data.aiCalls} AI matches` +
          (data.errors ? `, ${data.errors} errors` : "")
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={scan}>
        {busy ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-1.5" />
        )}
        Scan for suggestions
      </Button>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Mount the button** — in `src/app/(app)/relationships/page.tsx`, add the import:

```tsx
import { KeepWarmScanButton } from "@/components/KeepWarmScanButton";
```

And inside the header `<div>` (directly under the `<p className="text-sm text-muted-foreground">…</p>` line), add:

```tsx
        <div className="mt-2">
          <KeepWarmScanButton />
        </div>
```

- [ ] **Step 4: Build + verify manually**

Run: `npm run build` — compiles. Manual: click "Scan for suggestions"; senior/target-company contacts appear in the Suggested section; Confirm moves one to Active with a fresh Next Touch Date.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/keepwarm/scan/route.ts src/components/KeepWarmScanButton.tsx "src/app/(app)/relationships/page.tsx"
git commit -m "feat(keepwarm): rules + AI suggestion scan with human confirm queue"
```

---

# PHASE 3 — The payoff (event-match + digest)

### Task 12: Event-match — rank the keep-warm pool against the current event

**Files:**
- Create: `src/lib/keepwarm-match.ts`
- Create: `src/app/api/keepwarm/match/route.ts`
- Create: `src/components/EventMatchPanel.tsx`
- Modify: `src/app/(app)/relationships/page.tsx`
- Test: `tests/keepwarm-match.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/keepwarm-match.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildMatchPrompt,
  buildMatchInput,
  parseMatchResponse,
} from "../src/lib/keepwarm-match";
import { getEvent } from "../src/lib/config";
import type { Contact } from "../src/lib/types";

function makeContact(id: string, name: string): Contact {
  return {
    id,
    name,
    linkedinUrl: "",
    jobTitle: "Partner",
    company: "",
    tier: "",
    pipelineStage: "",
    outreachStatus: "Messaged",
    outreachOwner: "Jonas",
    lastContactDate: "",
    followUpDueDate: "",
    followUpOwner: "",
    followUpComplete: false,
    notes: "",
    keepWarmStatus: "Active",
    keepWarmCategories: ["Future Speaker"],
    keepWarmReason: "GenAI expertise",
    nextTouchDate: "",
  };
}

describe("buildMatchPrompt", () => {
  it("references the event and demands a JSON array", () => {
    const p = buildMatchPrompt(getEvent());
    expect(p).toContain(getEvent().name);
    expect(p).toContain("JSON");
  });
});

describe("buildMatchInput", () => {
  it("lists each contact with its id", () => {
    const input = buildMatchInput([makeContact("id-1", "Anna"), makeContact("id-2", "Ben")]);
    expect(input).toContain("id-1");
    expect(input).toContain("Anna");
    expect(input).toContain("id-2");
  });
});

describe("parseMatchResponse", () => {
  const contacts = [makeContact("id-1", "Anna"), makeContact("id-2", "Ben")];

  it("maps ids back to contacts sorted by score desc", () => {
    const result = parseMatchResponse(
      '[{"id": "id-2", "score": 5, "why": "perfect fit"}, {"id": "id-1", "score": 3, "why": "ok"}]',
      contacts
    );
    expect(result.map((r) => r.contact.name)).toEqual(["Ben", "Anna"]);
    expect(result[0].score).toBe(5);
    expect(result[0].justification).toBe("perfect fit");
  });

  it("ignores unknown ids and strips code fences", () => {
    const result = parseMatchResponse(
      '```json\n[{"id": "ghost", "score": 5, "why": "x"}, {"id": "id-1", "score": 4, "why": "y"}]\n```',
      contacts
    );
    expect(result).toHaveLength(1);
    expect(result[0].contact.id).toBe("id-1");
  });

  it("returns empty array on invalid JSON", () => {
    expect(parseMatchResponse("nope", contacts)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/keepwarm-match.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement** — create `src/lib/keepwarm-match.ts`:

```ts
import type { EventConfig } from "./config";
import type { Contact } from "./types";

export interface EventMatch {
  contact: Contact;
  score: number;
  justification: string;
}

/** System prompt: rank keep-warm contacts for fit to the configured event. */
export function buildMatchPrompt(event: EventConfig): string {
  const speakers = event.speakers.map((s) => `${s.name} (${s.company})`).join(", ");
  const agenda = event.agenda.map((a) => a.title).join("; ");
  return `You match saved high-value LinkedIn contacts to an upcoming event.

EVENT: ${event.name} — ${event.date}, ${event.location}
Agenda topics: ${agenda || "—"}
Confirmed speakers: ${speakers || "—"}
Relevant keywords: ${event.personalization_keywords?.join(", ") || "—"}

For each contact below, judge how well they fit this event as a speaker, sponsor, or high-value guest. Score 1-5 (5 = invite immediately). Only include contacts scoring 3 or higher.

Answer with ONLY a JSON array, no prose, no markdown:
[{"id": "<contact id>", "score": 1-5, "why": "one short sentence in German"}]`;
}

/** Numbered contact list the model ranks. */
export function buildMatchInput(contacts: Contact[]): string {
  return contacts
    .map(
      (c) =>
        `- id: ${c.id} | ${c.name} | ${c.jobTitle || "—"} | ` +
        `Kategorien: ${c.keepWarmCategories.join(", ") || "—"} | ` +
        `Grund: ${c.keepWarmReason || "—"} | Notizen: ${c.notes || "—"}`
    )
    .join("\n");
}

/** Maps the model's id/score list back to contacts, sorted by score desc. */
export function parseMatchResponse(text: string, contacts: Contact[]): EventMatch[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const byId = new Map(contacts.map((c) => [c.id, c]));
  const matches: EventMatch[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const contact = typeof o.id === "string" ? byId.get(o.id) : undefined;
    if (!contact || typeof o.score !== "number") continue;
    matches.push({
      contact,
      score: o.score,
      justification: typeof o.why === "string" ? o.why : "",
    });
  }
  return matches.sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/keepwarm-match.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create the match route** — `src/app/api/keepwarm/match/route.ts`:

```ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";
import { getEvent } from "@/lib/config";
import { queryAll } from "@/lib/notion/contacts";
import {
  buildMatchPrompt,
  buildMatchInput,
  parseMatchResponse,
} from "@/lib/keepwarm-match";

export const maxDuration = 120;

export async function POST() {
  const geminiKey = env.geminiKey();
  const openaiKey = env.openaiKey();
  if (!geminiKey && !openaiKey) {
    return NextResponse.json(
      { error: "No AI provider configured — set GEMINI_API_KEY or OPENAI_API_KEY" },
      { status: 501 }
    );
  }

  try {
    const pool = await queryAll(env.contactsDb(), {
      or: [
        { property: "Keep Warm Status", select: { equals: "Active" } },
        { property: "Keep Warm Status", select: { equals: "Snoozed" } },
      ],
    });
    if (pool.length === 0) {
      return NextResponse.json({ event: getEvent().name, matches: [] });
    }

    const event = getEvent();
    const systemPrompt = buildMatchPrompt(event);
    const input = buildMatchInput(pool);

    let text: string | null = null;
    if (geminiKey) {
      try {
        const client = new GoogleGenerativeAI(geminiKey);
        const model = client.getGenerativeModel({
          model: "gemini-2.0-flash",
          systemInstruction: systemPrompt,
        });
        const response = await model.generateContent(input);
        text = response.response.text();
      } catch (e) {
        console.error("[keepwarm/match gemini]", e instanceof Error ? e.message : e);
      }
    }
    if (text === null && openaiKey) {
      const client = new OpenAI({ apiKey: openaiKey });
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ],
      });
      text = resp.choices[0].message.content ?? "";
    }
    if (text === null) throw new Error("All AI providers failed");

    const matches = parseMatchResponse(text, pool).map((m) => ({
      contactId: m.contact.id,
      name: m.contact.name,
      jobTitle: m.contact.jobTitle,
      owner: m.contact.outreachOwner,
      score: m.score,
      justification: m.justification,
    }));

    return NextResponse.json({ event: event.name, matches });
  } catch (e) {
    console.error("[keepwarm/match]", e);
    return NextResponse.json({ error: "Match failed" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create the panel** — `src/components/EventMatchPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Target } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Match {
  contactId: string;
  name: string;
  jobTitle: string;
  owner: string;
  score: number;
  justification: string;
}

export function EventMatchPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keepwarm/match", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Match failed");
        return;
      }
      setEventName(data.event);
      setMatches(data.matches);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Event match
          </span>
          <Button size="sm" variant="outline" disabled={busy} onClick={run}>
            {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Match pool against current event
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {matches !== null && matches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No strong fits in the pool for {eventName}.
          </p>
        )}
        {matches !== null && matches.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Fits for <span className="font-medium">{eventName}</span> (score ≥ 3):
            </p>
            {matches.map((m) => (
              <div
                key={m.contactId}
                className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {m.name}
                    <span className="ml-2 inline-block rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">
                      {m.score}/5
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.jobTitle || "—"}</p>
                  <p className="text-xs text-muted-foreground italic">{m.justification}</p>
                  <p className="text-xs text-muted-foreground">Connected by {m.owner || "—"}</p>
                </div>
                <Link
                  href={`/messages/${m.contactId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                >
                  Invite
                </Link>
              </div>
            ))}
          </div>
        )}
        {matches === null && !error && (
          <p className="text-sm text-muted-foreground">
            When planning a new event, update <code>config/event.json</code> and run the match to
            see which keep-warm contacts fit as speakers, sponsors, or guests.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Mount the panel** — in `src/app/(app)/relationships/page.tsx`, add the import:

```tsx
import { EventMatchPanel } from "@/components/EventMatchPanel";
```

And render it directly after the Suggested card block (before the empty-pool card):

```tsx
      <EventMatchPanel />
```

- [ ] **Step 8: Run tests + build + verify manually**

Run: `npm test && npm run build` — PASS / compiles. Manual: click match; ranked fits appear with German one-line justifications and "Invite" links (normal invite mode — these ARE event invitations).

- [ ] **Step 9: Commit**

```bash
git add src/lib/keepwarm-match.ts src/app/api/keepwarm/match/route.ts src/components/EventMatchPanel.tsx "src/app/(app)/relationships/page.tsx" tests/keepwarm-match.test.ts
git commit -m "feat(keepwarm): AI event-match ranking of the keep-warm pool"
```

---

### Task 13: Weekly digest section (cross-repo, Python — optional)

**Files:** in the **`teg-crm` Python repo** (NOT this repo — locate the weekly report script there; it runs on GitHub Actions and sends via Resend).

This keeps the team accountable: every weekly report shows overdue keep-warm touches and unconfirmed suggestions. It reads the same Notion fields — no new infrastructure.

- [ ] **Step 1:** In the Python repo, find the weekly report generator (search for the Resend send / report assembly, e.g. `grep -r "weekly" --include="*.py"`).
- [ ] **Step 2:** Add this self-contained section builder (adapt the Notion client variable name to the script's existing one):

```python
KEEP_WARM_CADENCE_NOTE = "Touch overdue = Next Touch Date in the past."


def keep_warm_digest_section(notion, contacts_db_id: str, today_iso: str) -> str:
    """Markdown section for the weekly report: keep-warm pool health."""
    def query(filter_):
        results, cursor = [], None
        while True:
            resp = notion.databases.query(
                database_id=contacts_db_id, filter=filter_, start_cursor=cursor
            )
            results.extend(resp["results"])
            if not resp.get("has_more"):
                return results
            cursor = resp["next_cursor"]

    overdue = query({
        "and": [
            {"property": "Keep Warm Status", "select": {"equals": "Active"}},
            {"property": "Next Touch Date", "date": {"on_or_before": today_iso}},
        ]
    })
    suggested = query({
        "property": "Keep Warm Status", "select": {"equals": "Suggested"}
    })

    def name_of(page):
        t = page["properties"].get("Name", {}).get("title", [])
        return t[0]["plain_text"] if t else "Unnamed"

    lines = ["## Keep Warm", ""]
    if overdue:
        lines.append(f"**{len(overdue)} touches overdue:**")
        lines += [f"- {name_of(p)}" for p in overdue[:15]]
        if len(overdue) > 15:
            lines.append(f"- … and {len(overdue) - 15} more")
    else:
        lines.append("No overdue touches. 🔥")
    if suggested:
        lines.append("")
        lines.append(
            f"**{len(suggested)} suggested contacts awaiting confirm/dismiss** "
            "(Relationships tab in the web app)."
        )
    return "\n".join(lines)
```

- [ ] **Step 3:** Call it where the report body is assembled and append the returned markdown.
- [ ] **Step 4:** Run that repo's tests, commit there with `feat(report): keep-warm section in weekly digest`.

---

## Final verification (after each phase)

- [ ] `npm test` — full suite green.
- [ ] `npm run lint` — clean.
- [ ] `npm run build` — compiles.
- [ ] Manual smoke: flag → appears on `/relationships` → due date reached (set `Next Touch Date` to today in Notion to simulate) → appears in Today bucket → Touch Base → nurture variants → log → cadence restarts.
- [ ] Deploy: push to main, verify on Vercel.
