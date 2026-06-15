# Bulk LinkedIn Pending Requests Importer — Implementation Plan

**Goal:** Enable sales reps to paste their entire LinkedIn "Pending Connection Requests" page and auto-create multiple contacts in Notion with a single action, marked as `request_sent`.

**Why:** 
- Screenshot upload is token-intensive and slow (OCR → parsing)
- Copy-paste text is instant and cheap (direct parsing)
- Bulk import reduces manual data entry by 80%+
- Sales reps can log 20+ requests in 30 seconds

**Success Metrics:**
- Parse 20+ pending requests from single paste
- Create 20+ contacts in <5 seconds
- 0 manual field entry required
- Sales rep attribution (owner field set correctly)

---

## Phase 1: Extraction & Parsing (Core Logic)

### 1.1 Create Extraction Types & Schema

**File:** `src/lib/extraction/pending-requests-types.ts` (NEW)

```typescript
export interface PendingRequest {
  name: string;                    // "Aliosha Milsztein"
  headline: string;                // "Agentic AI @ Personio..."
  sentDaysAgo: number;             // 7
  sentDate?: string;               // ISO date (calculated)
  linkedinUrl?: string;            // Will be empty initially
}

export interface ParseResult {
  success: boolean;
  requests: PendingRequest[];
  errors: Array<{
    lineNumber: number;
    reason: string;
    rawText: string;
  }>;
  stats: {
    totalLines: number;
    parsed: number;
    failed: number;
    duplicateDetected: number;
  };
}
```

### 1.2 Create Extraction Prompt

**File:** `src/lib/extraction/pending-requests-prompt.ts` (NEW)

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
5. NO LinkedIn URLs in pending requests page (will be empty)
6. Ignore: "Withdraw", "profile picture", image alt text
7. Do NOT invent missing fields
8. Deduplicate by name (if same name appears twice, keep first)

OUTPUT JSON:
{
  "requests": [
    {"name": "Aliosha Milsztein", "headline": "Agentic AI @ Personio | Founding CEO @ aurio", "sentDaysAgo": 7},
    {"name": "Elisabeth Neurauter", "headline": "Director Strategic Accounts at Snowflake | Ex-BCG", "sentDaysAgo": 7}
  ],
  "stats": {"totalLines": 120, "parsed": 20, "failed": 0, "duplicateDetected": 0}
}`;
}
```

### 1.3 Create Parser Function

**File:** `src/lib/extraction/parse-pending-requests.ts` (NEW)

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
  const parsed = JSON.parse(content);

  // Enrich: calculate sent date
  const now = new Date();
  const requests: PendingRequest[] = (parsed.requests || []).map(
    (req: any) => ({
      name: req.name || "",
      headline: req.headline || "",
      sentDaysAgo: req.sentDaysAgo || 0,
      sentDate: new Date(now.getTime() - (req.sentDaysAgo || 0) * 24 * 60 * 60 * 1000).toISOString(),
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

### 1.4 Unit Tests

**File:** `tests/pending-requests.test.ts` (NEW)

```typescript
import { describe, it, expect } from "vitest";
import { parsePendingRequests } from "@/lib/extraction/parse-pending-requests";

// Real fixture from the user's paste
const FIXTURE = `Aliosha Milsztein's profile picture
Aliosha Milsztein
Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM
Sent 1 week ago
Withdraw
Elisabeth Neurauter's profile picture
Elisabeth Neurauter
Director Strategic Accounts at Snowflake | Ex-BCG
Sent 1 week ago
Withdraw`;

describe("parsePendingRequests", () => {
  it("parses names correctly", async () => {
    const result = await parsePendingRequests(FIXTURE, process.env.OPENAI_API_KEY!);
    expect(result.requests[0].name).toBe("Aliosha Milsztein");
    expect(result.requests[1].name).toBe("Elisabeth Neurauter");
  });

  it("parses headlines correctly", async () => {
    const result = await parsePendingRequests(FIXTURE, process.env.OPENAI_API_KEY!);
    expect(result.requests[0].headline).toContain("Personio");
    expect(result.requests[1].headline).toContain("Snowflake");
  });

  it("converts sent time to days", async () => {
    const result = await parsePendingRequests(FIXTURE, process.env.OPENAI_API_KEY!);
    expect(result.requests[0].sentDaysAgo).toBe(7);
  });

  it("calculates ISO dates", async () => {
    const result = await parsePendingRequests(FIXTURE, process.env.OPENAI_API_KEY!);
    expect(result.requests[0].sentDate).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

---

## Phase 2: API Endpoint (Server Route)

### 2.1 Create Bulk Import Endpoint

**File:** `src/app/api/pending-requests/parse/route.ts` (NEW)

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

### 2.2 Create Bulk Create Endpoint

**File:** `src/app/api/pending-requests/create/route.ts` (NEW)

```typescript
import { NextResponse } from "next/server";
import { withRetry } from "@/lib/notion/client";
import { createContactInNotion } from "@/lib/notion/contacts";
import type { PendingRequest } from "@/lib/extraction/pending-requests-types";

export async function POST(req: Request) {
  const body = await req.json();
  const requests: PendingRequest[] = body.requests;
  const owner = body.owner; // Sales rep who submitted
  const eventName = body.eventName; // Optional: tag with event

  if (!Array.isArray(requests) || !owner) {
    return NextResponse.json(
      { error: "requests array and owner are required" },
      { status: 400 }
    );
  }

  try {
    const createdContacts = [];
    const errors = [];

    // Create contacts in parallel (with Notion rate limiting)
    for (const req of requests) {
      try {
        const pageId = await withRetry(async () => {
          return createContactInNotion({
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

function extractJobTitle(headline: string): string {
  // "Director Strategic Accounts at Snowflake | Ex-BCG"
  // → "Director Strategic Accounts"
  return headline.split(/\s+at\s+|\s*\|/)[0].trim();
}

function extractCompany(headline: string): string {
  // "Director Strategic Accounts at Snowflake | Ex-BCG"
  // → "Snowflake"
  const match = headline.match(/at\s+([^|\n]+)/);
  return match ? match[1].trim() : "";
}
```

---

## Phase 3: UI Component (Frontend)

### 3.1 Create Pending Requests Upload Page

**File:** `src/app/(app)/pending-requests/page.tsx` (NEW)

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OwnerSelect } from "@/components/OwnerSelect";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { PendingRequest, ParseResult } from "@/lib/extraction/pending-requests-types";

export default function PendingRequestsPage() {
  const [pastedText, setPastedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [creating, setCreating] = useState(false);
  const [creationResult, setCreationResult] = useState<any>(null);

  // Step 1: Parse pasted text
  async function handleParse() {
    setParsing(true);
    setParseResult(null);
    try {
      const res = await fetch("/api/pending-requests/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastedText }),
      });

      if (!res.ok) throw new Error("Parsing failed");
      const result = await res.json();
      setParseResult(result);
    } catch (err) {
      setParseResult({
        success: false,
        requests: [],
        errors: [{ reason: err instanceof Error ? err.message : "Unknown error" }],
        stats: { totalLines: 0, parsed: 0, failed: 0, duplicateDetected: 0 },
      });
    } finally {
      setParsing(false);
    }
  }

  // Step 2: Create all contacts
  async function handleCreateAll() {
    if (!parseResult?.requests.length) return;
    if (!selectedOwner) {
      alert("Please select an owner");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/pending-requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: parseResult.requests,
          owner: selectedOwner,
          eventName: selectedEvent || undefined,
        }),
      });

      if (!res.ok) throw new Error("Creation failed");
      const result = await res.json();
      setCreationResult(result);
      setPastedText("");
      setParseResult(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create contacts");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Bulk Import Pending Requests</h1>

      {/* Step 1: Paste */}
      <Card>
        <CardHeader>
          <CardTitle>1. Paste LinkedIn Pending Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            rows={15}
            placeholder="Go to LinkedIn → Network → Requests to connect (sent)
Copy ALL text from that page and paste here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="w-full rounded-lg border p-3 font-mono text-sm"
          />
          <Button
            onClick={handleParse}
            disabled={parsing || !pastedText.trim()}
            className="w-full"
          >
            {parsing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Parsing...
              </>
            ) : (
              "Parse Requests"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Preview & Select Owner */}
      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Review Parsed Requests ({parseResult.stats.parsed} found)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parseResult.stats.parsed === 0 ? (
              <p className="text-red-600">No requests parsed. Check the format and try again.</p>
            ) : (
              <>
                <div className="max-h-96 overflow-y-auto space-y-2 border rounded p-3">
                  {parseResult.requests.map((req, i) => (
                    <div key={i} className="border-b pb-2 text-sm">
                      <p className="font-semibold">{req.name}</p>
                      <p className="text-xs text-gray-600">{req.headline}</p>
                      <p className="text-xs text-gray-500">Sent {req.sentDaysAgo} days ago</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Who submitted these requests?
                    </label>
                    <OwnerSelect value={selectedOwner} onChange={setSelectedOwner} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Tag with event (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cloudfest 2026"
                      value={selectedEvent}
                      onChange={(e) => setSelectedEvent(e.target.value)}
                      className="w-full rounded-lg border p-2 text-sm"
                    />
                  </div>

                  <Button
                    onClick={handleCreateAll}
                    disabled={creating || !selectedOwner}
                    className="w-full"
                    variant="default"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Creating {parseResult.stats.parsed} contacts...
                      </>
                    ) : (
                      `Create All ${parseResult.stats.parsed} Contacts`
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Results */}
      {creationResult && (
        <Card className={creationResult.created > 0 ? "border-green-500" : "border-red-500"}>
          <CardHeader>
            <CardTitle>✅ Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-2xl font-bold text-green-600">
                  {creationResult.created}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {creationResult.failed}
                </p>
              </div>
            </div>

            {creationResult.failed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-semibold text-red-800 mb-2">Errors:</p>
                {creationResult.errors.map((err: any, i: number) => (
                  <p key={i} className="text-xs text-red-700">
                    {err.name}: {err.reason}
                  </p>
                ))}
              </div>
            )}

            <Button onClick={() => setCreationResult(null)} className="w-full">
              Import More
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Phase 4: Notion Schema Update

### 4.1 Add Fields to Contacts Database

**New optional fields in Notion Contacts DB:**

| Property | Type | Purpose |
|----------|------|---------|
| `Request Sent Date` | Date | When the connection request was sent (from "Sent X ago") |
| `Contact Source` | Select | "Pending Requests Paste" / "Screenshot" / "Manual" / "LinkedIn CSV" |
| `Bulk Import ID` | Text | Correlate contacts from same paste batch |

### 4.2 Update Contact Creation Function

**File:** `src/lib/notion/contacts.ts` (UPDATE)

```typescript
export async function createContactInNotion(data: {
  name: string;
  jobTitle?: string;
  company?: string;
  profileSummary?: string;
  status?: string;
  owner?: string;
  events?: string[];
  requestSentDate?: string;  // NEW
  contactSource?: string;    // NEW: "Pending Requests Paste"
}) {
  // ... existing code ...
  
  const properties: Record<string, any> = {
    Name: { title: [{ text: { content: data.name } }] },
    // ... existing fields ...
    ...(data.requestSentDate && {
      "Request Sent Date": { date: { start: data.requestSentDate } },
    }),
    ...(data.contactSource && {
      "Contact Source": { select: { name: data.contactSource } },
    }),
  };

  // ... rest of implementation ...
}
```

---

## Phase 5: Navigation & UX

### 5.1 Add to Sidebar

**File:** `src/components/Sidebar.tsx` (UPDATE)

Add new link under "Sales Operations":
```
- Add Contact (manual or screenshot)
- Import Pending Requests (NEW) ← New feature
- View Pipeline
- Manage Contacts
```

### 5.2 Dashboard Integration

**Optional:** Show quick-import button on `/today` dashboard

---

## Implementation Sequence

1. **Phase 1 (Day 1):** Extraction logic + tests
   - Unit tests with real fixture data
   - Verify parsing accuracy
   - Edge case handling

2. **Phase 2 (Day 1-2):** API endpoints
   - `/api/pending-requests/parse` (parse + validate)
   - `/api/pending-requests/create` (bulk create)
   - Error handling + rate limiting

3. **Phase 3 (Day 2):** UI component
   - Textarea + parse button
   - Preview grid of parsed contacts
   - Owner selector
   - Progress indicator
   - Results summary

4. **Phase 4 (Day 3):** Notion integration
   - Update schema
   - Add request_sent_date field
   - Add contact_source field
   - Test E2E creation

5. **Phase 5 (Day 3):** Polish + testing
   - Sidebar navigation
   - Error messages
   - Success notifications
   - Real-world testing with sales reps

---

## Expected Performance

| Metric | Value |
|--------|-------|
| Parse 20 requests | <3s |
| Create 20 contacts | <10s |
| Memory usage | <50MB |
| API calls | 2 (1 parse + 1 batch create) |
| Token usage | ~500 tokens total |
| Notion API calls | 20+ (rate-limited) |

---

## Testing Strategy

### Manual Testing Fixture
```
[Use the 20-request sample from user]
- Verify all 20 names extracted
- Verify all headlines correct
- Verify dates calculated
- Verify Notion contacts created
- Verify owner set correctly
- Verify status = "request_sent"
```

### Edge Cases
- [ ] Duplicate names in same paste
- [ ] Very long headlines (3-4 lines)
- [ ] Special characters in names
- [ ] Empty/blank lines in paste
- [ ] Incomplete entries at end of paste
- [ ] Mixed "days", "weeks", "months" ago
- [ ] Names with special characters (ü, ö, á, etc.)

### Integration Tests
- [ ] Parse → Create → Verify in Notion
- [ ] Bulk create doesn't duplicate
- [ ] Owner field set correctly
- [ ] Status field = "request_sent"
- [ ] Dates calculated correctly
- [ ] Event tags applied if provided

---

## Deployment Checklist

- [ ] Notion schema updated (Request Sent Date, Contact Source fields)
- [ ] OpenAI API key configured
- [ ] All 5 phases implemented
- [ ] Unit tests passing (100% coverage of parsing)
- [ ] E2E test with real pending requests sample
- [ ] Sales rep UAT feedback
- [ ] Sidebar navigation added
- [ ] Error handling complete
- [ ] Deploy to Vercel
- [ ] Train sales team on feature

---

## Future Enhancements (Phase 6+)

1. **Duplicate Detection:** Check if name/company combo already exists
2. **LinkedIn URL Resolution:** Use Clearbit or similar to add LinkedIn URLs
3. **Enrichment:** Pull additional data (location, company size, etc.)
4. **Batch Scheduling:** Schedule bulk creates for off-peak hours
5. **CSV Export:** Export parsed data before creating (for review)
6. **AI Deduplication:** Use fuzzy matching for similar names
7. **Webhook Integration:** Alert Slack when batch created
8. **Multi-language:** Support non-English headlines

---

## Success Criteria

✅ **This feature is successful when:**
- Sales rep can paste 20 pending requests and have 20 contacts created in <30 seconds
- Zero manual data entry required
- Contacts are searchable in Notion immediately
- Owner attribution is correct
- No duplicates created
- Request sent dates are accurate
- Feature is 50x faster than screenshot upload

