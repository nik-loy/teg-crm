# Bulk Pending Requests Importer — Implementation Index

**Status:** ✅ FULLY PLANNED & READY TO IMPLEMENT

Generated: June 11, 2026  
For: TEG CRM Sales Team  
Feature: LinkedIn Pending Requests Bulk Import

---

## 📚 Documentation Files (Read in This Order)

### 1. **FEATURE_PROPOSAL_SUMMARY.md** ← START HERE
   - **Read time:** 10 minutes
   - **For:** Decision makers & sales team
   - **Contains:**
     - Problem statement (why we need this)
     - Solution overview (how it will work)
     - User experience walkthrough
     - Timeline & effort estimate
     - Cost analysis
     - Success criteria
     - FAQ

### 2. **BULK_IMPORT_QUICK_START.md** ← FOR DEVELOPERS
   - **Read time:** 5 minutes
   - **For:** Implementation team
   - **Contains:**
     - Implementation checklist (5 phases, 11 tasks)
     - What to build (8 files)
     - How to test
     - Pro tips & edge cases
     - Deployment flow

### 3. **docs/BULK_IMPORT_ARCHITECTURE.md** ← TECHNICAL SPEC
   - **Read time:** 15 minutes
   - **For:** Backend engineers & architects
   - **Contains:**
     - User flow diagram
     - System architecture diagram
     - Data flow example (real data → parsed → created)
     - API contracts (request/response)
     - File structure
     - Design decisions & tradeoffs
     - Performance characteristics
     - Security & validation

### 4. **docs/superpowers/plans/2026-06-11-bulk-pending-requests-importer.md** ← COMPREHENSIVE SPEC
   - **Read time:** 30 minutes
   - **For:** Deep technical reference
   - **Contains:**
     - Phase-by-phase breakdown
     - Complete file-by-file code specifications
     - Unit test fixtures
     - Notion schema updates
     - Navigation updates
     - Edge cases & testing strategy
     - Deployment checklist
     - Future enhancements

---

## 🎯 Quick Links

| Role | Start Here | Then Read | Reference |
|------|-----------|-----------|-----------|
| **Sales Manager** | FEATURE_PROPOSAL_SUMMARY.md | BULK_IMPORT_QUICK_START.md (Testing section) | FAQ |
| **Developer** | BULK_IMPORT_QUICK_START.md | BULK_IMPORT_ARCHITECTURE.md | Full Spec |
| **DevOps/QA** | BULK_IMPORT_QUICK_START.md (Testing) | BULK_IMPORT_ARCHITECTURE.md (Security) | Full Spec |
| **Product Owner** | FEATURE_PROPOSAL_SUMMARY.md | BULK_IMPORT_ARCHITECTURE.md (Performance) | — |

---

## 📋 Implementation Phases at a Glance

```
Phase 1 (Day 1, 3 hrs)      Phase 2 (Day 1-2, 2 hrs)    Phase 3 (Day 2, 3 hrs)
─────────────────────────    ──────────────────────────   ────────────────────
Extraction Logic             API Endpoints               Frontend UI
• Types                      • POST /api/.../parse       • /pending-requests page
• System Prompt              • POST /api/.../create      • Textarea (paste)
• Parse Function             • Input validation          • Parse button
• Unit Tests                 • Notion integration        • Preview grid
                            • Rate limiting              • Owner selector
                                                        • Create button
                                                        • Results display
         ↓                          ↓                          ↓
    Phase 4 (Day 3, 1 hr)    Phase 5 (Day 3, 1 hr)     TOTAL: 3 Days
    ────────────────────────  ─────────────────────     ~10 Hours
    Notion Integration        Polish & Navigation
    • Add date field          • Sidebar link
    • Add source field        • Error messages
    • Update creation fn      • Toast notifications
                             • E2E testing
                             • Deploy to Vercel
```

---

## 📁 New Files to Create (8 Files)

```
teg-crm-web/src/lib/extraction/
├── pending-requests-types.ts         [TypeScript types]
├── pending-requests-prompt.ts        [AI system prompt]
└── parse-pending-requests.ts         [Core parsing logic]

teg-crm-web/src/app/api/pending-requests/
├── parse/route.ts                    [Parse endpoint]
└── create/route.ts                   [Create endpoint]

teg-crm-web/src/app/(app)/
└── pending-requests/page.tsx         [Frontend UI]

teg-crm-web/tests/
└── pending-requests.test.ts          [Unit tests]

teg-crm-web/docs/
├── BULK_IMPORT_ARCHITECTURE.md       [Technical docs]
├── superpowers/plans/
│   └── 2026-06-11-bulk-pending-requests-importer.md
├── FEATURE_PROPOSAL_SUMMARY.md
└── BULK_IMPORT_QUICK_START.md
```

---

## 🔄 Files to Modify (2 Files)

```
teg-crm-web/src/lib/notion/contacts.ts
└─ Add requestSentDate & contactSource parameters

teg-crm-web/src/components/Sidebar.tsx
└─ Add navigation link to /pending-requests
```

---

## 🗄️ Database Schema Changes (Manual in Notion)

**Add 2 new fields to Contacts database:**

1. **Request Sent Date** (type: Date)
   - Stores when connection request was sent
   - Optional, backwards-compatible

2. **Contact Source** (type: Select)
   - Options:
     - "Pending Requests Paste" (NEW)
     - "Screenshot" (existing)
     - "Manual" (existing)

---

## ✅ Testing Checklist

### Before Implementation
- [ ] Read all 4 documentation files
- [ ] Have user's 20-request sample ready
- [ ] OpenAI API key refreshed (has credits)
- [ ] Notion API token valid

### During Implementation
- [ ] Phase 1: `npm test` all tests pass
- [ ] Phase 2: Test API endpoints with curl/Postman
- [ ] Phase 3: Manual UI testing (paste, parse, preview)
- [ ] Phase 4: Verify Notion contacts created
- [ ] Phase 5: E2E test with real data

### Edge Cases
- [ ] Duplicate names (should deduplicate)
- [ ] Very long headlines (3-4 lines)
- [ ] Special characters (ü, ö, ñ, etc.)
- [ ] Different timeframes: "3 days ago", "2 weeks ago", "1 month ago"
- [ ] Incomplete/malformed entries
- [ ] Empty paste (should show error)
- [ ] Very large paste (50+ requests)

### Deployment Testing
- [ ] Build succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] Tests pass: `npm test`
- [ ] Deploy to staging
- [ ] Test in staging environment
- [ ] Sales team UAT
- [ ] Deploy to production

---

## 🎁 What Sales Reps Get

After implementation, sales reps can:

1. Copy LinkedIn pending requests (all of them at once)
2. Paste into web form
3. Click "Parse" (AI extracts everything)
4. See preview (20 names + headlines + dates)
5. Select owner (whose requests are these?)
6. Click "Create All 20"
7. **Wait 20 seconds**
8. **See 20 new contacts in Notion**
   - ✓ Names filled
   - ✓ Job titles filled
   - ✓ Companies filled
   - ✓ Status = "request_sent"
   - ✓ Owner = correct person
   - ✓ Dates tracked
   - ✓ All searchable

**Time saved:** 10-15 min → 20 seconds per import (98% faster)

---

## 💰 Cost Analysis

**Per 20-contact import:**
- OpenAI API: ~300 tokens = **$0.00005**
- Notion API: 20 creates = **$0.00 (free tier)**
- **Total: $0.00005 per import**

**Compared to screenshots:**
- Screenshot approach: ~10K tokens = **$0.001-0.002**
- This approach: ~300 tokens = **$0.00005**
- **Savings: 20x cheaper**

**Monthly (assuming 10 imports/month):**
- Cost: $0.0005
- Time saved: 100-150 minutes (1.7-2.5 hours)
- Value: **Priceless** ✓

---

## 🚀 Go-Live Plan

1. **Week 1:** Implement Phases 1-5 (10 hours dev time)
2. **Week 1 End:** Internal testing with real data
3. **Week 2 Start:** Sales team UAT (1-2 hours)
4. **Week 2 Mid:** Gather feedback, fix bugs
5. **Week 2 End:** Deploy to production
6. **Week 3:** Monitor, support sales team
7. **Week 3+:** Gather usage metrics, plan Phase 2 enhancements

---

## 🎓 Reference Implementation

**Existing similar code in repo to reference:**

| File | Relevant For |
|------|-------------|
| `/src/app/api/extract/route.ts` | API endpoint pattern |
| `/src/lib/extraction/extract.ts` | OpenAI integration |
| `/src/lib/extraction/prompt.ts` | System prompt design |
| `/src/app/(app)/add/page.tsx` | UI pattern (parse + preview + create) |
| `/src/lib/notion/contacts.ts` | Notion creation logic |

---

## 🆘 Need Help?

**Implementation questions?**
- Check Full Spec: `docs/superpowers/plans/2026-06-11-bulk-pending-requests-importer.md`
- Check Architecture: `docs/BULK_IMPORT_ARCHITECTURE.md`

**Technical issues?**
- Refer to existing code in `/api/extract/route.ts`
- Check Notion SDK docs: https://developers.notion.com/reference/intro
- Check OpenAI docs: https://platform.openai.com/docs/guides/structured-outputs

**Questions about approach?**
- Review "Design Decisions" section in BULK_IMPORT_ARCHITECTURE.md
- Check "Why This Is Better" in FEATURE_PROPOSAL_SUMMARY.md

---

## 📊 Success Metrics

After go-live, measure:

- **Adoption:** % of sales reps using feature weekly
- **Speed:** Average import time vs. manual (should be <30 sec)
- **Quality:** Error rate (should be 0% vs. 5-10% manual)
- **Satisfaction:** Sales rep feedback (target 4.5+/5)
- **Efficiency Gain:** Hours saved per week (target 5-10 hours)

---

## 🎉 When Ready...

1. Designate a developer
2. Start with BULK_IMPORT_QUICK_START.md
3. Follow Phase 1-5 checklist
4. Test with real data
5. Deploy to production
6. Train sales team (5-min video demo)
7. Celebrate! 🚀

---

**Questions? Check the docs above or open an issue.**

**Ready to build? Start with BULK_IMPORT_QUICK_START.md**

