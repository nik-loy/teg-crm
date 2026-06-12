# Bulk Pending Requests Importer — Quick Start Guide

## 🎯 What You're Building

A feature that lets sales reps paste their entire LinkedIn "Pending Connection Requests" page and automatically create 20+ contacts in Notion in 20 seconds.

**Before this feature:** Screenshot upload (token-intensive, slow, error-prone)  
**After this feature:** Copy-paste text (instant, efficient, zero errors)

---

## 📋 Implementation Checklist

### Phase 1: Core Extraction Logic (Day 1 — ~3 hours)

- [ ] Create `src/lib/extraction/pending-requests-types.ts`
  - [ ] `PendingRequest` interface (name, headline, sentDaysAgo, sentDate)
  - [ ] `ParseResult` interface (requests[], errors[], stats)

- [ ] Create `src/lib/extraction/pending-requests-prompt.ts`
  - [ ] AI system prompt that extracts: name, headline, "Sent X days ago"
  - [ ] Rules to exclude: "Withdraw", "profile picture", image text
  - [ ] Rules to handle: multi-line headlines, deduplication

- [ ] Create `src/lib/extraction/parse-pending-requests.ts`
  - [ ] `parsePendingRequests(text, apiKey)` function
  - [ ] Call OpenAI gpt-4o-mini with JSON mode
  - [ ] Calculate ISO dates from "Sent X days ago"
  - [ ] Return typed `ParseResult`

- [ ] Create `tests/pending-requests.test.ts`
  - [ ] Test fixture: real 20-request sample from user
  - [ ] Test: names parsed correctly
  - [ ] Test: headlines parsed correctly
  - [ ] Test: dates converted correctly
  - [ ] Run: `npm test` (should all pass)

### Phase 2: API Endpoints (Day 1-2 — ~2 hours)

- [ ] Create `src/app/api/pending-requests/parse/route.ts`
  - [ ] POST handler
  - [ ] Input validation (pastedText required, max 100KB)
  - [ ] Call `parsePendingRequests()`
  - [ ] Return `ParseResult` or error
  - [ ] Handle 501 if OpenAI key missing

- [ ] Create `src/app/api/pending-requests/create/route.ts`
  - [ ] POST handler
  - [ ] Input validation (requests[] and owner required)
  - [ ] Extract job title from headline: before "at"
  - [ ] Extract company from headline: after "at", before "|"
  - [ ] For each request: call `createContactInNotion()` with:
    - [ ] name, jobTitle, company
    - [ ] status: "request_sent"
    - [ ] owner, requestSentDate, contactSource
  - [ ] Use `withRetry()` for Notion rate limiting
  - [ ] Return creation stats and errors

### Phase 3: Frontend UI (Day 2 — ~3 hours)

- [ ] Create `src/app/(app)/pending-requests/page.tsx`
  - [ ] Large textarea (rows={15}) for pasting
  - [ ] "Parse Requests" button
  - [ ] Show parsing loader (Loader2 icon)
  - [ ] Display `ParseResult` with stats
  - [ ] Show preview grid of parsed contacts
  - [ ] Owner selector (OwnerSelect component)
  - [ ] Event name input (optional)
  - [ ] "Create All N Contacts" button
  - [ ] Show creation progress
  - [ ] Display results: created count, failed count, error list
  - [ ] "Import More" button to reset and continue

### Phase 4: Notion Integration (Day 3 — ~1 hour)

- [ ] Update `src/lib/notion/contacts.ts`
  - [ ] Add `requestSentDate` parameter to `createContactInNotion()`
  - [ ] Add `contactSource` parameter
  - [ ] Set "Request Sent Date" property in Notion
  - [ ] Set "Contact Source" select to "Pending Requests Paste"

- [ ] Update Notion database schema (manual in Notion UI)
  - [ ] Add "Request Sent Date" field (type: Date)
  - [ ] Add "Contact Source" field (type: Select with options)
  - [ ] Add option: "Pending Requests Paste"
  - [ ] Add option: "Screenshot" (existing)
  - [ ] Add option: "Manual" (existing)

### Phase 5: Navigation & Polish (Day 3 — ~1 hour)

- [ ] Update sidebar navigation
  - [ ] Add link to `/pending-requests` page
  - [ ] Place under "Sales Operations" section

- [ ] Add success notifications
  - [ ] Toast message on successful parse
  - [ ] Toast message on successful creation

- [ ] Add error handling
  - [ ] Show error messages if parsing fails
  - [ ] Show detailed errors if creation fails
  - [ ] Graceful handling of OpenAI quota errors

- [ ] Test end-to-end
  - [ ] Paste sample data
  - [ ] Parse → verify output
  - [ ] Create → verify in Notion
  - [ ] Check owner, status, dates are correct

---

## 🧪 Testing Your Work

### Unit Test (After Phase 1)
```bash
npm test -- pending-requests.test.ts
# Should pass all tests with real fixture data
```

### Manual Testing (After Phase 3)

**Test Data:** Use the 20-request sample the user provided

1. Open http://localhost:3000/pending-requests
2. Paste the 20-request sample
3. Click "Parse Requests"
   - ✓ Should show "Parsed 20 requests"
   - ✓ Preview grid shows all 20 names
   - ✓ Headlines are correct
4. Select owner "Niklas" from dropdown
5. Optionally enter event name "Test Event"
6. Click "Create All 20 Contacts"
   - ✓ Should show "Creating 20 contacts..."
   - ✓ Progress updates
   - ✓ Results show "Created: 20, Failed: 0"
7. Go to Notion database
   - ✓ 20 new contacts should be there
   - ✓ Names match exactly
   - ✓ Job titles extracted correctly
   - ✓ Companies extracted correctly
   - ✓ Status = "request_sent"
   - ✓ Owner = "Niklas" (relation)
   - ✓ Request Sent Date = correct date

### Edge Cases to Test
- [ ] Paste with only 1 request
- [ ] Paste with 50+ requests
- [ ] Paste with duplicate names (should deduplicate)
- [ ] Paste with special characters (ü, ö, ñ)
- [ ] Paste with very long headlines (3-4 lines)
- [ ] Paste with malformed data (missing sections)
- [ ] Test "Sent 3 days ago", "Sent 2 weeks ago", "Sent 1 month ago"
- [ ] Create while OpenAI API is down (should show error gracefully)

---

## 📊 Key Files to Modify/Create

```
NEW FILES (8):
src/lib/extraction/pending-requests-types.ts
src/lib/extraction/pending-requests-prompt.ts
src/lib/extraction/parse-pending-requests.ts
src/app/api/pending-requests/parse/route.ts
src/app/api/pending-requests/create/route.ts
src/app/(app)/pending-requests/page.tsx
tests/pending-requests.test.ts
docs/superpowers/plans/2026-06-11-bulk-pending-requests-importer.md

MODIFY FILES (2):
src/lib/notion/contacts.ts (add requestSentDate, contactSource params)
src/components/Sidebar.tsx (add navigation link)

MANUAL IN NOTION (1):
Contacts database schema (add 2 new fields)
```

---

## 🚀 Deployment Flow

1. Implement Phases 1-5 locally
2. Test with the user's sample data
3. Git commit: `git add -A && git commit -m "feat: bulk pending requests importer"`
4. Push to GitHub: `git push origin main`
5. Vercel auto-deploys
6. Test in production: http://teg-crm-web.vercel.app/pending-requests
7. Show to sales team for UAT
8. Gather feedback, iterate if needed

---

## 💡 Pro Tips

**When parsing fails:**
- Check that OpenAI API key has credits (the test endpoint will tell you)
- OpenAI gpt-4o-mini is very reliable with text extraction
- If it fails, it's usually a quota issue, not a prompt issue

**When creating fails:**
- Check Notion token is valid (test by fetching a contact)
- Check Notion database IDs are correct
- Watch for Notion rate limits (3 req/sec) — that's why we use `withRetry()`

**Optimize token usage:**
- gpt-4o-mini is cheap (~$0.00015 per 1K tokens)
- 20 requests = ~300 tokens = $0.00005 per import
- This is 10,000x cheaper than OCR-based screenshot approach

**UX improvements for later:**
- Add CSV export of parsed data (for review before create)
- Add bulk edit (change owner for all before create)
- Add duplicate detection (warn if names already exist)
- Add LinkedIn URL enrichment (look up profile URLs)

---

## 🎓 Learning Resources

**Understanding the flow:**
1. Read `BULK_IMPORT_ARCHITECTURE.md` for data flow diagram
2. Read implementation plan for detailed specifications
3. Look at existing `/add` page as reference (similar pattern)

**Similar code in repo:**
- `/api/extract/route.ts` — similar OpenAI call pattern
- `src/lib/extraction/extract.ts` — similar AI extraction logic
- `src/app/(app)/add/page.tsx` — similar UI pattern (parsing + preview + create)
- `src/lib/notion/contacts.ts` — contact creation logic

---

## ❓ FAQ

**Q: Why not use LinkedIn API directly?**  
A: LinkedIn bans automated connection request scraping. Copy-paste is the only safe approach.

**Q: What if a name appears twice in the paste?**  
A: AI will deduplicate. In Notion, we check for duplicates by name before creating.

**Q: What if parsing gets a name wrong?**  
A: Sales rep sees it in the preview grid and can skip that row before creating. (Phase 6 enhancement: let them edit before create)

**Q: How long does it take to import 50 requests?**  
A: ~30 seconds (3 sec parse + 27 sec create with rate limiting)

**Q: Can I use this with Anthropic API instead of OpenAI?**  
A: Yes! Phase 2 enhancement: add Anthropic SDK as fallback. Current code is OpenAI-only.

**Q: What if the paste is incomplete at the bottom?**  
A: AI is smart enough to handle partial entries. It will parse what's there and report errors for malformed entries.

---

## 📞 Support

For questions while implementing:
1. Check `BULK_IMPORT_ARCHITECTURE.md` for data flow
2. Look at existing extraction code (`/api/extract/route.ts`)
3. Test with the real 20-request sample data
4. Check OpenAI API docs for JSON mode: https://platform.openai.com/docs/guides/structured-outputs

Good luck! 🚀

