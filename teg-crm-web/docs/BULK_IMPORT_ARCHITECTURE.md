# Bulk Pending Requests Importer — Architecture Overview

## 🎯 User Flow

```
Sales Rep
    ↓
Opens LinkedIn "Pending Connection Requests"
    ↓
Selects all text (Ctrl+A) and copies
    ↓
Navigates to /pending-requests page
    ↓
Pastes text into textarea
    ↓
Clicks "Parse Requests" button
    ↓
AI extracts: name, headline, sent date
    ↓
Preview grid shows 20 pending requests
    ↓
Selects owner (e.g., "Niklas")
    ↓
Optionally tags with event name
    ↓
Clicks "Create All 20 Contacts"
    ↓
20 new contacts created in Notion (5-10 seconds)
    ↓
Success message + summary stats
```

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend                         │
│                   (teg-crm-web - client-side)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  /pending-requests/page.tsx                                      │
│  ├─ Large textarea for paste                                     │
│  ├─ "Parse Requests" button → POST /api/pending-requests/parse  │
│  ├─ Preview grid (name, headline, sent date)                    │
│  ├─ Owner selector dropdown                                      │
│  ├─ Event name input (optional)                                  │
│  └─ "Create All N Contacts" → POST /api/pending-requests/create │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    API Layer (Server Routes)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              /api/pending-requests/parse                         │
│  ────────────────────────────────────────────────────────────   │
│  1. Receive pasted text                                          │
│  2. Call parsePendingRequests(text, openaiKey)                  │
│  3. Return: { requests[], stats, errors[] }                     │
│                                                                   │
│  OpenAI Call:                                                    │
│  ├─ Model: gpt-4o-mini                                           │
│  ├─ System Prompt: Extract name, headline, sentDaysAgo          │
│  ├─ User Content: pasted text                                    │
│  └─ Response Format: JSON                                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         (Sales Rep reviews, selects owner, clicks create)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           /api/pending-requests/create                           │
│  ────────────────────────────────────────────────────────────   │
│  1. Receive: { requests[], owner, eventName }                   │
│  2. For each request:                                            │
│     ├─ Extract job title from headline                           │
│     ├─ Extract company from headline                             │
│     ├─ Call createContactInNotion({                              │
│     │  name, jobTitle, company,                                  │
│     │  status: "request_sent",                                   │
│     │  owner, requestSentDate,                                   │
│     │  contactSource: "Pending Requests Paste"                   │
│     │ })                                                          │
│     └─ Collect: pageId, errors                                   │
│  3. Return: { created: N, failed: M, createdContacts[], errors[] │
│                                                                   │
│  Rate Limiting:                                                  │
│  └─ Use withRetry() wrapper (exponential backoff)               │
│     for Notion API rate limits (3 req/s)                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Notion API Layer                               │
│  ────────────────────────────────────────────────────────────   │
│  Create 20 pages in Contacts database:                           │
│  ├─ Name: "Aliosha Milsztein"                                    │
│  ├─ Job Title: "Founding CEO"                                    │
│  ├─ Company: "aurio (acq. by Personio)"                          │
│  ├─ LinkedIn Outreach Status: "request_sent"                     │
│  ├─ Outreach Owner: "Niklas" (relation)                          │
│  ├─ Request Sent Date: 2026-06-04 (ISO)                          │
│  ├─ Contact Source: "Pending Requests Paste"                     │
│  ├─ Profile Summary: full headline text                          │
│  └─ Event: [relation to event if provided]                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                 Success Message + Stats to UI
```

---

## 📊 Data Flow Example

### Input (From LinkedIn Paste)
```
Aliosha Milsztein's profile picture
Aliosha Milsztein
Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM
Sent 1 week ago
Withdraw
Elisabeth Neurauter's profile picture
Elisabeth Neurauter
Director Strategic Accounts at Snowflake | Ex-BCG
Sent 1 week ago
Withdraw
```

### Step 1: Parse
```json
{
  "requests": [
    {
      "name": "Aliosha Milsztein",
      "headline": "Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM",
      "sentDaysAgo": 7,
      "sentDate": "2026-06-04T00:00:00Z",
      "linkedinUrl": undefined
    },
    {
      "name": "Elisabeth Neurauter",
      "headline": "Director Strategic Accounts at Snowflake | Ex-BCG",
      "sentDaysAgo": 7,
      "sentDate": "2026-06-04T00:00:00Z",
      "linkedinUrl": undefined
    }
  ],
  "stats": {
    "totalLines": 12,
    "parsed": 2,
    "failed": 0,
    "duplicateDetected": 0
  }
}
```

### Step 2: Extract Fields
```
Headline: "Director Strategic Accounts at Snowflake | Ex-BCG"
    ↓
Job Title: "Director Strategic Accounts"  (before "at")
Company:   "Snowflake"                     (after "at", before "|")
```

### Step 3: Create in Notion
```
New Contact Page:
├─ Name: Elisabeth Neurauter
├─ Job Title: Director Strategic Accounts
├─ Company: Snowflake
├─ LinkedIn Outreach Status: request_sent
├─ Outreach Owner: Niklas (relation)
├─ Request Sent Date: 2026-06-04
├─ Contact Source: Pending Requests Paste
└─ Profile Summary: Director Strategic Accounts at Snowflake | Ex-BCG
```

---

## 🔌 API Contracts

### POST /api/pending-requests/parse

**Request:**
```json
{
  "pastedText": "Aliosha Milsztein's profile picture\nAliosha Milsztein\n..."
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "requests": [
    {
      "name": "string",
      "headline": "string",
      "sentDaysAgo": number,
      "sentDate": "2026-06-04T00:00:00Z",
      "linkedinUrl": null
    }
  ],
  "errors": [],
  "stats": {
    "totalLines": 120,
    "parsed": 20,
    "failed": 0,
    "duplicateDetected": 0
  }
}
```

**Response (Missing API Key 501):**
```json
{
  "error": "OpenAI API key not configured"
}
```

---

### POST /api/pending-requests/create

**Request:**
```json
{
  "requests": [
    {
      "name": "Aliosha Milsztein",
      "headline": "Agentic AI @ Personio...",
      "sentDaysAgo": 7,
      "sentDate": "2026-06-04T00:00:00Z"
    }
  ],
  "owner": "Niklas",
  "eventName": "Cloudfest 2026"
}
```

**Response (Success 200):**
```json
{
  "created": 20,
  "failed": 0,
  "createdContacts": [
    {
      "name": "Aliosha Milsztein",
      "pageId": "page-uuid-123"
    }
  ],
  "errors": []
}
```

---

## 📁 File Structure

```
teg-crm-web/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   └── pending-requests/
│   │   │       └── page.tsx              [NEW] UI component
│   │   └── api/
│   │       └── pending-requests/
│   │           ├── parse/
│   │           │   └── route.ts          [NEW] Parse endpoint
│   │           └── create/
│   │               └── route.ts          [NEW] Bulk create endpoint
│   └── lib/
│       └── extraction/
│           ├── pending-requests-types.ts [NEW] TypeScript types
│           ├── pending-requests-prompt.ts [NEW] System prompt
│           └── parse-pending-requests.ts [NEW] Parsing logic
├── tests/
│   └── pending-requests.test.ts          [NEW] Unit tests
└── docs/
    └── superpowers/
        └── plans/
            └── 2026-06-11-bulk-pending-requests-importer.md [NEW] Full plan
```

---

## ⚡ Key Design Decisions

| Decision | Why | Trade-off |
|----------|-----|-----------|
| **Two-step process (parse → review → create)** | Sales rep sees what will be created before commit | Slightly slower than one-click |
| **Use gpt-4o-mini not gpt-4** | 80% cheaper, fast enough | Slightly lower accuracy on edge cases |
| **AI parsing instead of regex** | Handles variation in formatting, multi-line headlines | More token usage (but still <500) |
| **No LinkedIn URL in parse** | LinkedIn pending page doesn't show URLs | Can add URLs later via enrichment |
| **Notion rate limiting with retry** | Safe from quota errors | Bulk create takes 5-10s instead of 1s |
| **Store contact_source field** | Audit trail of how contacts were added | Extra Notion field |
| **Request Sent Date tracked** | Sales analytics (how old are pending requests?) | Requires parsing "X days ago" correctly |

---

## 🚀 Performance Characteristics

```
Parsing 20 requests:
├─ Network latency: ~500ms
├─ OpenAI API: ~2000ms
└─ Total: ~2.5 seconds ✓

Creating 20 contacts:
├─ Per-contact: 50ms average (with retry/backoff)
├─ Total: 1000ms + Notion rate limit: 6-10 seconds
└─ Total: ~8 seconds ✓

User Experience:
├─ Paste + Parse: 3 seconds
├─ Review + Select Owner: 10 seconds (user time)
├─ Create: 10 seconds
└─ Total time: ~20 seconds to import 20 contacts ✓

Token Cost:
├─ Parse call: ~300 tokens
├─ Create call: 0 tokens (no LLM)
└─ Total: ~300 tokens (~$0.00015) ✓
```

---

## 🔒 Security & Validation

```
Parsing:
├─ Validate pastedText is not empty
├─ Max length: 100KB (prevents abuse)
├─ AI validates JSON response schema
└─ Handle malformed input gracefully

Creation:
├─ Validate owner exists in team
├─ Validate eventName if provided
├─ Prevent duplicate names (optional: fuzzy match)
├─ All secrets server-side (OpenAI key, Notion token)
└─ No sensitive data logged
```

---

## 📈 Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Time to log 20 requests | 10-15 min (manual) | 20 sec | <30 sec |
| Manual data entry errors | 5-10% | 0% | 0% |
| Duplicate contacts | 5-10% | 0% | 0% |
| Sales rep satisfaction | Low | High | 4.5+/5 |
| API token cost per 20 imports | N/A | ~$0.0002 | <$0.001 |

