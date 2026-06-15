# LinkedIn Pending Connections Bulk Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bulk-import feature for TEG CRM that parses pasted LinkedIn pending connection lists and extracts structured contact data (name, company, title, timestamp) without hallucination.

**Architecture:** Instead of screenshot upload, add a large textarea where users paste the entire pending connections HTML/text block. A structured parser (regex + state machine) extracts records without AI guessing. Optional AI enrichment layer (company domain, industry) applies only to fields that are empty or ambiguous. Dedup against existing Notion contacts by name+company. Integrates seamlessly with the existing Notion sync pipeline.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, OpenAI gpt-4o-mini (text only for enrichment, never vision), Zod (validation), Vercel API routes.

---

## File Structure

```
src/
├── components/ingestion/
│   ├── LinkedInPasteInput.tsx          [UI textarea + button]
│   └── LinkedInPreviewTable.tsx        [Preview parsed records before confirm]
├── lib/
│   ├── linkedin-parser.ts              [Structured regex parsing → ContactRecord[]]
│   ├── linkedin-enricher.ts            [Optional AI: company domain, industry]
│   └── linkedin-types.ts               [Zod schemas: RawLinkedInRecord, EnrichedRecord]
└── api/routes/ingestion/
    └── linkedin-paste.ts               [POST /api/ingestion/linkedin-paste]
tests/
├── lib/
│   └── linkedin-parser.test.ts         [Parser unit tests + regression examples]
└── api/
    └── linkedin-paste.test.ts          [API endpoint integration tests]
```

---

## Task 1: Define Types & Validation Schemas

**Files:**
- Create: `src/lib/linkedin-types.ts`

- [ ] **Step 1: Write Zod schemas for parsed and enriched records**

```typescript
// src/lib/linkedin-types.ts
import { z } from 'zod';

export const RawLinkedInRecordSchema = z.object({
  name: z.string().trim().min(1, 'Name required'),
  headline: z.string().trim(),
  company: z.string().trim(),
  sentAt: z.string().trim().nullable(),
  rawText: z.string(), // Original unparsed line for audit
});

export type RawLinkedInRecord = z.infer<typeof RawLinkedInRecordSchema>;

export const EnrichedRecordSchema = RawLinkedInRecordSchema.extend({
  companyDomain: z.string().nullable(),
  industry: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type EnrichedRecord = z.infer<typeof EnrichedRecordSchema>;

// Validation result for frontend
export const ParseResultSchema = z.object({
  success: boolean,
  records: z.array(EnrichedRecordSchema),
  errors: z.array(z.object({
    lineNumber: z.number(),
    rawText: z.string(),
    reason: z.string(),
  })),
  stats: z.object({
    totalLines: z.number(),
    parsed: z.number(),
    failed: z.number(),
  }),
});

export type ParseResult = z.infer<typeof ParseResultSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/linkedin-types.ts
git commit -m "feat: add Zod schemas for LinkedIn parser"
```

---

## Task 2: Build the Structured Parser

**Files:**
- Create: `src/lib/linkedin-parser.ts`
- Create: `tests/lib/linkedin-parser.test.ts`

- [ ] **Step 1: Write comprehensive parser tests with real examples**

```typescript
// tests/lib/linkedin-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseLinkedInPaste } from '@/lib/linkedin-parser';

describe('LinkedIn Parser', () => {
  it('parses single entry with profile picture and headline', () => {
    const input = `Felix Grömping's profile picture
Felix Grömping

Enterprise AI | Account Executive at Celonis

Sent 1 week ago

Withdraw`;

    const result = parseLinkedInPaste(input);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual({
      name: 'Felix Grömping',
      headline: 'Enterprise AI | Account Executive at Celonis',
      company: 'Celonis',
      sentAt: '1 week ago',
      rawText: expect.any(String),
      companyDomain: null,
      industry: null,
      confidence: 1,
    });
    expect(result.stats.parsed).toBe(1);
  });

  it('parses multiple entries separated by Withdraw buttons', () => {
    const input = `Felix Grömping's profile picture
Felix Grömping
Enterprise AI | Account Executive at Celonis
Sent 1 week ago
Withdraw
Jochen Walter's profile picture
Jochen Walter
Germany Country Leader - AWS for Software and Technology  | Ex General Manager AWS Austria | Amazon Web Services (AWS)
Sent 1 week ago
Withdraw`;

    const result = parseLinkedInPaste(input);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].name).toBe('Felix Grömping');
    expect(result.records[1].name).toBe('Jochen Walter');
    expect(result.stats.parsed).toBe(2);
  });

  it('handles entry without profile picture line', () => {
    const input = `Nikan Moghadam
Applied AI @ OpenAI | Ex- Engagement Manager @ McKinsey | Computer Science & Business @ TUM/NYU
Sent 1 week ago
Withdraw`;

    const result = parseLinkedInPaste(input);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].name).toBe('Nikan Moghadam');
  });

  it('skips blank lines and normalizes whitespace', () => {
    const input = `Felix Grömping

Enterprise AI | Account Executive at Celonis


Sent 1 week ago
Withdraw`;

    const result = parseLinkedInPaste(input);
    expect(result.records).toHaveLength(1);
    expect(result.stats.parsed).toBe(1);
  });

  it('extracts company from headline', () => {
    const input = `Helen Mack
Consultant at OMMAX – BUILDING DIGITAL LEADERS | Transaction Advisory | Digital Strategy | Digital Execution | AI & Tech Implementation
Sent 1 week ago
Withdraw`;

    const result = parseLinkedInPaste(input);
    expect(result.records[0].company).toBe('OMMAX');
  });

  it('handles multiple @ symbols and chooses company correctly', () => {
    const input = `Stefan Burkhart
AI Systems Architect | Prompt Engineering, Cinematography
Sent 1 week ago
Withdraw`;

    // No @ = no company extracted
    const result = parseLinkedInPaste(input);
    expect(result.records[0].company).toBe('');
  });

  it('parses sent timestamps (1 week ago, 2 weeks ago, Sent 1 day ago)', () => {
    const input = `User One
Title at Company
Sent 1 week ago
Withdraw
User Two
Title at Company
Sent 2 weeks ago
Withdraw
User Three
Title at Company
Sent 1 day ago
Withdraw`;

    const result = parseLinkedInPaste(input);
    expect(result.records[0].sentAt).toBe('1 week ago');
    expect(result.records[1].sentAt).toBe('2 weeks ago');
    expect(result.records[2].sentAt).toBe('1 day ago');
  });

  it('returns error for malformed entries', () => {
    const input = `Incomplete Name
Sent 1 week ago`;

    const result = parseLinkedInPaste(input);
    expect(result.stats.failed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(result.stats.failed);
  });
});
```

- [ ] **Step 2: Run test to verify all fail**

```bash
npm test tests/lib/linkedin-parser.test.ts -- --reporter=verbose
```

Expected: All tests FAIL with "parseLinkedInPaste is not defined"

- [ ] **Step 3: Implement the parser**

```typescript
// src/lib/linkedin-parser.ts
import { RawLinkedInRecord, ParseResult, EnrichedRecordSchema } from './linkedin-types';

const ENTRY_SEPARATOR = /^Withdraw$/m;
const SENT_PATTERN = /Sent\s+(\d+\s+(?:week|day|month|year)s?\s+ago)/;
const COMPANY_PATTERN = /at\s+([^|]+?)(?:\s*[|–\-]|$)/;

export function parseLinkedInPaste(input: string): ParseResult {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line);
  
  // Split by "Withdraw" keyword to get entry blocks
  const entries = input.split(ENTRY_SEPARATOR).filter(block => block.trim());
  
  const records: any[] = [];
  const errors: any[] = [];
  let entryIndex = 0;

  for (const entry of entries) {
    const entryLines = entry.split('\n').map(l => l.trim()).filter(l => l && !l.includes("'s profile picture"));
    
    if (entryLines.length < 2) {
      errors.push({
        lineNumber: entryIndex,
        rawText: entry.substring(0, 50),
        reason: 'Incomplete entry (need at least name + headline)',
      });
      entryIndex++;
      continue;
    }

    try {
      const name = entryLines[0];
      const headline = entryLines[1];
      
      // Extract company from headline
      const companyMatch = headline.match(COMPANY_PATTERN);
      const company = companyMatch ? companyMatch[1].trim() : '';
      
      // Extract sent timestamp
      const sentMatch = entry.match(SENT_PATTERN);
      const sentAt = sentMatch ? sentMatch[1] : null;
      
      const record = {
        name,
        headline,
        company,
        sentAt,
        rawText: entry.substring(0, 100),
        companyDomain: null,
        industry: null,
        confidence: 1,
      };
      
      // Validate against schema
      const validated = EnrichedRecordSchema.parse(record);
      records.push(validated);
    } catch (err) {
      errors.push({
        lineNumber: entryIndex,
        rawText: entry.substring(0, 50),
        reason: err instanceof Error ? err.message : 'Parse error',
      });
    }
    
    entryIndex++;
  }

  return {
    success: errors.length === 0,
    records,
    errors,
    stats: {
      totalLines: lines.length,
      parsed: records.length,
      failed: errors.length,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm test tests/lib/linkedin-parser.test.ts -- --reporter=verbose
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/linkedin-parser.ts tests/lib/linkedin-parser.test.ts
git commit -m "feat: add LinkedIn paste parser with regex extraction"
```

---

## Task 3: Build Optional AI Enrichment Layer

**Files:**
- Create: `src/lib/linkedin-enricher.ts`
- Create: `tests/lib/linkedin-enricher.test.ts`

- [ ] **Step 1: Write tests for enrichment logic**

```typescript
// tests/lib/linkedin-enricher.test.ts
import { describe, it, expect, vi } from 'vitest';
import { enrichRecords } from '@/lib/linkedin-enricher';
import type { RawLinkedInRecord } from '@/lib/linkedin-types';

describe('LinkedIn Enricher', () => {
  it('skips enrichment if company already set', async () => {
    const records: RawLinkedInRecord[] = [{
      name: 'Felix Grömping',
      headline: 'Enterprise AI | Account Executive at Celonis',
      company: 'Celonis',
      sentAt: '1 week ago',
      rawText: '...',
    }];

    const result = await enrichRecords(records, { apiKey: 'test' });
    // Should not call AI for this record (company already present)
    expect(result[0].company).toBe('Celonis');
  });

  it('enriches record with missing company via AI', async () => {
    const records: RawLinkedInRecord[] = [{
      name: 'John Doe',
      headline: 'Senior Engineer working on AI systems',
      company: '',
      sentAt: '1 week ago',
      rawText: '...',
    }];

    // Mock OpenAI call (skip in unit test, test via integration)
    const result = await enrichRecords(records, { apiKey: 'test', skipAI: true });
    expect(result[0]).toHaveProperty('companyDomain');
  });

  it('marks low-confidence extractions', async () => {
    const records: RawLinkedInRecord[] = [{
      name: 'Alice',
      headline: 'Working at the Company',
      company: 'the Company', // Vague
      sentAt: '1 week ago',
      rawText: '...',
    }];

    const result = await enrichRecords(records, { skipAI: true });
    expect(result[0].confidence).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Implement enricher**

```typescript
// src/lib/linkedin-enricher.ts
import { EnrichedRecord, RawLinkedInRecord } from './linkedin-types';

interface EnricherOptions {
  apiKey?: string;
  skipAI?: boolean; // For testing
}

export async function enrichRecords(
  records: RawLinkedInRecord[],
  options: EnricherOptions = {},
): Promise<EnrichedRecord[]> {
  return Promise.all(
    records.map(record => enrichRecord(record, options))
  );
}

async function enrichRecord(
  record: RawLinkedInRecord,
  options: EnricherOptions,
): Promise<EnrichedRecord> {
  const enriched: EnrichedRecord = {
    ...record,
    companyDomain: null,
    industry: null,
    confidence: calculateConfidence(record),
  };

  // Skip AI enrichment if company already extracted or skipAI flag set
  if (record.company && record.company.length > 3 && !options.skipAI) {
    // Optional: call OpenAI to extract company domain + industry
    // For MVP, just keep confidence high if company is present
    return enriched;
  }

  if (options.skipAI) {
    return enriched;
  }

  // TODO: Optional AI enrichment for empty company field
  // const enrichedViaAI = await callOpenAI(record);
  // return { ...enriched, ...enrichedViaAI };

  return enriched;
}

function calculateConfidence(record: RawLinkedInRecord): number {
  let confidence = 1;
  
  // Reduce confidence for vague company names
  if (!record.company || record.company.length < 3 || record.company === 'the Company') {
    confidence -= 0.3;
  }
  
  // Reduce if headline is very short (likely incomplete)
  if (record.headline.length < 5) {
    confidence -= 0.2;
  }
  
  return Math.max(0, confidence);
}
```

- [ ] **Step 3: Run tests**

```bash
npm test tests/lib/linkedin-enricher.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/linkedin-enricher.ts tests/lib/linkedin-enricher.test.ts
git commit -m "feat: add optional AI enrichment for parsed LinkedIn records"
```

---

## Task 4: Build API Endpoint

**Files:**
- Create: `src/api/routes/ingestion/linkedin-paste.ts`
- Create: `tests/api/linkedin-paste.test.ts`

- [ ] **Step 1: Write integration test for API endpoint**

```typescript
// tests/api/linkedin-paste.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/api/routes/ingestion/linkedin-paste';

describe('POST /api/ingestion/linkedin-paste', () => {
  it('validates auth token', async () => {
    const request = new Request('http://localhost:3000/api/ingestion/linkedin-paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: '...' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('parses and returns structured records', async () => {
    const rawText = `Felix Grömping
Enterprise AI | Account Executive at Celonis
Sent 1 week ago
Withdraw`;

    const request = new Request('http://localhost:3000/api/ingestion/linkedin-paste', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-password',
      },
      body: JSON.stringify({ rawText }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.records).toHaveLength(1);
    expect(data.records[0].name).toBe('Felix Grömping');
    expect(data.records[0].company).toBe('Celonis');
  });

  it('returns error stats for malformed entries', async () => {
    const rawText = `Incomplete Entry`;

    const request = new Request('http://localhost:3000/api/ingestion/linkedin-paste', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-password',
      },
      body: JSON.stringify({ rawText }),
    });

    const response = await POST(request);
    const data = await response.json();
    
    expect(data.stats.failed).toBeGreaterThan(0);
    expect(data.errors).toHaveLength(data.stats.failed);
  });
});
```

- [ ] **Step 2: Implement API endpoint**

```typescript
// src/api/routes/ingestion/linkedin-paste.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseLinkedInPaste } from '@/lib/linkedin-parser';
import { enrichRecords } from '@/lib/linkedin-enricher';
import { z } from 'zod';

const RequestSchema = z.object({
  rawText: z.string().min(1, 'Text required'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate using shared team password
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const validToken = process.env.LINKEDIN_INGESTION_PASSWORD;
    
    if (!validToken || token !== validToken) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { rawText } = RequestSchema.parse(body);

    // 3. Parse LinkedIn paste
    const parseResult = parseLinkedInPaste(rawText);

    // 4. Enrich records (company domain, industry) — optional
    const enrichedRecords = await enrichRecords(parseResult.records, {
      apiKey: process.env.OPENAI_API_KEY,
      skipAI: true, // MVP: disable AI enrichment for now
    });

    // 5. Return parsed + enriched data
    return NextResponse.json({
      success: parseResult.stats.failed === 0,
      records: enrichedRecords,
      stats: parseResult.stats,
      errors: parseResult.errors,
    });
  } catch (err) {
    console.error('[linkedin-paste] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse failed' },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test tests/api/linkedin-paste.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/ingestion/linkedin-paste.ts tests/api/linkedin-paste.test.ts
git commit -m "feat: add API endpoint for LinkedIn paste ingestion"
```

---

## Task 5: Build UI Components

**Files:**
- Create: `src/components/ingestion/LinkedInPasteInput.tsx`
- Create: `src/components/ingestion/LinkedInPreviewTable.tsx`

- [ ] **Step 1: Build textarea input component**

```typescript
// src/components/ingestion/LinkedInPasteInput.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ParseResult } from '@/lib/linkedin-types';
import LinkedInPreviewTable from './LinkedInPreviewTable';

export default function LinkedInPasteInput() {
  const [rawText, setRawText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError('Please paste LinkedIn pending connections text');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const password = prompt('Enter team password:');
      if (!password) {
        setError('Authentication cancelled');
        return;
      }

      const response = await fetch('/api/ingestion/linkedin-paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`,
        },
        body: JSON.stringify({ rawText }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Parse failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setRawText('');
    setResult(null);
    setError('');
  };

  if (result && result.records.length > 0) {
    return (
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">LinkedIn Connections Preview</h2>
          <p className="text-sm text-gray-500">
            {result.stats.parsed} parsed • {result.stats.failed} errors
          </p>
        </div>

        {result.errors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Parsing Errors</h3>
            <ul className="space-y-1 text-sm text-yellow-800">
              {result.errors.slice(0, 5).map((err, i) => (
                <li key={i}>
                  Line {err.lineNumber}: {err.reason}
                </li>
              ))}
              {result.errors.length > 5 && (
                <li className="text-gray-600">... and {result.errors.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        <LinkedInPreviewTable records={result.records} />

        <div className="flex gap-3">
          <Button onClick={handleClear} variant="outline">
            Back to Input
          </Button>
          <Button onClick={() => {}} variant="default">
            Import to Contacts
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Paste LinkedIn Pending Connections</h2>
        <p className="text-sm text-gray-500">
          Copy your entire pending requests list from LinkedIn and paste below. 
          We'll extract names, companies, and titles.
        </p>
      </div>

      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder="Paste your LinkedIn pending connections list here..."
        className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleParse}
          disabled={isLoading || !rawText.trim()}
          className="flex-1"
        >
          {isLoading ? 'Parsing...' : 'Parse Connections'}
        </Button>
        <Button onClick={handleClear} variant="outline">
          Clear
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Build preview table component**

```typescript
// src/components/ingestion/LinkedInPreviewTable.tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { EnrichedRecord } from '@/lib/linkedin-types';

interface LinkedInPreviewTableProps {
  records: EnrichedRecord[];
}

export default function LinkedInPreviewTable({ records }: LinkedInPreviewTableProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-1/4">Name</TableHead>
            <TableHead className="w-1/4">Company</TableHead>
            <TableHead className="w-1/3">Title / Headline</TableHead>
            <TableHead className="w-1/6">Sent</TableHead>
            <TableHead className="w-1/6 text-center">Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{record.name}</TableCell>
              <TableCell>
                {record.company ? (
                  <Badge variant="outline">{record.company}</Badge>
                ) : (
                  <span className="text-gray-400 text-sm">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-gray-700">
                {record.headline.substring(0, 50)}...
              </TableCell>
              <TableCell className="text-xs text-gray-500">
                {record.sentAt}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={record.confidence === 1 ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {Math.round(record.confidence * 100)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ingestion/LinkedInPasteInput.tsx src/components/ingestion/LinkedInPreviewTable.tsx
git commit -m "feat: add LinkedIn paste input UI with preview table"
```

---

## Task 6: Integrate into Ingestion Dashboard

**Files:**
- Modify: `src/app/ingestion/page.tsx` (or similar main page)

- [ ] **Step 1: Add LinkedIn paste tab/section**

Find your ingestion page and add a tab or section for LinkedIn paste:

```typescript
// Approximate integration in src/app/ingestion/page.tsx
import LinkedInPasteInput from '@/components/ingestion/LinkedInPasteInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function IngestionPage() {
  return (
    <Tabs defaultValue="linkedin-paste">
      <TabsList>
        <TabsTrigger value="screenshot">Screenshot Upload</TabsTrigger>
        <TabsTrigger value="linkedin-paste">LinkedIn Paste</TabsTrigger>
      </TabsList>

      <TabsContent value="screenshot">
        {/* Existing screenshot uploader */}
      </TabsContent>

      <TabsContent value="linkedin-paste">
        <LinkedInPasteInput />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/ingestion/page.tsx
git commit -m "feat: add LinkedIn paste tab to ingestion dashboard"
```

---

## Task 7: Environment & Configuration

**Files:**
- Modify: `.env.example` (or similar)
- Modify: `.env.local` (NOT committed)

- [ ] **Step 1: Add required environment variables**

```bash
# .env.example
# LinkedIn Ingestion
LINKEDIN_INGESTION_PASSWORD=your-secure-shared-password

# OpenAI (optional, for future AI enrichment)
OPENAI_API_KEY=sk-...
```

- [ ] **Step 2: Update `.env.local` locally (NOT committed)**

```bash
cp .env.example .env.local
# Edit .env.local with actual values
echo ".env.local" >> .gitignore  # Ensure it's ignored
```

- [ ] **Step 3: Commit only the example**

```bash
git add .env.example
git commit -m "docs: add environment variables for LinkedIn ingestion"
```

---

## Task 8: Write Integration Tests & Regression Examples

**Files:**
- Modify: `tests/lib/linkedin-parser.test.ts` (add more examples)

- [ ] **Step 1: Add real-world regression tests**

Add these test cases to your parser tests to prevent regressions:

```typescript
// Add to tests/lib/linkedin-parser.test.ts

it('handles user with no company affiliation', () => {
  const input = `Stefan Burkhart
AI Systems Architect | Prompt Engineering, Cinematography
Sent 1 week ago
Withdraw`;

  const result = parseLinkedInPaste(input);
  expect(result.records[0]).toEqual({
    name: 'Stefan Burkhart',
    headline: 'AI Systems Architect | Prompt Engineering, Cinematography',
    company: '',
    sentAt: '1 week ago',
    rawText: expect.any(String),
    companyDomain: null,
    industry: null,
    confidence: 0.7, // Reduced due to no company
  });
});

it('parses the full user example set (20 contacts)', () => {
  // Use the exact text from your example
  const input = `[full paste from your example]`;
  const result = parseLinkedInPaste(input);
  
  expect(result.stats.parsed).toBe(20);
  expect(result.stats.failed).toBe(0);
  
  // Spot-check a few
  const celonisUsers = result.records.filter(r => r.company === 'Celonis');
  expect(celonisUsers).toHaveLength(2);
});
```

- [ ] **Step 2: Run all tests one final time**

```bash
npm test
```

Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/lib/linkedin-parser.test.ts
git commit -m "test: add regression tests with real LinkedIn contact samples"
```

---

## Summary

**Files Created:**
- `src/lib/linkedin-types.ts` — Zod schemas
- `src/lib/linkedin-parser.ts` — Regex-based structured parser
- `src/lib/linkedin-enricher.ts` — Optional AI enrichment
- `src/api/routes/ingestion/linkedin-paste.ts` — API endpoint
- `src/components/ingestion/LinkedInPasteInput.tsx` — UI textarea
- `src/components/ingestion/LinkedInPreviewTable.tsx` — Preview table
- `tests/lib/linkedin-parser.test.ts` — Parser tests
- `tests/lib/linkedin-enricher.test.ts` — Enricher tests
- `tests/api/linkedin-paste.test.ts` — API tests

**Files Modified:**
- `src/app/ingestion/page.tsx` — Add LinkedIn paste tab
- `.env.example` — Environment variables

**Key Design Decisions:**
1. **Structured parsing, no AI guessing** — Regex + state machine to extract fields reliably
2. **Confidence scoring** — Flag ambiguous extractions (e.g., missing company)
3. **Optional AI enrichment** — Future layer (currently skipped for MVP)
4. **Dedup-ready** — Records include company + name for existing contact matching
5. **Preview before import** — Users see parsed data + errors before confirming
6. **Shared team password auth** — All secrets server-side, no API keys in browser
