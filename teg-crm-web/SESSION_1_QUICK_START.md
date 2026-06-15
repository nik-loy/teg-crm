# Session 1 Quick Start — Extraction Logic (3 Hours)

**Date:** Next Session  
**Objective:** Build AI extraction that parses LinkedIn pending requests  
**Expected Output:** 5 passing unit tests ✓  

---

## 🎯 What You'll Do This Session

Create extraction logic that takes messy LinkedIn text → clean JSON with names, titles, companies, and dates.

**Input:** (from LinkedIn pending requests page)
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

**Output:** (structured JSON)
```json
{
  "success": true,
  "requests": [
    {
      "name": "Aliosha Milsztein",
      "headline": "Agentic AI @ Personio | Founding CEO @ aurio...",
      "sentDaysAgo": 7,
      "sentDate": "2026-06-04T00:00:00Z"
    },
    {
      "name": "Elisabeth Neurauter",
      "headline": "Director Strategic Accounts at Snowflake | Ex-BCG",
      "sentDaysAgo": 7,
      "sentDate": "2026-06-04T00:00:00Z"
    }
  ],
  "stats": { "parsed": 2, "failed": 0, "duplicateDetected": 0 }
}
```

---

## ⏱️ Timeline

```
Task 1.1 (20 min): Create types file
Task 1.2 (20 min): Create system prompt
Task 1.3 (30 min): Create parser function
Task 1.4 (30 min): Create unit tests
Task 1.5 (20 min): Run tests & verify
─────────────────────────────────────
Total: 2 hours (+ 1 hour buffer)
```

---

## 📍 Where to Find Detailed Instructions

**MAIN REFERENCE:**
👉 `docs/superpowers/plans/2026-06-11-IMPLEMENTATION-SESSION-PLAN.md`

That file contains:
- Exact code for each file
- Detailed checklist for each task
- Expected outputs
- Troubleshooting guide

**This document** is a quick reference. For detailed code, open the file above.

---

## ✅ The 4 Files You'll Create

### 1️⃣ `src/lib/extraction/pending-requests-types.ts`

**Purpose:** TypeScript interfaces  
**Contains:** PendingRequest, ParseResult  
**Size:** ~20 lines  
**Status:** See IMPLEMENTATION-SESSION-PLAN.md Task 1.1

### 2️⃣ `src/lib/extraction/pending-requests-prompt.ts`

**Purpose:** AI system prompt  
**Contains:** Instructions for OpenAI to extract names/headlines/dates  
**Size:** ~40 lines  
**Status:** See IMPLEMENTATION-SESSION-PLAN.md Task 1.2

### 3️⃣ `src/lib/extraction/parse-pending-requests.ts`

**Purpose:** Main parsing function  
**Contains:** Call OpenAI → parse JSON → return typed result  
**Size:** ~50 lines  
**Status:** See IMPLEMENTATION-SESSION-PLAN.md Task 1.3

### 4️⃣ `tests/pending-requests.test.ts`

**Purpose:** Unit tests with real fixture data  
**Contains:** 5 test cases covering names, headlines, dates, errors  
**Size:** ~80 lines  
**Status:** See IMPLEMENTATION-SESSION-PLAN.md Task 1.4

---

## 🚀 How to Execute (Step by Step)

### Before You Start

1. **Ensure you have:**
   - `OPENAI_API_KEY` in `.env.local` (with valid credits)
   - Node.js 18+ installed
   - npm available

2. **Terminal ready:**
   ```bash
   cd "C:\Users\nikla\.gemini\antigravity\scratch\TEG CRM\teg-crm-web"
   ```

### Execute Each Task

**Task 1.1: Create Types File**
1. Open file: `src/lib/extraction/pending-requests-types.ts`
2. Paste code from IMPLEMENTATION-SESSION-PLAN.md Task 1.1
3. Save file
4. ✅ Checklist: File created, interfaces exported

**Task 1.2: Create System Prompt**
1. Create file: `src/lib/extraction/pending-requests-prompt.ts`
2. Paste code from IMPLEMENTATION-SESSION-PLAN.md Task 1.2
3. Save file
4. ✅ Checklist: File created, function exports properly

**Task 1.3: Create Parser Function**
1. Create file: `src/lib/extraction/parse-pending-requests.ts`
2. Paste code from IMPLEMENTATION-SESSION-PLAN.md Task 1.3
3. Save file
4. ✅ Checklist: File created, imports are correct, function signature matches

**Task 1.4: Create Unit Tests**
1. Create file: `tests/pending-requests.test.ts`
2. Paste code from IMPLEMENTATION-SESSION-PLAN.md Task 1.4
3. Save file
4. ✅ Checklist: File created, fixtures included, test structure valid

**Task 1.5: Run Tests**
```bash
npm test -- pending-requests.test.ts
```

Expected output:
```
✓ tests/pending-requests.test.ts (5)
  ✓ should parse names correctly
  ✓ should parse headlines correctly
  ✓ should convert sent time to days
  ✓ should calculate ISO dates
  ✓ should handle empty input gracefully

Tests  5 passed (5)
```

✅ Checklist: All 5 tests pass, no errors

---

## 🔍 Verify Your Work

After Task 1.5, run:

```bash
npm run build
```

Should succeed with no TypeScript errors.

Then commit:
```bash
git add -A
git commit -m "feat: pending requests extraction logic with tests"
```

---

## 🎯 Success Criteria

✅ All 4 files created  
✅ All 5 unit tests pass  
✅ No TypeScript errors  
✅ npm run build succeeds  
✅ Ready to commit  

---

## ❓ If Something Goes Wrong

### Tests fail?
- Check OpenAI API key: `echo $env:OPENAI_API_KEY`
- Verify key has credits: Try API from https://platform.openai.com/account/usage
- Run with verbose output: `npm test -- pending-requests.test.ts --reporter=verbose`

### Build fails?
- Check TypeScript: `npx tsc --noEmit`
- Check imports are correct
- Verify file paths match exactly

### Can't import modules?
- Ensure @/ alias works: Check `tsconfig.json`
- Verify npm packages installed: `npm install`

---

## 📊 File Checklist

Before you start, ensure these paths exist:

- ✅ `src/lib/extraction/` (directory)
- ✅ `tests/` (directory)
- ✅ `.env.local` (with OPENAI_API_KEY)
- ✅ `package.json` (with vitest)

---

## 🎁 You'll Have After Session 1

✅ **Extraction logic** that uses OpenAI gpt-4o-mini to parse LinkedIn text  
✅ **System prompt** that handles formatting variations  
✅ **Parser function** that returns typed, validated results  
✅ **5 unit tests** that verify extraction accuracy  
✅ **Proven approach** that works with real data  

---

## 🚀 Next Step

1. Get detailed code from: `docs/superpowers/plans/2026-06-11-IMPLEMENTATION-SESSION-PLAN.md`
2. Follow Task 1.1 through 1.5
3. Check off each item
4. When done, run: `npm test`
5. If all pass ✓, you're done with Session 1!

---

## 📞 Quick Reference Links

**In this session plan:**
- Detailed code specs: See IMPLEMENTATION-SESSION-PLAN.md
- Architecture context: See BULK_IMPORT_ARCHITECTURE.md
- Feature overview: See FEATURE_PROPOSAL_SUMMARY.md

**Session 1 complete when:**
- All 4 files created
- All 5 tests pass
- npm run build succeeds
- Ready to commit

**Then move to Session 2** for API endpoints & UI

---

**Duration:** 3 hours  
**Difficulty:** Medium (straightforward if you follow the plan)  
**Next session:** 5 hours (API + UI)  

You've got this! 💪

