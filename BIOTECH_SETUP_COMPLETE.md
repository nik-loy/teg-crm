# ✅ Biotech 2026 Outreach Integration — COMPLETE

**Date:** 2026-06-11  
**Status:** Ready for use

---

## What Was Done

Your LinkedIn outreach document has been **fully integrated** into the TEG CRM system. The application now supports automated, AI-powered message generation for the Biotech 2026 event with complete German language support.

### 6 Files Created

#### 1. **Configuration** (`config/biotech_event.json`)
Complete event configuration extracted from your document:
- Event details (3. Juli 2026, IZB Martinsried)
- 5 speakers with company affiliations
- 5 agenda items (18:00–22:30)
- 6 intern companies (speaker institutions)
- 22 personalization keywords
- Message examples for all target types
- Follow-up response templates
- Seniority risk tiers for ethical outreach

#### 2. **Enhanced Message Generator** (`src/linkedin/message_gen.py`)
Updated to support multiple event configs:
- Added `--event biotech_event.json` parameter
- Generates German-language messages
- AI-powered personalization with Fit-Rating system
- Automatic seniority vetting
- Pre-flight quality checks
- Notion logging integration

#### 3. **Interactive Wizard** (`scripts/biotech_outreach_wizard.py`)
Step-by-step guided workflow for all 4 phases:
- **Phase 1:** LinkedIn networking (connection requests)
- **Phase 2:** Message generation with AI
- **Phase 3:** Manual sending on LinkedIn
- **Phase 4:** Follow-up response generation

Run with: `python -m scripts.biotech_outreach_wizard`

#### 4. **Main Documentation** (`docs/biotech_outreach_workflow.md`)
Comprehensive 15-section guide including:
- Complete 4-phase workflow with timeline
- LinkedIn search keywords and targeting strategy
- Real message examples (all 4 types)
- Seniority risk tier management
- Notion logging architecture
- Quality assurance checklist
- Troubleshooting guide
- Speaker profiles and discussion topics

#### 5. **Quick Reference** (`docs/biotech_quick_reference.md`)
One-page cheat sheet with:
- Commands (3 essential ones)
- Pre-flight checklist
- Message templates for all scenarios
- Follow-up response templates
- Seniority risk matrix
- Personalization keywords
- Timeline and milestones
- Troubleshooting quick-fix table

#### 6. **Integration Documentation**
- `BIOTECH_INTEGRATION_SUMMARY.md` — Technical details & architecture
- `docs/README_BIOTECH.md` — Navigation guide for all documentation

---

## How to Use

### For Team Members (Non-Technical)

**First Time?**
```bash
python -m scripts.biotech_outreach_wizard
```
Interactive wizard guides you through all 4 phases.

**Quick Commands:**

```bash
# After someone accepts your connection request:
python -m src.linkedin.message_gen \
  --url https://linkedin.com/in/person \
  --owner YourName \
  --event biotech_event.json

# When they reply (e.g., "Klingt spannend"):
python -m src.linkedin.message_gen \
  --url https://linkedin.com/in/person \
  --owner YourName \
  --mode follow-up \
  --reply "Klingt spannend" \
  --event biotech_event.json
```

### For Project Managers

**Monitor progress in Notion:**
- **Interactions database:** Every message logged with timestamp
- **Contact Pipeline Stage:** Tracks Awareness → Messaged → Engaged → Deepening
- **Last Contact Date:** Automatically updated
- **UTM Tracking:** Each team member's utm_source shows source of registration

**Team coordination:**
- Check Notion Interactions before reaching out (prevents duplicates)
- Flag high-seniority contacts in Slack for approval
- Share lead discoveries in team channel

### For Developers

**Customize event config:**
Edit `config/biotech_event.json` to:
- Update event details
- Add/remove speakers
- Modify personalization keywords
- Adjust message templates
- Change risk tiers

**Support multiple events:**
Create `config/event_name.json` with same structure, then use:
```bash
python -m src.linkedin.message_gen --url [URL] --owner [Name] --event event_name.json
```

**All tests pass:**
```
tests/test_message_gen.py: 21/21 ✓
```

---

## Key Features

### ✅ German Language Support
All messages are generated in **native German** with:
- Proper Du/Sie formality switching based on seniority
- Regional appropriateness (München/DACH)
- Natural conversational tone (not templated)
- Localizable opening/closing variations

### ✅ AI-Powered Personalization
For each contact, the system generates:
1. **Fit-Rating (1–5)** — How well their profile matches the event
2. **Seniority Check** — Identifies high-risk contacts for approval
3. **Template Type** — Intern (speaker company) vs. External
4. **Formality Level** — Du (casual) vs. Sie (formal)
5. **LinkedIn Message** — Actual message (350–500 characters)

### ✅ Automatic Quality Control
Pre-flight checklist before sending:
- ✓ Fit rating ≥ 3/5
- ✓ No seniority warnings (or approved by Finn)
- ✓ Message ≤ 500 characters (target 350–450)
- ✓ Name spelling verified
- ✓ Link valid with tracking parameters
- ✓ No duplicate outreach in Notion

### ✅ Notion Integration
Automatic audit trail:
- **Interactions logged** — Every message with timestamp
- **Pipeline progression** — Moves from Awareness → Engaged
- **Last contact date** — Updated automatically
- **Engagement history** — Full conversation trail for team

### ✅ Backward Compatible
- Existing ACC 2026 event still works (default)
- All existing scripts unchanged
- New `--event` parameter is optional
- All 21 existing tests pass

---

## Example Workflow

### Contact: Lena Hofmann (Research Scientist, Drug Discovery)

**Step 1: Send Connection Request** (LinkedIn)
```
Click "Vernetzen" → no message → wait 2–3 days
```

**Step 2: Generate Message** (Your Terminal)
```bash
python -m src.linkedin.message_gen \
  --url https://linkedin.com/in/lena-hofmann \
  --owner Finn \
  --event biotech_event.json
```

(Paste her LinkedIn profile data when prompted)

**Step 3: System Outputs:**
```
Fit-Rating: 4/5
Research Scientist in Drug Discovery — strong biotech focus

Senioritäts-Check: OK — no warnings

Template: Extern (external company, mention speaker firms)

Ansprache: Du (young professional, casual tone)

Nachricht:
Hey Lena, danke fürs Vernetzen! Hab gesehen, dass du viel im 
Bereich Drug Discovery machst. Wir machen am 3.7. im IZB 
Martinsried einen Biotech-Abend mit Foundern und CEOs aus der 
Münchner Szene, u.a. von Tubulis und Eisbach Bio, dazu BioM und 
Roland Berger. Könnte gut zu deinem Fokus passen. Falls spannend: 
luma.com/teg-qdjm?utm_source=finn VG Finn
```

**Step 4: Send on LinkedIn**
```
Open Lena's profile → Nachricht → Paste → Send
```

**Step 5: Log to Notion**
System automatically:
- ✓ Creates Interaction record
- ✓ Updates contact Pipeline Stage → "Messaged"
- ✓ Sets Last Contact Date → today

**Step 6: Handle Reply** (when Lena replies "Klingt spannend!")
```bash
python -m src.linkedin.message_gen \
  --url https://linkedin.com/in/lena-hofmann \
  --owner Finn \
  --mode follow-up \
  --reply "Klingt spannend" \
  --event biotech_event.json
```

**System outputs follow-up:**
```
Freut mich! Falls du Fragen zum Format hast, schreib mir gerne, 
sonst findest du alles Wichtige direkt auf der Seite.
```

**Step 7: Final Notion Update**
- ✓ Creates follow-up Interaction record
- ✓ Promotes Pipeline Stage → "Engaged"
- ✓ Maintains full conversation history

---

## Documentation Quick Links

| Need | Read |
|------|------|
| **Quick overview** | `docs/biotech_quick_reference.md` (2 min) |
| **Full workflow guide** | `docs/biotech_outreach_workflow.md` (20 min) |
| **Navigation guide** | `docs/README_BIOTECH.md` (5 min) |
| **Technical details** | `BIOTECH_INTEGRATION_SUMMARY.md` (10 min) |
| **Event config** | `config/biotech_event.json` (edit as needed) |

---

## Event Timeline

| Date | Action |
|------|--------|
| **Now (June 11)** | Phase 1 — Send connection requests (~50–75) |
| **June 13–14** | Wait for ~50% acceptance |
| **June 15–30** | Phase 2–3 — Generate & send messages |
| **June 25–July 1** | Phase 4 — Follow-up responses |
| **July 1, 2026** | ⏰ Registration deadline (limited seats) |
| **July 3, 2026** | 🎯 Event day (18:00–22:30, IZB Martinsried) |

---

## Seniority Risk Tiers

The system automatically flags and warns about high-seniority contacts:

| Company | Risk Level | Examples |
|---------|-----------|----------|
| Tubulis | Team-Lead+ | 🔴 Flag for approval |
| Eisbach Bio | Team-Lead+ | 🔴 Flag for approval |
| Roland Berger | Project Manager+ | 🔴 Flag for approval |
| LMU München | Professors | 🔴 Flag for approval |
| TUM München | Professors | 🔴 Flag for approval |
| BioM | All OK | ✅ Proceed |
| External Biotech | Junior–Manager | ✅ Proceed |

**When flagged:** System displays message, you ask Finn for approval before sending.

---

## Tests Pass ✅

```
tests/test_message_gen.py: 21/21 ✓
- Fit-rating parsing
- Message extraction
- System prompt building
- Pre-flight checks
- Follow-up generation
```

Configuration validates:
```
config/biotech_event.json: ✓ Valid JSON
- 5 speakers loaded
- 5 agenda items loaded
- 6 risk tiers configured
- 22 personalization keywords
- 4 message examples
- 3 follow-up examples
```

---

## Setup Checklist

Before starting outreach:

- [ ] Review `docs/biotech_quick_reference.md` (2 min)
- [ ] Run `python -m scripts.biotech_outreach_wizard` (understand workflow)
- [ ] Verify `OPENAI_API_KEY` is set in `.env`
- [ ] Verify Notion access for team members
- [ ] Review `config/biotech_event.json` (check speakers/date)
- [ ] Update team member utm_sources in links if needed
- [ ] Test first message generation with a known contact
- [ ] Create Slack channel for team coordination
- [ ] Brief team on 4-phase workflow

---

## Support

**How do I...?**

**...start outreach?**  
Run: `python -m scripts.biotech_outreach_wizard`

**...generate a message?**  
Run: `python -m src.linkedin.message_gen --url [URL] --owner [Name] --event biotech_event.json`

**...handle a high-seniority contact?**  
System flags them. Ask Finn for approval via Slack before sending.

**...customize the event?**  
Edit `config/biotech_event.json` (no code changes needed)

**...use this for other events?**  
Create `config/event_name.json` and use `--event event_name.json`

**...review my messages in Notion?**  
Check Interactions database for all logged messages

---

## Summary

You now have a **complete, production-ready, German-language LinkedIn outreach system** integrated into your TEG CRM:

✅ Fully automated message generation  
✅ AI-powered personalization (Fit-Rating, Seniority checks)  
✅ German language with proper formality (Du/Sie)  
✅ Notion audit trail & pipeline tracking  
✅ Interactive wizard for non-technical team members  
✅ 4-phase workflow with timeline  
✅ Comprehensive documentation (4 guides)  
✅ Quality assurance checklist  
✅ Seniority risk management  
✅ Backward compatible with existing events  
✅ All tests passing  

**Status: Ready to deploy! 🚀**

---

## Files Summary

```
TEG CRM/teg-crm/
├── BIOTECH_INTEGRATION_SUMMARY.md          ← Technical details
├── BIOTECH_SETUP_COMPLETE.md               ← This file
├── config/
│   └── biotech_event.json                  ← Event configuration
├── docs/
│   ├── README_BIOTECH.md                   ← Navigation guide
│   ├── biotech_outreach_workflow.md        ← Full reference (20 min)
│   └── biotech_quick_reference.md          ← Cheat sheet (2 min)
├── scripts/
│   └── biotech_outreach_wizard.py          ← Interactive wizard
└── src/linkedin/
    └── message_gen.py                      ← Updated (supports --event)
```

**Total: 6 new files, 1 modified file, all tests passing**

---

**Next step:** Run the wizard!
```bash
python -m scripts.biotech_outreach_wizard
```

🚀 **Let's grow the Biotech community!**
