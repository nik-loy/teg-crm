# Leantime → Notion Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sunday cron that reads Leantime ticket statuses for all active ideas, writes a human-readable summary back to Notion, detects completion (all tickets done), and escalates in two levels if nothing is moving for consecutive weeks.

**Architecture:** A new `POST /api/leantime-sync` endpoint triggers from a GitHub Actions Sunday 9am cron. `src/core/leantime-sync.ts` fetches only active ideas (Routing / Partially Acknowledged / Fully Acknowledged with ticket IDs), processes each one independently, and writes results back to Notion. Errors per idea are captured and do not crash the whole sync.

**Tech Stack:** Next.js 14 App Router (existing), `@notionhq/client` (existing), Resend (existing), Leantime JSON-RPC (existing `rpcCall` helper extended with `getTicketStatus`). No new dependencies.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add `LeantimeStatusSnapshot`, 5 new fields on `Idea` |
| `src/lib/notion.ts` | Modify | Add 5 PI constants, `checkboxVal`, sync fields to `parseIdea`, 4 new functions |
| `src/lib/leantime.ts` | Modify | Update `JsonRpcResponse.result` type, add `getTicketStatus` |
| `src/lib/email.ts` | Modify | Add `sendStalenessL1`, `sendStalenessL2`, `sendIdeaCompleted` |
| `src/core/leantime-sync.ts` | Create | All sync logic: fetch, compare, complete, escalate |
| `src/app/api/leantime-sync/route.ts` | Create | Auth-guarded POST endpoint |
| `.github/workflows/leantime-sync.yml` | Create | Sunday 9am cron trigger |
| `src/__tests__/leantime-sync.test.ts` | Create | 12 unit tests, all external modules mocked |

---

## Task 1 — Extend `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `LeantimeStatusSnapshot` type and 5 new fields to `Idea`**

In `src/types/index.ts`, append after line 105 (after `LeantimeTicketParams`) and extend the `Idea` interface:

```typescript
// Add at the bottom of the file (after LeantimeTicketParams):
export type LeantimeStatusSnapshot = Record<string, number>;
```

Then in the `Idea` interface (after `leantimeTicketIds: string | null;`), add:

```typescript
  markComplete: boolean;
  leantimeStatusRaw: string | null;
  leantimeSummary: string | null;
  leantimeLastSynced: string | null;
  stalenessAlertCount: number;
```

Final `Idea` interface (lines 24–49 become):

```typescript
export interface Idea {
  id: string;
  title: string;
  submitterName: string;
  submitterEmail: string;
  submitterDepartment: DepartmentName;
  submissionType: SubmissionType;
  category: string;
  description: string;
  goal: string;
  successCriteria: string;
  departmentsNeeded: DepartmentName[];
  responsibleDepartment: DepartmentName | null;
  proposedTimeline: string | null;
  priority: "Low" | "Medium" | "High" | "Critical";
  inspirationReferences: string | null;
  proposedOwner: string | null;
  risksConcerns: string | null;
  dependencies: string | null;
  status: IdeaStatus;
  strategyNotes: string | null;
  submittedAt: string | null;
  lastProcessedAt: string | null;
  leantimeTicketIds: string | null;
  notionUrl: string;
  markComplete: boolean;
  leantimeStatusRaw: string | null;
  leantimeSummary: string | null;
  leantimeLastSynced: string | null;
  stalenessAlertCount: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: No errors about `Idea` properties. Existing `parseIdea` in `notion.ts` will warn because it doesn't yet return the new fields — that is fixed in Task 2.

---

## Task 2 — Extend `src/lib/notion.ts` with sync support

**Files:**
- Modify: `src/lib/notion.ts`

- [ ] **Step 1: Add 5 new PI constants (lines 7–18)**

In the `PI` constant block in `src/lib/notion.ts`, add after `LEANTIME_TICKET_IDS`:

```typescript
  LEANTIME_STATUS_RAW: "Leantime Status Raw",
  LEANTIME_SUMMARY: "Leantime Summary",
  LEANTIME_LAST_SYNCED: "Leantime Last Synced",
  STALENESS_ALERT_COUNT: "Staleness Alert Count",
  MARK_COMPLETE: "Mark Complete",
```

The full updated `PI` constant:

```typescript
const PI = {
  NAME: "Name", SUBMITTER_NAME: "Submitter Name", SUBMITTER_EMAIL: "Submitter Email",
  SUBMITTER_DEPT: "Submitter Department", SUBMISSION_TYPE: "Submission Type",
  CATEGORY: "Category", DESCRIPTION: "Description", GOAL: "Goal",
  SUCCESS_CRITERIA: "Success Criteria", DEPTS_NEEDED: "Departments Needed",
  RESPONSIBLE_DEPT: "Responsible Department", PROPOSED_TIMELINE: "Proposed Timeline",
  PRIORITY: "Priority", INSPIRATION: "Inspiration References",
  PROPOSED_OWNER: "Proposed Owner", RISKS: "Risks Concerns",
  DEPENDENCIES: "Dependencies", STATUS: "Status", STRATEGY_NOTES: "Strategy Notes",
  SUBMITTED_AT: "Submitted At", LAST_PROCESSED_AT: "Last Processed At",
  LEANTIME_TICKET_IDS: "Leantime Ticket IDs",
  LEANTIME_STATUS_RAW: "Leantime Status Raw",
  LEANTIME_SUMMARY: "Leantime Summary",
  LEANTIME_LAST_SYNCED: "Leantime Last Synced",
  STALENESS_ALERT_COUNT: "Staleness Alert Count",
  MARK_COMPLETE: "Mark Complete",
} as const;
```

- [ ] **Step 2: Add `checkboxVal` accessor (after `numVal` on line 54)**

```typescript
function checkboxVal(p: Props, key: string): boolean {
  const v = p[key]; return v?.type === "checkbox" ? v.checkbox : false;
}
```

- [ ] **Step 3: Add 5 new fields to `parseIdea` (inside the returned object)**

Add after `leantimeTicketIds: rt(p, PI.LEANTIME_TICKET_IDS),`:

```typescript
    markComplete: checkboxVal(p, PI.MARK_COMPLETE),
    leantimeStatusRaw: rt(p, PI.LEANTIME_STATUS_RAW),
    leantimeSummary: rt(p, PI.LEANTIME_SUMMARY),
    leantimeLastSynced: dateVal(p, PI.LEANTIME_LAST_SYNCED),
    stalenessAlertCount: numVal(p, PI.STALENESS_ALERT_COUNT),
```

- [ ] **Step 4: Add `getActiveIdeasForSync` (in the read functions section, after `getDeptResponsesForIdea`)**

```typescript
export async function getActiveIdeasForSync(): Promise<Idea[]> {
  console.log("[notion] getActiveIdeasForSync");
  try {
    return await queryIdeas({
      and: [
        {
          or: [
            { property: PI.STATUS, select: { equals: "Routing" } },
            { property: PI.STATUS, select: { equals: "Partially Acknowledged" } },
            { property: PI.STATUS, select: { equals: "Fully Acknowledged" } },
          ],
        },
        { property: PI.LEANTIME_TICKET_IDS, rich_text: { is_not_empty: true } },
      ],
    });
  } catch (err) {
    console.error("[notion] getActiveIdeasForSync failed:", err);
    throw err;
  }
}
```

- [ ] **Step 5: Add `setLeantimeSync`, `setStalenessCount`, `setIdeaCompleted` (in the write functions section)**

```typescript
export async function setLeantimeSync(
  ideaId: string,
  rawJson: string,
  summary: string,
  syncDate: string
): Promise<void> {
  console.log(`[notion] setLeantimeSync: ${ideaId}`);
  try {
    await notion.pages.update({
      page_id: ideaId,
      properties: {
        [PI.LEANTIME_STATUS_RAW]: { rich_text: [{ text: { content: rawJson } }] },
        [PI.LEANTIME_SUMMARY]: { rich_text: [{ text: { content: summary } }] },
        [PI.LEANTIME_LAST_SYNCED]: { date: { start: syncDate } },
      },
    });
  } catch (err) {
    console.error("[notion] setLeantimeSync failed:", err);
    throw err;
  }
}

export async function setStalenessCount(ideaId: string, count: number): Promise<void> {
  console.log(`[notion] setStalenessCount: ${ideaId} → ${count}`);
  try {
    await notion.pages.update({
      page_id: ideaId,
      properties: {
        [PI.STALENESS_ALERT_COUNT]: { number: count },
      },
    });
  } catch (err) {
    console.error("[notion] setStalenessCount failed:", err);
    throw err;
  }
}

export async function setIdeaCompleted(ideaId: string): Promise<void> {
  console.log(`[notion] setIdeaCompleted: ${ideaId}`);
  try {
    await notion.pages.update({
      page_id: ideaId,
      properties: {
        [PI.STATUS]: { select: { name: "Completed" } },
        [PI.LAST_PROCESSED_AT]: { date: { start: new Date().toISOString() } },
      },
    });
  } catch (err) {
    console.error("[notion] setIdeaCompleted failed:", err);
    throw err;
  }
}
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: No type errors.

---

## Task 3 — Add `getTicketStatus` to `src/lib/leantime.ts`

**Files:**
- Modify: `src/lib/leantime.ts`

- [ ] **Step 1: Broaden `JsonRpcResponse.result` to accept Leantime's `false` return**

Leantime returns `false` (not `null`) when a ticket is not found. The current `result?:
 { id?: string | number; [key: string]: unknown }` doesn't allow `false`. Replace the `JsonRpcResponse` interface (lines 4–9):

```typescript
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}
```

- [ ] **Step 2: Fix the `createTicket` function — it accesses `rpc.result?.id` which now needs a cast**

In `createTicket` (around line 95), replace:

```typescript
  const id = rpc.result?.id;
```

with:

```typescript
  const resultObj = rpc.result as Record<string, unknown> | null | undefined;
  const id = resultObj?.id;
```

- [ ] **Step 3: Add `getTicketStatus` export (after `createInterdeptTicket`)**

```typescript
export async function getTicketStatus(ticketId: string): Promise<number | null> {
  console.log(`[leantime] getTicketStatus: ${ticketId}`);
  const rpc = await rpcCall("leantime.rpc.Tickets.getTicket", { id: ticketId });
  if (!rpc || rpc.error || !rpc.result || typeof rpc.result !== "object") {
    console.log(`[leantime] getTicketStatus: ticket ${ticketId} not found or error`);
    return null;
  }
  const result = rpc.result as Record<string, unknown>;
  const status = result["status"];
  if (status === undefined || status === null) return null;
  return Number(status);
}
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: No type errors in `leantime.ts`.

---

## Task 4 — Add 3 new email templates to `src/lib/email.ts`

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Add `sendStalenessL1` (Level 1 alert, one per stale dept lead) after email #10**

```typescript
// 11. Staleness Level 1 — dept lead
export async function sendStalenessL1(
  idea: Idea,
  deptLead: { name: string; email: string },
  currentStatusLabel: string
): Promise<void> {
  const subject = `Action needed: no progress on your Leantime ticket for ${idea.title}`;
  const html = wrap("Action Needed — Leantime Ticket Stalled", `
    <p>Hi ${deptLead.name},</p>
    <p>The Leantime ticket for the following idea has had <strong>no status change since last week</strong>. Please update it or let Strategy know if there is a blocker.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <div style="background:#FEF3C7;border-left:4px solid #D97706;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
      <strong>Current Leantime status:</strong> ${currentStatusLabel}
    </div>
    <p><strong>Next action:</strong> Update your Leantime ticket status or contact the Strategy Head if there is a blocker preventing progress.</p>
    <br>${ctaButton(idea.notionUrl, "View Idea in Notion →")}
  `);
  await send(deptLead.email, subject, html);
}
```

- [ ] **Step 2: Add `sendStalenessL2` (Level 2 escalation, Strategy Head + submitter)**

```typescript
// 12. Staleness Level 2 — escalation
export async function sendStalenessL2(
  idea: Idea,
  staleDeptNames: string[],
  strategyHead: { name: string; email: string }
): Promise<void> {
  const subject = `Escalation: ${idea.title} has had no Leantime activity for 2 weeks`;
  const deptList = staleDeptNames.join(", ");
  const html = wrap("Escalation: Leantime Tickets Stalled for 2 Weeks", `
    <p>Hi,</p>
    <p>The following idea has had <strong>no Leantime ticket progress for two consecutive weeks</strong>. This requires your attention.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <div style="background:#FEE2E2;border-left:4px solid #DC2626;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
      <strong>Stalled departments:</strong> ${deptList}
    </div>
    <p><strong>Next action:</strong> Please contact the relevant department leads or reassign the work.</p>
    <br>${ctaButton(idea.notionUrl, "View Idea in Notion →")}
  `);
  await send([strategyHead.email, idea.submitterEmail], subject, html);
}
```

- [ ] **Step 3: Add `sendIdeaCompleted` (submitter + Strategy Head FYI)**

```typescript
// 13. Idea completed
export async function sendIdeaCompleted(
  idea: Idea,
  strategyHead: { name: string; email: string }
): Promise<void> {
  const subject = `Your idea is complete: ${idea.title}`;
  const html = wrap("Idea Successfully Completed", `
    <p>Hi ${idea.submitterName},</p>
    <p>Great news — your idea has been completed! All associated Leantime tickets have been marked as done.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <p>Thank you for contributing this idea to TEG e.V. You can view the completed idea in Notion at any time.</p>
    <br>${ctaButton(idea.notionUrl, "View Completed Idea in Notion →")}
  `);
  await send([idea.submitterEmail, strategyHead.email], subject, html);
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors.

---

## Task 5 — Write failing tests for `src/core/leantime-sync.ts`

**Files:**
- Create: `src/__tests__/leantime-sync.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/__tests__/leantime-sync.test.ts

// env mock MUST be first — prevents Zod validation from running at module load
jest.mock("@/lib/env", () => ({
  env: {
    NOTION_API_KEY: "test-key",
    NOTION_IDEAS_DB_ID: "test-ideas-db",
    NOTION_DEPT_RESPONSES_DB_ID: "test-responses-db",
    CRON_SECRET: "test-secret",
    RESEND_API_KEY: "test-resend-key",
    FROM_EMAIL: "test@example.com",
    REPLY_TO_EMAIL: undefined,
    LEANTIME_URL: "https://leantime.example.com",
    LEANTIME_API_KEY: "test-leantime-key",
    APP_URL: "https://app.example.com",
  },
}));
jest.mock("@/lib/notion");
jest.mock("@/lib/email");
jest.mock("@/lib/leantime");

import type { Idea, DeptResponse } from "@/types";
import * as notionLib from "@/lib/notion";
import * as emailLib from "@/lib/email";
import * as leantimeLib from "@/lib/leantime";
import { runLeantimeSync } from "@/core/leantime-sync";
import config from "../../config/departments";

// ─── Typed mock aliases ───────────────────────────────────────────────────────
const mockGetActiveIdeasForSync = notionLib.getActiveIdeasForSync as jest.MockedFunction<typeof notionLib.getActiveIdeasForSync>;
const mockGetDeptResponsesForIdea = notionLib.getDeptResponsesForIdea as jest.MockedFunction<typeof notionLib.getDeptResponsesForIdea>;
const mockSetLeantimeSync = notionLib.setLeantimeSync as jest.MockedFunction<typeof notionLib.setLeantimeSync>;
const mockSetStalenessCount = notionLib.setStalenessCount as jest.MockedFunction<typeof notionLib.setStalenessCount>;
const mockSetIdeaCompleted = notionLib.setIdeaCompleted as jest.MockedFunction<typeof notionLib.setIdeaCompleted>;
const mockGetTicketStatus = leantimeLib.getTicketStatus as jest.MockedFunction<typeof leantimeLib.getTicketStatus>;
const mockSendStalenessL1 = emailLib.sendStalenessL1 as jest.MockedFunction<typeof emailLib.sendStalenessL1>;
const mockSendStalenessL2 = emailLib.sendStalenessL2 as jest.MockedFunction<typeof emailLib.sendStalenessL2>;
const mockSendIdeaCompleted = emailLib.sendIdeaCompleted as jest.MockedFunction<typeof emailLib.sendIdeaCompleted>;

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const opsDept = config.departments.find((d) => d.name === "Operations")!;

function makeIdea(overrides?: Partial<Idea>): Idea {
  return {
    id: "idea-1",
    title: "Test Idea",
    submitterName: "Alice",
    submitterEmail: "alice@teg-ev.de",
    submitterDepartment: "Marketing",
    submissionType: "Club Initiative",
    category: "Events",
    description: "A test description",
    goal: "A test goal",
    successCriteria: "Some criteria",
    departmentsNeeded: ["Operations"],
    responsibleDepartment: null,
    proposedTimeline: null,
    priority: "Medium",
    inspirationReferences: null,
    proposedOwner: null,
    risksConcerns: null,
    dependencies: null,
    status: "Routing",
    strategyNotes: null,
    submittedAt: null,
    lastProcessedAt: null,
    leantimeTicketIds: "101",
    notionUrl: "https://notion.so/test",
    markComplete: false,
    leantimeStatusRaw: null,
    leantimeSummary: null,
    leantimeLastSynced: null,
    stalenessAlertCount: 0,
    ...overrides,
  };
}

function makeDeptResponse(overrides?: Partial<DeptResponse>): DeptResponse {
  return {
    id: "resp-1",
    name: "Test Idea — Operations",
    ideaId: "idea-1",
    ideaTitle: "Test Idea",
    department: "Operations",
    departmentLeadEmail: opsDept.teamLeadEmail,
    status: "Accepted",
    declineReason: null,
    deptNotes: null,
    responseDate: null,
    processedAt: null,
    leantimeTicketId: "101",
    reminderCount: 0,
    lastReminderAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetActiveIdeasForSync.mockResolvedValue([]);
  mockGetDeptResponsesForIdea.mockResolvedValue([makeDeptResponse()]);
  mockSetLeantimeSync.mockResolvedValue(undefined);
  mockSetStalenessCount.mockResolvedValue(undefined);
  mockSetIdeaCompleted.mockResolvedValue(undefined);
  mockGetTicketStatus.mockResolvedValue(4); // In Progress by default
  mockSendStalenessL1.mockResolvedValue(undefined);
  mockSendStalenessL2.mockResolvedValue(undefined);
  mockSendIdeaCompleted.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runLeantimeSync", () => {
  it("returns zero counts when no active ideas", async () => {
    mockGetActiveIdeasForSync.mockResolvedValue([]);
    const result = await runLeantimeSync();
    expect(result.processed).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.stale).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("marks idea completed when all tickets have status 0 (Done)", async () => {
    mockGetActiveIdeasForSync.mockResolvedValue([makeIdea({ leantimeTicketIds: "101" })]);
    mockGetTicketStatus.mockResolvedValue(0);

    const result = await runLeantimeSync();

    expect(mockSetIdeaCompleted).toHaveBeenCalledWith("idea-1");
    expect(mockSendIdeaCompleted).toHaveBeenCalledTimes(1);
    expect(result.completed).toBe(1);
    expect(result.processed).toBe(1);
  });

  it("marks idea completed when all tickets have status -1 (Archived)", async () => {
    mockGetActiveIdeasForSync.mockResolvedValue([makeIdea({ leantimeTicketIds: "101" })]);
    mockGetTicketStatus.mockResolvedValue(-1);

    await runLeantimeSync();

    expect(mockSetIdeaCompleted).toHaveBeenCalledWith("idea-1");
    expect(mockSendIdeaCompleted).toHaveBeenCalledTimes(1);
  });

  it("marks idea completed when markComplete checkbox is true, regardless of ticket status", async () => {
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ markComplete: true, leantimeTicketIds: "101" }),
    ]);
    mockGetTicketStatus.mockResolvedValue(4); // In Progress — not done

    await runLeantimeSync();

    expect(mockSetIdeaCompleted).toHaveBeenCalledWith("idea-1");
    expect(mockSendIdeaCompleted).toHaveBeenCalledTimes(1);
  });

  it("records snapshot on first sync without sending any staleness emails", async () => {
    // leantimeStatusRaw: null means no previous snapshot
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ leantimeStatusRaw: null, stalenessAlertCount: 0 }),
    ]);
    mockGetTicketStatus.mockResolvedValue(3); // New

    await runLeantimeSync();

    expect(mockSendStalenessL1).not.toHaveBeenCalled();
    expect(mockSendStalenessL2).not.toHaveBeenCalled();
    expect(mockSetLeantimeSync).toHaveBeenCalledTimes(1); // snapshot written
  });

  it("sends L1 staleness email when no status changed since last sync (count 0→1)", async () => {
    const prevSnapshot = JSON.stringify({ "101": 4 }); // In Progress last week
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ leantimeStatusRaw: prevSnapshot, stalenessAlertCount: 0 }),
    ]);
    mockGetTicketStatus.mockResolvedValue(4); // still In Progress

    const result = await runLeantimeSync();

    expect(mockSendStalenessL1).toHaveBeenCalledTimes(1);
    expect(mockSendStalenessL1).toHaveBeenCalledWith(
      expect.objectContaining({ id: "idea-1" }),
      expect.objectContaining({ email: opsDept.teamLeadEmail }),
      expect.any(String)
    );
    expect(mockSetStalenessCount).toHaveBeenCalledWith("idea-1", 1);
    expect(result.stale).toBe(1);
  });

  it("sends L2 escalation when still no progress after L1 (count 1→2)", async () => {
    const prevSnapshot = JSON.stringify({ "101": 4 });
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ leantimeStatusRaw: prevSnapshot, stalenessAlertCount: 1 }),
    ]);
    mockGetTicketStatus.mockResolvedValue(4);

    await runLeantimeSync();

    expect(mockSendStalenessL1).not.toHaveBeenCalled();
    expect(mockSendStalenessL2).toHaveBeenCalledTimes(1);
    expect(mockSendStalenessL2).toHaveBeenCalledWith(
      expect.objectContaining({ id: "idea-1" }),
      expect.arrayContaining(["Operations"]),
      expect.objectContaining({ email: config.strategyHead.email })
    );
    expect(mockSetStalenessCount).toHaveBeenCalledWith("idea-1", 2);
  });

  it("sends no emails and does not increment count when already at level 2", async () => {
    const prevSnapshot = JSON.stringify({ "101": 4 });
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ leantimeStatusRaw: prevSnapshot, stalenessAlertCount: 2 }),
    ]);
    mockGetTicketStatus.mockResolvedValue(4);

    await runLeantimeSync();

    expect(mockSendStalenessL1).not.toHaveBeenCalled();
    expect(mockSendStalenessL2).not.toHaveBeenCalled();
    expect(mockSetStalenessCount).not.toHaveBeenCalled();
  });

  it("resets staleness count to 0 when status changes between syncs", async () => {
    const prevSnapshot = JSON.stringify({ "101": 3 }); // was New
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ leantimeStatusRaw: prevSnapshot, stalenessAlertCount: 1 }),
    ]);
    mockGetTicketStatus.mockResolvedValue(4); // now In Progress — changed!

    await runLeantimeSync();

    expect(mockSendStalenessL1).not.toHaveBeenCalled();
    expect(mockSendStalenessL2).not.toHaveBeenCalled();
    expect(mockSetStalenessCount).toHaveBeenCalledWith("idea-1", 0);
  });

  it("skips a ticket that returns null from getTicketStatus, processes others", async () => {
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ leantimeTicketIds: "101, 102" }),
    ]);
    mockGetDeptResponsesForIdea.mockResolvedValue([
      makeDeptResponse({ leantimeTicketId: "101" }),
      makeDeptResponse({ id: "resp-2", department: "IT", leantimeTicketId: "102" }),
    ]);
    mockGetTicketStatus
      .mockResolvedValueOnce(null) // ticket 101 fails
      .mockResolvedValueOnce(4);   // ticket 102 succeeds

    const result = await runLeantimeSync();

    // idea still processed — did not throw
    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(0);
    // sync was still written with partial snapshot
    expect(mockSetLeantimeSync).toHaveBeenCalledTimes(1);
  });

  it("skips idea with no ticket IDs", async () => {
    mockGetActiveIdeasForSync.mockResolvedValue([
      makeIdea({ leantimeTicketIds: null }),
    ]);

    const result = await runLeantimeSync();

    expect(result.processed).toBe(1);
    expect(mockGetTicketStatus).not.toHaveBeenCalled();
    expect(mockSetLeantimeSync).not.toHaveBeenCalled();
  });

  it("captures per-idea errors and continues processing remaining ideas", async () => {
    const goodIdea = makeIdea({ id: "idea-2", title: "Good Idea" });
    mockGetActiveIdeasForSync.mockResolvedValue([makeIdea(), goodIdea]);
    mockGetDeptResponsesForIdea
      .mockRejectedValueOnce(new Error("Notion timeout")) // first idea fails
      .mockResolvedValueOnce([makeDeptResponse({ ideaId: "idea-2" })]);

    const result = await runLeantimeSync();

    expect(result.processed).toBe(1); // only the good idea counted
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("idea-1");
  });
});
```

- [ ] **Step 2: Run the tests — confirm they all fail (module not found)**

Run: `npm test -- --testPathPattern=leantime-sync`
Expected: `FAIL` — `Cannot find module '@/core/leantime-sync'`

---

## Task 6 — Implement `src/core/leantime-sync.ts`

**Files:**
- Create: `src/core/leantime-sync.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/core/leantime-sync.ts
import config from "../../config/departments";
import {
  getActiveIdeasForSync,
  getDeptResponsesForIdea,
  setLeantimeSync,
  setStalenessCount,
  setIdeaCompleted,
} from "@/lib/notion";
import { getTicketStatus } from "@/lib/leantime";
import { sendStalenessL1, sendStalenessL2, sendIdeaCompleted } from "@/lib/email";
import type { Idea, LeantimeStatusSnapshot } from "@/types";

export interface SyncResult {
  processed: number;
  completed: number;
  stale: number;
  errors: string[];
}

const STATUS_LABELS: Record<number, string> = {
  0: "Done ✅",
  [-1]: "Archived ✅",
  3: "New 🔵",
  4: "In Progress 🟡",
  1: "Blocked 🔴",
  2: "Waiting ⏳",
};

function isDone(status: number): boolean {
  return status === 0 || status === -1;
}

function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? `Status ${status}`;
}

interface DeptEntry {
  ticketId: string;
  deptName: string;
  status: number;
  changed: boolean;
}

function buildSummary(entries: DeptEntry[], alertLevel: number, today: string): string {
  const parts = entries.map(({ deptName, status, changed }) => {
    const suffix = !changed && alertLevel > 0 ? " (no change)" : "";
    return `${statusLabel(status)}: ${deptName}${suffix}`;
  });
  const statusLine = parts.join(" · ");

  if (alertLevel === 0) {
    return `${statusLine}\nLast synced: ${today}`;
  }
  if (alertLevel === 1) {
    const staleDepts = entries.filter((e) => !e.changed).map((e) => e.deptName).join(" and ");
    return `⚠️ No progress since last week — ${staleDepts} lead(s) notified\n${statusLine}\nLast synced: ${today}`;
  }
  return `🚨 Escalated — Strategy Head and submitter notified (${alertLevel} weeks no progress)\n${statusLine}\nLast synced: ${today}`;
}

async function processIdea(idea: Idea): Promise<{ completed: boolean; stale: boolean }> {
  console.log(`[leantime-sync] processing idea: ${idea.id} "${idea.title}"`);
  const today = new Date().toISOString().split("T")[0];

  // Step 1: manual override
  if (idea.markComplete) {
    console.log(`[leantime-sync] idea ${idea.id} manually marked complete`);
    await setIdeaCompleted(idea.id);
    await setLeantimeSync(
      idea.id,
      idea.leantimeStatusRaw ?? "{}",
      `✅ Manually marked complete\nLast synced: ${today}`,
      today
    );
    await sendIdeaCompleted(idea, config.strategyHead);
    return { completed: true, stale: false };
  }

  // Parse ticket IDs
  const ticketIds = (idea.leantimeTicketIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!ticketIds.length) {
    console.log(`[leantime-sync] idea ${idea.id} has no ticket IDs, skipping`);
    return { completed: false, stale: false };
  }

  // Step 2: fetch current statuses from Leantime
  const currentSnapshot: LeantimeStatusSnapshot = {};
  for (const id of ticketIds) {
    const status = await getTicketStatus(id);
    if (status !== null) {
      currentSnapshot[id] = status;
    } else {
      console.warn(`[leantime-sync] ticket ${id} for idea ${idea.id} returned null — skipping ticket`);
    }
  }

  // Build ticket → dept mapping from DeptResponse rows
  const deptResponses = await getDeptResponsesForIdea(idea.id);
  const ticketToDept = new Map<string, string>();
  for (const r of deptResponses) {
    if (r.leantimeTicketId) ticketToDept.set(r.leantimeTicketId, r.department);
  }

  // Parse previous snapshot
  const prevSnapshot: LeantimeStatusSnapshot = idea.leantimeStatusRaw
    ? (JSON.parse(idea.leantimeStatusRaw) as LeantimeStatusSnapshot)
    : {};
  const isFirstSync = !idea.leantimeStatusRaw;

  // Build per-dept entries for summary and staleness checks
  const entries: DeptEntry[] = ticketIds
    .filter((id) => currentSnapshot[id] !== undefined)
    .map((id) => ({
      ticketId: id,
      deptName: ticketToDept.get(id) ?? id,
      status: currentSnapshot[id],
      changed: prevSnapshot[id] !== currentSnapshot[id],
    }));

  // Step 3: detect completion
  const fetchedStatuses = Object.values(currentSnapshot);
  if (fetchedStatuses.length > 0 && fetchedStatuses.every(isDone)) {
    console.log(`[leantime-sync] idea ${idea.id} all tickets done — marking completed`);
    await setIdeaCompleted(idea.id);
    await setLeantimeSync(idea.id, JSON.stringify(currentSnapshot), buildSummary(entries, 0, today), today);
    await sendIdeaCompleted(idea, config.strategyHead);
    return { completed: true, stale: false };
  }

  // Step 4: detect staleness
  const hasProgress = entries.some((e) => e.changed);
  let newStalenessCount = idea.stalenessAlertCount;
  let isStale = false;

  if (hasProgress) {
    newStalenessCount = 0;
  } else if (!isFirstSync) {
    const staleEntries = entries.filter((e) => !e.changed);

    if (idea.stalenessAlertCount === 0) {
      // L1: email each stale dept lead individually
      for (const entry of staleEntries) {
        const dept = config.departments.find((d) => d.name === entry.deptName);
        if (dept) {
          await sendStalenessL1(
            idea,
            { name: dept.teamLeadName, email: dept.teamLeadEmail },
            statusLabel(entry.status)
          );
        }
      }
      newStalenessCount = 1;
      isStale = true;
    } else if (idea.stalenessAlertCount === 1) {
      // L2: escalate to Strategy Head + submitter
      const staleDeptNames = staleEntries.map((e) => e.deptName);
      await sendStalenessL2(idea, staleDeptNames, config.strategyHead);
      newStalenessCount = 2;
      isStale = true;
    } else {
      // Count >= 2: fully escalated, log only
      console.log(
        `[leantime-sync] idea ${idea.id} fully escalated (count=${idea.stalenessAlertCount}), no further emails`
      );
    }
  }

  // Step 5: write back to Notion
  const summary = buildSummary(entries, newStalenessCount, today);
  await setLeantimeSync(idea.id, JSON.stringify(currentSnapshot), summary, today);
  if (newStalenessCount !== idea.stalenessAlertCount) {
    await setStalenessCount(idea.id, newStalenessCount);
  }

  return { completed: false, stale: isStale };
}

export async function runLeantimeSync(): Promise<SyncResult> {
  console.log("[leantime-sync] starting sync");
  const ideas = await getActiveIdeasForSync();
  console.log(`[leantime-sync] found ${ideas.length} active ideas`);

  const result: SyncResult = { processed: 0, completed: 0, stale: 0, errors: [] };

  for (const idea of ideas) {
    try {
      const { completed, stale } = await processIdea(idea);
      result.processed++;
      if (completed) result.completed++;
      if (stale) result.stale++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[leantime-sync] error processing idea ${idea.id}:`, err);
      result.errors.push(`idea ${idea.id}: ${msg}`);
    }
  }

  console.log(
    `[leantime-sync] done. processed=${result.processed}, completed=${result.completed}, stale=${result.stale}, errors=${result.errors.length}`
  );
  return result;
}
```

- [ ] **Step 2: Run the tests — all 12 should pass**

Run: `npm test -- --testPathPattern=leantime-sync`
Expected: `PASS src/__tests__/leantime-sync.test.ts` — 12 tests passing

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `npm test`
Expected: All tests pass. No regressions in `router.test.ts` or `processor.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/notion.ts src/lib/leantime.ts src/lib/email.ts src/core/leantime-sync.ts src/__tests__/leantime-sync.test.ts
git commit -m "feat: Leantime → Notion sync — types, lib extensions, core logic, tests"
```

---

## Task 7 — Create `src/app/api/leantime-sync/route.ts`

**Files:**
- Create: `src/app/api/leantime-sync/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/app/api/leantime-sync/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runLeantimeSync } from "@/core/leantime-sync";

export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  console.log("[leantime-sync] POST /api/leantime-sync triggered");

  try {
    const result = await runLeantimeSync();
    return NextResponse.json({
      ...result,
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[leantime-sync] fatal error:", err);
    return NextResponse.json(
      { error: message, duration_ms: Date.now() - start },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. Route is registered at `/api/leantime-sync`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leantime-sync/route.ts
git commit -m "feat: add POST /api/leantime-sync endpoint with Bearer auth guard"
```

---

## Task 8 — Create `.github/workflows/leantime-sync.yml`

**Files:**
- Create: `.github/workflows/leantime-sync.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Leantime Sync

on:
  schedule:
    - cron: '0 9 * * 0'   # Every Sunday at 09:00 UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger leantime-sync endpoint
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${{ secrets.APP_URL }}/api/leantime-sync" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json")
          echo "HTTP status: $response"
          if [ "$response" != "200" ]; then
            echo "Leantime sync endpoint returned $response — expected 200"
            exit 1
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/leantime-sync.yml
git commit -m "feat: add Sunday 9am GitHub Actions cron for Leantime sync"
```

- [ ] **Step 3: Final build and test run**

Run: `npm run build && npm test`
Expected: Build succeeds. All tests pass.

---

## Deployment Checklist (user actions, not code)

After all code tasks are done:

1. In Notion, open the **Ideas** database and add these 5 properties exactly as named:
   - `Leantime Status Raw` — type: **Text**
   - `Leantime Summary` — type: **Text**
   - `Leantime Last Synced` — type: **Date**
   - `Staleness Alert Count` — type: **Number**
   - `Mark Complete` — type: **Checkbox**

2. Create a **"Completed Ideas"** view in the Ideas database: filter `Status = Completed`, sort `Last Processed At` descending.

3. Deploy to Vercel: `vercel --prod` (or push to main if auto-deploy is configured).

4. Enable the `Leantime Sync` workflow in GitHub Actions → Actions tab.

5. Test via workflow_dispatch: trigger `Leantime Sync` manually and verify at least one active idea gets its `Leantime Summary` updated in Notion.
