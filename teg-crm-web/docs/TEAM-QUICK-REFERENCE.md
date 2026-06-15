# TEG CRM — Quick Reference Card

**Print this or pin it in Slack.** 60 seconds to answer any team member's question.

---

## Getting Started

| Question | Answer |
|----------|--------|
| **Where is the app?** | [App URL — fill in after deploy] |
| **What's my password?** | [In team Slack — look for "TEG CRM Password"] |
| **How long does login last?** | 30 days (then re-enter password) |
| **Can I use it on my phone?** | Yes — bookmarklet works in Chrome mobile too |

---

## Installing the Bookmarklet (Do This Once)

1. Open app → **Add Contact**
2. Click **"Install Bookmarklet"** button
3. Drag **＋TEG** to your bookmarks bar
4. Done. Now click it on any LinkedIn profile.

---

## Your Daily Loop (4 Steps)

### Step 1: Check Today
**Open app → click Today**
- Filter to your name (dropdown top-right)
- See 4 action buckets:
  - 🔴 **Replies Needed** — click to draft response
  - 🟡 **Follow-Ups Due** — overdue, needs attention
  - ⏱️ **Stale Requests** — sent >5 days ago, no update
  - 💬 **Message Now** — connected, not messaged yet
- **Click button** next to contact → go to message screen

### Step 2: Log Contacts

**Option A (Fast — bookmarklet):**
- Open LinkedIn profile
- Click **＋TEG** in bookmarks
- Name + URL auto-fill
- Set Tier (1=C-level, 2=VP/Director, 3=Manager)
- Click **Add to Notion**

**Option B (With profile info):**
- Use bookmarklet as above
- Paste full LinkedIn profile text (headline + about + experience)
- Fields auto-fill
- Save

**Option C (Screenshots — batch):**
- Open app → **Screenshots**
- Take screenshot of LinkedIn "Sent Invitations"
- Drop it in the box
- Review extracted names
- Click **Create contacts**

### Step 3: Generate Messages
- **Messages** tab
- Search contact by name
- (Optional) Paste their LinkedIn profile for better personalization
- AI generates **3 variants** (different angles)
- **Pick one** → edit if needed → copy
- **Go to LinkedIn** → paste → send manually
- Back to app → click **Mark as messaged + log**

### Step 4: Handle Replies
- **Messages** tab → search contact
- Scroll to **Follow-up** section at bottom
- Paste their reply text
- Click **Draft reply** → get short, warm response
- Copy → send on LinkedIn
- Click **Log follow-up**
- If reply is positive (e.g., "klingt spannend"), **Mark as Engaged** button appears

---

## Moving the Pipeline

**Option A (Visual drag-drop):**
- Go to **Pipeline** tab
- Drag contact card to new column (stage)
- Confirm dialog appears — click to confirm

**Option B (Quick edit):**
- Go to **Contacts** tab
- Search or scroll to find contact
- Click row → side panel opens
- Change Stage, Tier, or Status
- Auto-saves

---

## Keyboard Shortcuts & Tips

| Action | How |
|--------|-----|
| **Login faster** | Save the app URL in your browser home screen (mobile + desktop) |
| **Know the Tiers** | 1=C-level (CEO/CTO), 2=VP/Director, 3=Manager/Other |
| **Need a message refresh?** | Click **Regenerate** — AI makes 3 new variants |
| **Paste the full profile** | Go to their LinkedIn → scroll to top → triple-click biography section → copy all → paste in the app — more detail = better messages |
| **Screenshot extraction slow?** | Check your internet. If image is huge (>5MB), crop it smaller. |
| **Can I edit a contact later?** | Yes — **Contacts** tab → search → click row → edit any field |
| **Duplicate contact by accident?** | No problem — app deduplicates by LinkedIn URL. Adding a duplicate just enriches empty fields. |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **"Wrong password"** | Double-check Slack for the exact password. No spaces. |
| **Bookmarklet doesn't open** | Browser update needed. Or: use **Add Contact** page directly. |
| **Notion doesn't update** | Wait 5 sec + refresh. Notion is slightly laggy. |
| **Screenshot names are wrong** | Make sure you're screenshotting the "Sent Invitations" page (not your sent messages). If extraction fails, add them manually. |
| **Message variants are boring** | Paste more of their LinkedIn profile (full about + experience). More context = better AI. |
| **Can't find a contact** | Try searching by first name only (if last name is misspelled). Or search by company. |
| **Missing a stage/tier option** | Refresh the page. If still missing, reach out to tech lead. |

---

## This App vs. LinkedIn

| Task | App | LinkedIn |
|------|-----|----------|
| **Log a contact** | ✅ Fast (bookmarklet) | ❌ Manual, slow |
| **Track pipeline** | ✅ Kanban board | ❌ Hidden in profiles |
| **Generate messages** | ✅ AI 3-variants | ❌ Blank page |
| **Draft follow-ups** | ✅ AI warm reply | ❌ Blank page |
| **Batch screenshot processing** | ✅ Upload batch → auto-extract | ❌ Manual one-by-one |
| **Team overview** | ✅ See whole pipeline + everyone's queue | ❌ Just your messages |

**The app copies to clipboard. You send on LinkedIn manually (no LinkedIn ban risk).**

---

## Data Integrity Rules

- ✅ **Notion is the source of truth.** The app reads/writes Notion. If you edit Notion directly, the app reflects it.
- ✅ **Dedup by LinkedIn URL.** Same URL = same contact. Adding a duplicate just fills empty fields.
- ✅ **Enrichment is non-destructive.** App never overwrites info you've manually entered.
- ✅ **Interactions are logged.** Every message, follow-up, and status change is recorded in Notion (Interactions DB).
- ✅ **30-day sessions.** You're logged in for 30 days. On day 31, re-enter password.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Tier 1** | C-level / executive (CEO, CTO, COO, etc.) |
| **Tier 2** | VP, Director, Head of Dept |
| **Tier 3** | Manager, IC, other |
| **Request Sent** | You've sent a connection request on LinkedIn |
| **Connected** | They accepted the connection request |
| **Messaged** | You've sent them an outreach message |
| **Engaged** | They replied positively (signed up, interested) |
| **Follow-up Due** | Your reminder date has passed, needs action |
| **Stale Request** | Request sent >5 days ago with no update |
| **Outreach Blacklist** | Companies we don't contact (e.g., Accenture, Oliver Wyman — confirmed speakers) |

---

## Helpful Links

- **Full guide:** [Link to docs/team-quickstart.md in repo]
- **Report a bug:** Ping [tech lead] in Slack
- **Notion workspace:** [Link to TEG CRM Notion]
- **Vercel status:** [Link to Vercel project]

---

**Bookmark this page.** Seriously. Saves time later. 📌

**Last updated:** 2026-06-09
