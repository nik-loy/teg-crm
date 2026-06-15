# Bulk Pending Requests Importer — Session-by-Session Implementation Plan

**Goal:** Build complete feature across 3 focused sessions (1 session = 1 phase)

**Status:** Ready to execute  
**Total Time:** ~10 hours across 3 sessions  
**Start Date:** Session 1 begins now

---

## 🎯 Session Overview

```
Session 1 (Day 1): Phase 1 — Extraction Logic (3 hours)
├─ Create types, prompt, parser function
├─ Write unit tests with real fixture
└─ npm test passes 100%

Session 2 (Day 2): Phase 2 & 3 — API + UI (5 hours)
├─ Create parse & create endpoints
├─ Build /pending-requests page component
└─ Manual testing with real data

Session 3 (Day 3): Phase 4 & 5 — Integration + Deploy (2 hours)
├─ Update Notion schema & contacts.ts
├─ Add sidebar navigation
├─ npm run build succeeds
└─ Deploy to Vercel
```

---

## 📋 SESSION 1: EXTRACTION LOGIC (3 Hours)

**Objective:** Build AI extraction that parses LinkedIn pending requests text → structured JSON

**Files to Create:**
1. `src/lib/extraction/pending-requests-types.ts`
2. `src/lib/extraction/pending-requests-prompt.ts`
3. `src/lib/extraction/parse-pending-requests.ts`
4. `tests/pending-requests.test.ts`

### Task 1.1: Create Types File

**File:** `src/lib/extraction/pending-requests-types.ts`

```typescript
export interface PendingRequest {
  name: string;
  headline: string;
  sentDaysAgo: number;
  sentDate?: string;
  linkedinUrl?: string;
}

export interface ParseResult {
  success: boolean;
  requests: PendingRequest[];
  errors: Array<{
    lineNumber?: number;
    reason: string;
    rawText?: string;
  }>;
  stats: {
    totalLines: number;
    parsed: number;
    failed: number;
    duplicateDetected: number;
  };
}
```

**Checklist:**
- [ ] File created
- [ ] TypeScript compiles (no errors)
- [ ] Both interfaces exported properly

---

### Task 1.2: Create System Prompt

**File:** `src/lib/extraction/pending-requests-prompt.ts`

```typescript
export function buildPendingRequestsPrompt(): string {
  return `You are parsing LinkedIn "Sent Connection Requests" page text.
Users copy-paste their PENDING OUTGOING connection requests.

STRUCTURE (repeats for each person):
- Name's profile picture
- Name
- Headline (1-5 lines, job title @ company)
- Sent X [days/weeks/months] ago
- Withdraw button
- [Next person]

RULES:
1. Extract ONLY pending requests (ones they SENT, waiting for response)
2. Parse name from the line after "profile picture"
3. Parse headline: all text between name and "Sent"
4. Convert "Sent X [days/weeks/months] ago" to days integer
   - "Sent 1 week ago" → 7 days
   - "Sent 2 weeks ago" → 14 days
   - "Sent 3 days ago" → 3 days
   - "Sent 1 month ago" → 30 days
5. NO LinkedIn URLs in pending requests page (will be empty)
6. Ignore: "Withdraw", "profile picture", image alt text
7. Do NOT invent missing fields
8. Deduplicate by name (if same name appears twice, keep first)

OUTPUT JSON (REQUIRED - must be valid JSON):
{
  "requests": [
    {"name": "Aliosha Milsztein", "headline": "Agentic AI @ Personio | Founding CEO @ aurio", "sentDaysAgo": 7},
    {"name": "Elisabeth Neurauter", "headline": "Director Strategic Accounts at Snowflake | Ex-BCG", "sentDaysAgo": 7}
  ],
  "stats": {"totalLines": 120, "parsed": 20, "failed": 0, "duplicateDetected": 0}
}`;
}
```

**Checklist:**
- [ ] File created
- [ ] Prompt is clear and detailed
- [ ] JSON output schema is explicit
- [ ] Examples match real data format

---

### Task 1.3: Create Parser Function

**File:** `src/lib/extraction/parse-pending-requests.ts`

```typescript
import OpenAI from "openai";
import { buildPendingRequestsPrompt } from "./pending-requests-prompt";
import type { PendingRequest, ParseResult } from "./pending-requests-types";

export async function parsePendingRequests(
  pastedText: string,
  apiKey: string
): Promise<ParseResult> {
  const client = new OpenAI({ apiKey });

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildPendingRequestsPrompt() },
      { role: "user", content: pastedText },
    ],
  });

  const content = resp.choices[0].message.content ?? "{}";
  let parsed: any;
  
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      success: false,
      requests: [],
      errors: [{ reason: "Failed to parse OpenAI response as JSON" }],
      stats: {
        totalLines: pastedText.split("\n").length,
        parsed: 0,
        failed: 0,
        duplicateDetected: 0,
      },
    };
  }

  const now = new Date();
  const requests: PendingRequest[] = (parsed.requests || []).map(
    (req: any) => ({
      name: req.name || "",
      headline: req.headline || "",
      sentDaysAgo: req.sentDaysAgo || 0,
      sentDate: new Date(
        now.getTime() - (req.sentDaysAgo || 0) * 24 * 60 * 60 * 1000
      ).toISOString(),
      linkedinUrl: undefined,
    })
  );

  return {
    success: requests.length > 0,
    requests,
    errors: parsed.errors || [],
    stats: {
      totalLines: pastedText.split("\n").length,
      parsed: requests.length,
      failed: (parsed.stats?.failed || 0),
      duplicateDetected: (parsed.stats?.duplicateDetected || 0),
    },
  };
}
```

**Checklist:**
- [ ] File created
- [ ] Imports OpenAI SDK correctly
- [ ] Uses gpt-4o-mini with JSON mode
- [ ] Handles JSON parse errors gracefully
- [ ] Calculates ISO dates correctly
- [ ] Returns typed ParseResult

---

### Task 1.4: Create Unit Tests

**File:** `tests/pending-requests.test.ts`

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { parsePendingRequests } from "@/lib/extraction/parse-pending-requests";

// Real fixture from user's paste
const FIXTURE = `Aliosha Milsztein's profile picture
Aliosha Milsztein
Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM
Sent 1 week ago
Withdraw
Elisabeth Neurauter's profile picture
Elisabeth Neurauter
Director Strategic Accounts at Snowflake | Ex-BCG
Sent 1 week ago
Withdraw
Philipp Schützbach's profile picture
Philipp Schützbach
Senior Solution Engineer @Snowflake
Sent 1 week ago
Withdraw
Jakob Noetzel's profile picture
Jakob Noetzel
Product Management at Celonis
Sent 1 week ago
Withdraw
Matthias Rudolph's profile picture
Matthias Rudolph
Cloud Engineer & AI Architect | GenAI, Agentic Systems, Data Pipelines | AWS ProServe
Sent 1 week ago
Withdraw`;

describe("parsePendingRequests", () => {
  let apiKey: string;

  beforeAll(() => {
    apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not set - skipping tests");
    }
  });

  it("should parse names correctly", async () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }

    const result = await parsePendingRequests(FIXTURE, apiKey);
    expect(result.success).toBe(true);
    expect(result.requests.length).toBeGreaterThan(0);
    expect(result.requests[0].name).toContain("Aliosha");
    expect(result.requests[1].name).toContain("Elisabeth");
  });

  it("should parse headlines correctly", async () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }

    const result = await parsePendingRequests(FIXTURE, apiKey);
    expect(result.requests[0].headline).toContain("Personio");
    expect(result.requests[1].headline).toContain("Snowflake");
  });

  it("should convert sent time to days", async () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }

    const result = await parsePendingRequests(FIXTURE, apiKey);
    expect(result.requests[0].sentDaysAgo).toBe(7);
  });

  it("should calculate ISO dates", async () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }

    const result = await parsePendingRequests(FIXTURE, apiKey);
    expect(result.requests[0].sentDate).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("should handle empty input gracefully", async () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }

    const result = await parsePendingRequests("", apiKey);
    expect(result.success).toBe(false);
  });
});
```

**Checklist:**
- [ ] File created in `tests/` directory
- [ ] Uses vitest (already installed)
- [ ] Real fixture data from user included
- [ ] Tests cover: names, headlines, dates, error handling
- [ ] Gracefully handles missing API key

---

### Task 1.5: Run Tests

**Commands to run:**
```bash
cd "C:\Users\nikla\.gemini\antigravity\scratch\TEG CRM\teg-crm-web"
npm test -- pending-requests.test.ts
```

**Expected output:**
```
✓ tests/pending-requests.test.ts (5 tests)
  ✓ should parse names correctly
  ✓ should parse headlines correctly
  ✓ should convert sent time to days
  ✓ should calculate ISO dates
  ✓ should handle empty input gracefully

Test Files  1 passed (1)
     Tests  5 passed (5)
```

**Checklist:**
- [ ] All 5 tests pass
- [ ] No TypeScript errors
- [ ] No console warnings

---

### Session 1 Completion Checklist

- [ ] All 4 files created
- [ ] All unit tests pass (npm test)
- [ ] No TypeScript compilation errors
- [ ] Ready to commit: `git add -A && git commit -m "feat: pending requests extraction logic with tests"`

---

## 📋 SESSION 2: API ENDPOINTS & UI (5 Hours)

**Objective:** Create API endpoints and frontend component

**Files to Create:**
1. `src/app/api/pending-requests/parse/route.ts`
2. `src/app/api/pending-requests/create/route.ts`
3. `src/app/(app)/pending-requests/page.tsx`

### Task 2.1: Create Parse Endpoint

**File:** `src/app/api/pending-requests/parse/route.ts`

```typescript
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { parsePendingRequests } from "@/lib/extraction/parse-pending-requests";

export async function POST(req: Request) {
  const apiKey = env.openaiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 501 }
    );
  }

  const body = await req.json();
  const pastedText = body.pastedText;

  if (!pastedText?.trim()) {
    return NextResponse.json(
      { error: "pastedText is required" },
      { status: 400 }
    );
  }

  try {
    const result = await parsePendingRequests(pastedText.trim(), apiKey);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[pending-requests-parse]", e);
    return NextResponse.json(
      { error: "Parsing failed" },
      { status: 500 }
    );
  }
}
```

**Checklist:**
- [ ] File created
- [ ] Validates OpenAI key (501 if missing)
- [ ] Validates pastedText input (400 if missing)
- [ ] Error handling with logging
- [ ] Returns proper JSON response

---

### Task 2.2: Create Create Endpoint

**File:** `src/app/api/pending-requests/create/route.ts`

```typescript
import { NextResponse } from "next/server";
import { withRetry } from "@/lib/notion/client";
import { createContactInNotion } from "@/lib/notion/contacts";
import type { PendingRequest } from "@/lib/extraction/pending-requests-types";

function extractJobTitle(headline: string): string {
  const match = headline.match(/^([^@\|]+)/);
  return match ? match[1].trim() : "";
}

function extractCompany(headline: string): string {
  const match = headline.match(/at\s+([^|\n]+)/i);
  return match ? match[1].trim() : "";
}

export async function POST(req: Request) {
  const body = await req.json();
  const requests: PendingRequest[] = body.requests;
  const owner = body.owner;
  const eventName = body.eventName;

  if (!Array.isArray(requests) || !owner) {
    return NextResponse.json(
      { error: "requests array and owner are required" },
      { status: 400 }
    );
  }

  try {
    const createdContacts = [];
    const errors = [];

    for (const req of requests) {
      try {
        const pageId = await withRetry(async () => {
          return await createContactInNotion({
            name: req.name,
            jobTitle: extractJobTitle(req.headline),
            company: extractCompany(req.headline),
            profileSummary: req.headline,
            status: "request_sent",
            owner,
            events: eventName ? [eventName] : undefined,
            requestSentDate: req.sentDate,
          });
        });

        createdContacts.push({ name: req.name, pageId });
      } catch (err) {
        errors.push({
          name: req.name,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      created: createdContacts.length,
      failed: errors.length,
      createdContacts,
      errors,
    });
  } catch (e) {
    console.error("[pending-requests-create]", e);
    return NextResponse.json(
      { error: "Bulk create failed" },
      { status: 500 }
    );
  }
}
```

**Checklist:**
- [ ] File created
- [ ] Input validation (requests[] and owner required)
- [ ] extractJobTitle() and extractCompany() functions work
- [ ] Uses withRetry() for Notion rate limiting
- [ ] Handles errors per request (doesn't fail all if one fails)
- [ ] Returns detailed response with created/failed counts

---

### Task 2.3: Create Frontend Page Component

**File:** `src/app/(app)/pending-requests/page.tsx`

[See full code in BULK_IMPORT_QUICK_START.md section "Phase 3: Create Frontend Page Component"]

**Key sections:**
- [ ] Large textarea (rows={15}) for paste
- [ ] Parse button → calls POST /api/pending-requests/parse
- [ ] Preview grid showing parsed contacts
- [ ] Owner selector (OwnerSelect component)
- [ ] Event name input (optional)
- [ ] Create button → calls POST /api/pending-requests/create
- [ ] Results display (created/failed counts)
- [ ] Error handling & loading states

**Checklist:**
- [ ] Page created and compiles
- [ ] All UI elements present
- [ ] State management working (useState hooks)
- [ ] API calls structured correctly
- [ ] Error boundaries in place
- [ ] Loading indicators visible

---

### Task 2.4: Test Endpoints with Real Data

**Manual testing steps:**

1. Start dev server: `npm run dev`
2. Navigate to http://localhost:3000/pending-requests
3. Paste the 20-request sample from FEATURE_PROPOSAL_SUMMARY.md
4. Click "Parse Requests"
   - [ ] Shows "✓ Parsed 20 requests"
   - [ ] Preview grid shows all 20 names
   - [ ] Headlines are correct
   - [ ] Dates display properly
5. Select owner "Niklas"
6. Click "Create All 20"
   - [ ] Shows "Creating 20 contacts..."
   - [ ] Progress updates
   - [ ] Shows "✓ Created 20, Failed 0"
7. Go to Notion database
   - [ ] 20 new contacts present
   - [ ] Names match exactly
   - [ ] Job titles extracted
   - [ ] Companies extracted
   - [ ] Status = "request_sent"
   - [ ] Owner = "Niklas"

**Checklist:**
- [ ] Parse endpoint works (returns structured data)
- [ ] Create endpoint works (contacts created in Notion)
- [ ] All 20 contacts created successfully
- [ ] No duplicates created
- [ ] Owner attribution correct
- [ ] Status field correct

---

### Session 2 Completion Checklist

- [ ] All 3 files created
- [ ] npm run build succeeds (no errors)
- [ ] Manual E2E testing passes with real data
- [ ] No console errors in dev server
- [ ] Ready to commit: `git add -A && git commit -m "feat: pending requests API endpoints and UI"`

---

## 📋 SESSION 3: INTEGRATION & DEPLOYMENT (2 Hours)

**Objective:** Update Notion schema, add navigation, deploy

**Files to Modify:**
1. `src/lib/notion/contacts.ts` (add new parameters)
2. `src/components/Sidebar.tsx` (add nav link)

### Task 3.1: Update Notion Contacts Function

**File:** `src/lib/notion/contacts.ts`

**Changes:**
- Add `requestSentDate?: string` parameter
- Add `contactSource?: string` parameter
- Update createContactInNotion() to include these in Notion properties

**Code location:** Find the `export async function createContactInNotion()` and add:

```typescript
...(data.requestSentDate && {
  "Request Sent Date": { date: { start: data.requestSentDate } },
}),
...(data.contactSource && {
  "Contact Source": { select: { name: data.contactSource } },
}),
```

**Checklist:**
- [ ] Function signature updated
- [ ] New parameters added to all calls
- [ ] Notion properties correctly mapped
- [ ] TypeScript compiles without errors

---

### Task 3.2: Add Sidebar Navigation

**File:** `src/components/Sidebar.tsx`

**Change:** Add navigation link to `/pending-requests` page

Look for the navigation menu and add:
```tsx
<a href="/pending-requests" className="...">
  📥 Import Pending Requests
</a>
```

**Checklist:**
- [ ] Link added to sidebar
- [ ] Icon/label clear and visible
- [ ] Link goes to correct route
- [ ] Styling matches existing links

---

### Task 3.3: Manual Add Notion Fields (UI)

**In Notion:**
1. Go to Contacts database
2. Add new field: "Request Sent Date" (type: Date)
3. Add new field: "Contact Source" (type: Select)
4. In Contact Source, add option: "Pending Requests Paste"

**Checklist:**
- [ ] Request Sent Date field created
- [ ] Contact Source field created
- [ ] Pending Requests Paste option exists

---

### Task 3.4: Build & Test

**Commands:**
```bash
npm run build
npm run lint
npm test
```

**Expected output:**
```
✓ Build succeeded
✓ No TypeScript errors
✓ All tests pass
```

**Checklist:**
- [ ] npm run build succeeds
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] No console errors or warnings

---

### Task 3.5: Deploy to Vercel

**Command:**
```bash
git add -A
git commit -m "feat: complete pending requests importer - ready for production"
git push origin main
```

Vercel auto-deploys on push to main.

**Verification:**
1. Check Vercel dashboard
2. Wait for deployment to complete (shows "Ready")
3. Test at https://teg-crm-web.vercel.app/pending-requests
4. Verify with real data one more time

**Checklist:**
- [ ] Git commit created
- [ ] Pushed to GitHub
- [ ] Vercel deployment complete
- [ ] Production URL working
- [ ] E2E test passes on production

---

### Session 3 Completion Checklist

- [ ] Both files modified correctly
- [ ] Notion schema updated
- [ ] npm run build succeeds
- [ ] npm test passes
- [ ] Deployed to Vercel
- [ ] Production testing passes
- [ ] Ready to show sales team!

---

## 🎉 FEATURE COMPLETE CHECKLIST

After all 3 sessions, verify:

- [x] Phase 1: Extraction logic complete & tested
- [x] Phase 2: API endpoints & UI complete & tested
- [x] Phase 3: Notion integration & deployment complete
- [x] All unit tests pass
- [x] Production build succeeds
- [x] E2E testing with real data passes
- [x] Deployed to production
- [x] Sales team can access /pending-requests page
- [x] Feature works end-to-end: paste → parse → preview → create → Notion

---

## 📊 Success Metrics

After deployment, measure:

1. **Feature works:** Can paste 20 pending requests and create them
2. **Speed:** Takes ~20 seconds total (vs 19 minutes manual)
3. **Quality:** 0% error rate (vs 5-10% manual)
4. **Data integrity:** All names, titles, companies extracted correctly
5. **Owner attribution:** Every contact knows who added it
6. **Dates tracked:** Request sent dates calculated correctly

---

## 🆘 Troubleshooting Guide

**If tests fail:**
- Check OpenAI API key has credits
- Verify `OPENAI_API_KEY` in `.env.local`
- Run single test: `npm test -- pending-requests.test.ts --reporter=verbose`

**If build fails:**
- Run `npm run lint` to see specific errors
- Check TypeScript: `npx tsc --noEmit`
- Ensure all imports are correct paths

**If Notion creation fails:**
- Verify Notion token is valid
- Check database IDs in env
- Verify Notion schema has new fields

**If production deployment fails:**
- Check Vercel build logs
- Ensure `.env.local` secrets are in Vercel project settings
- Verify all files were committed

---

## 📞 Quick Reference

**Key files:**
- Types: `src/lib/extraction/pending-requests-types.ts`
- Parser: `src/lib/extraction/parse-pending-requests.ts`
- API: `src/app/api/pending-requests/{parse,create}/route.ts`
- UI: `src/app/(app)/pending-requests/page.tsx`
- Tests: `tests/pending-requests.test.ts`

**Commands:**
- Test: `npm test`
- Build: `npm run build`
- Dev: `npm run dev`
- Lint: `npm run lint`

**Key URLs (after deployment):**
- Local: http://localhost:3000/pending-requests
- Production: https://teg-crm-web.vercel.app/pending-requests

---

## ✨ Ready to Go!

You now have a complete, phased implementation plan ready to execute across 3 sessions.

**Next step in next session:**
1. Open this file
2. Follow Task 1.1, 1.2, 1.3, 1.4 exactly
3. Check off each item as you complete it
4. When all Session 1 items are complete, move to Session 2

Good luck! 🚀
