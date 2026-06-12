# TEG CRM Web App — Complete Team Setup Guide

**TL;DR:** 5 steps, 30 minutes total. After this, your team goes from terminal to web UI.

---

## Status: What's Done

✅ **Code is complete and builds successfully.** All features:
- Login (shared password auth)
- Add Contact (manual + LinkedIn paste + bookmarklet)
- Message Generation (AI 3-variants, copy-paste to LinkedIn manually)
- Screenshot Batch (LinkedIn "Sent Invitations" → auto-extract names/titles)
- Today Action Queue (replies needed, overdue follow-ups, stale requests)
- Pipeline Board (drag-drop by stage)
- Contacts Table (search, inline edit tier/stage/status)
- Follow-up Handler (draft warm replies, log interactions)

❌ **Missing: Setup and deployment.** 4 categories of work before team can use it.

---

## STEP 1: Set Environment Secrets (5 min)

Your `.env.local` file is ready at `teg-crm-web/.env.local`. **It has real values copied from the Python CRM.** But it's missing two user-chosen secrets:

### 1a. Generate and set APP_PASSWORD

This is the shared password your entire sales team uses to log in. Choose something:
- **Strong** (minimum 12 chars, mix of upper/lower/numbers/symbols), OR
- **Generate randomly**: Open terminal and run:
  ```bash
  openssl rand -hex 16
  ```
  Output: `a1b2c3d4e5f6g7h8` (32 hex chars). Copy it.

Edit `.env.local` line 37:
```
APP_PASSWORD=your-chosen-password-here
```

**Store the password in your team chat (Slack/Discord).** Everyone needs it to log in.

### 1b. Generate and set AUTH_SECRET

This is a cryptographic key that signs session cookies (keeps logins secure for 30 days). Must be long and random:

```bash
openssl rand -hex 32
```

Output: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f` (64 hex chars).

Edit `.env.local` line 41:
```
AUTH_SECRET=your-long-random-string
```

**Store this securely** (1Password, LastPass, or pass it to one tech person). Do NOT share on chat. This is a server secret, not a password.

### 1c. Verify all other vars are set

`.env.local` should now have:
- ✅ `NOTION_TOKEN` (from Python CRM)
- ✅ All 7 `NOTION_*_DB_ID` values (from Python CRM)
- ✅ `OPENAI_API_KEY` (from Python CRM, for gpt-4o-mini + gpt-4o)
- ⚠️ `ANTHROPIC_API_KEY` (empty, optional — fallback only)
- ✅ `OUTREACH_BLACKLIST_COMPANIES` (empty for now, optional)
- ✅ `STALE_REQUEST_DAYS=5` (already set)
- ✅ `APP_PASSWORD` (just filled in)
- ✅ `AUTH_SECRET` (just filled in)

If any Notion ID is blank, run this in the Python CRM folder:
```bash
python -m scripts.setup_notion_dbs
```

It will print all 7 IDs again. Paste them into `.env.local`.

---

## STEP 2: Verify Notion Permissions (5 min)

The web app reads/writes the same 7 Notion databases as the Python CRM. The integration must have permission.

### Check: Is the integration invited to the parent page?

1. **In Notion:** Open your **parent Notion page** (the one that contains all 6 databases)
2. **Top right corner:** Click **"Share"** → look for **"TEG CRM"** integration in the list
3. **If present:** ✅ Good to go. Skip to STEP 3.
4. **If missing:** 
   - Click **"Invite"** button
   - Find **"TEG CRM"** in the list
   - Click to add it
   - The integration now sees all databases inside

### Check: Do all 7 database IDs match?

Run this in the Python CRM folder:
```bash
python -m scripts.setup_notion_dbs
```

Compare the 7 IDs it prints with what's in `.env.local`. If they don't match, your `.env.local` has stale IDs. Update them.

---

## STEP 3: Deploy to Vercel (10 min)

This makes the app live on the internet so your team can access it from anywhere (not just localhost).

### 3a. Create a Vercel account (if you don't have one)
- Go to **vercel.com** → **Sign up** (free tier is fine)
- Connect your GitHub account

### 3b. Deploy the web app

From the terminal in the `teg-crm-web/` folder:

```bash
npm install -g vercel
vercel --prod
```

Follow the prompts:
- **Project name:** `teg-crm-web` (or your choice)
- **Framework preset:** Next.js (auto-detected)
- **Confirm settings:** just hit Enter

Output: You'll get a live URL like `https://teg-crm-web.vercel.app`.

### 3c. Set secrets on Vercel

The free Vercel tier has a trick: **environment variables set locally do NOT auto-sync to Vercel.** You must set them manually:

1. Go to **vercel.com** → click your **teg-crm-web** project
2. **Settings** tab → **Environment Variables**
3. Add each variable (copy the value from `.env.local`):
   - `NOTION_TOKEN`
   - `NOTION_CONTACTS_DB_ID`
   - `NOTION_COMPANIES_DB_ID`
   - `NOTION_EVENTS_DB_ID`
   - `NOTION_ATTENDANCE_DB_ID`
   - `NOTION_INTERACTIONS_DB_ID`
   - `NOTION_SPEAKERS_DB_ID`
   - `NOTION_SCREENSHOT_INBOX_DB_ID`
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY` (optional, can be empty)
   - `OUTREACH_BLACKLIST_COMPANIES`
   - `STALE_REQUEST_DAYS`
   - `APP_PASSWORD`
   - `AUTH_SECRET`

4. Each one: paste the value, select environment (Production), click **Save**.

### 3d. Redeploy to apply secrets

```bash
vercel --prod
```

Now your live app has all secrets and is ready.

---

## STEP 4: Copy Config Files from Python CRM (2 min)

The web app uses the same event and team configuration as the Python CRM for consistency:

```bash
# From the teg-crm-web folder:
cp ../teg-crm/config/event.json ./config/
cp ../teg-crm/config/team.json ./config/
```

These files are **not secrets** (no API keys, just event details and team member names). Commit them to git.

If you update `event.json` in the Python CRM (next event, new speakers), **copy it here too** to keep in sync.

---

## STEP 5: Share with the Team (8 min)

Send this to your sales team in Slack/email:

---

### 📋 TEG CRM Launch

Hi team,

The new **TEG CRM web app** is live. You can now log contacts, generate outreach messages, and track the pipeline **without terminal commands**.

**App URL:** `https://your-vercel-url-here`  
**Password:** `your-app-password`  
**(Stored in [team chat link])**

#### First time? Do these three things:

**1. Install the bookmarklet (do this once):**
- Open the app (paste the password)
- Go to **Add Contact** 
- Click **Install Bookmarklet** button
- Drag **＋TEG** to your browser's bookmarks bar

**2. Check Today:**
- Open app → click **Today**
- Use the dropdown to filter to your name
- You'll see action buckets (replies needed, overdue follow-ups, stale requests, message now)

**3. Log a contact:**
- On any LinkedIn profile, click the **＋TEG** bookmarklet
- Name and URL auto-fill
- (Optional) Paste their full LinkedIn profile text for auto-fill of company/title
- Set Tier and Status, click **Add to Notion**

#### Your daily loop:
1. **Check Today** → see your action queue
2. **Add contacts** via bookmarklet or manually
3. **Generate messages** → pick 1 of 3 AI variants → copy → send on LinkedIn manually
4. **Handle replies** → draft follow-up → log it
5. **Move the pipeline** → drag contacts on the board or edit inline

#### If you get stuck:
- **Password wrong?** Check [team chat]
- **Can't log in?** Make sure you're on the live URL (not localhost)
- **Notion field doesn't update?** Refresh the app — Notion takes ~2 sec
- **Something broken?** Slack [tech person]

---

#### Detailed guide:
See `docs/team-quickstart.md` in the repo (this is what the app shows you step-by-step).

---

## STEP 6: Verify It Works (3 min)

### 6a. Local test first (optional, fast)

Before asking the team to test:

```bash
cd teg-crm-web
npm run dev
```

Open `http://localhost:3000` → type the `APP_PASSWORD` → you should see the **Today** screen.

### 6b. Live test

1. Visit your Vercel URL in an incognito window (avoid cached login issues)
2. Paste the password → press Enter
3. You should land on **Today** with the owner filter dropdown visible
4. Go to **Add Contact** → verify the page shows
5. Go to **Messages** → search for a contact that exists in Notion → should appear
6. Go to **Contacts table** → should show a list
7. Go to **Pipeline** → should show a kanban board

If all 5 pages load, **the app is working.** Bugs are edge cases, not blockers.

### 6c. Test Notion integration (critical)

1. **Add Contact page** → add a test contact
2. **Manually verify in Notion:** open Notion, check the **Contacts** database
3. The new contact should appear **within 5 seconds**

If Notion doesn't update, check:
- Is the Notion token still valid? (check `.env.local`)
- Is the integration invited to the parent page? (see STEP 2)
- Are the DB IDs correct? (see STEP 2)

---

## Ongoing: Keep in Sync

After deployment, **maintain sync between Python CRM and web app:**

- If someone updates `config/event.json` in the Python CRM (new event, new speakers), **copy it here:**
  ```bash
  cp ../teg-crm/config/event.json ./config/
  git add config/event.json && git commit -m "chore: sync event config from Python CRM"
  ```
  Vercel will auto-redeploy.

- If Notion schema changes (new property, new database), **update `src/lib/notion/map.ts` and `src/lib/types.ts`** to match.

- The Python CRM's daily reminder bot and weekly report **still run on GitHub Actions** (no changes). The web app is the interactive UI; the Python bot is the automation.

---

## Quick Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Wrong password"** | Typo in APP_PASSWORD | Check Vercel env var matches team password |
| **Login works, but contacts don't load** | NOTION_TOKEN invalid or rate-limited | Wait 60 sec, refresh. Check Notion token is current. |
| **Can't add contact** | OpenAI key missing or quota hit | Check OPENAI_API_KEY in Vercel env. Switch to backup API key if needed. |
| **Screenshots don't extract names** | GPT-4o not being called | Ensure `OPENAI_API_KEY` is set (gpt-4o-mini won't do vision — need full gpt-4o). |
| **Bookmarklet doesn't open app** | Browser security or old cached script | Clear browser cache. Re-install bookmarklet. |
| **Notion doesn't update after add/edit** | Notion API lag or integration permission | Wait 5 sec. Refresh app. Check integration is invited to parent page. |

---

## Files to know

```
teg-crm-web/
├── .env.local                          # Real secrets (gitignored)
├── .env.example                        # Template (committed)
├── src/
│   ├── app/login/page.tsx             # Login screen
│   ├── app/(app)/today/page.tsx        # Your action queue
│   ├── app/(app)/add/page.tsx          # Add contact + bookmarklet installer
│   ├── app/(app)/messages/page.tsx     # Find contact + generate messages
│   ├── app/(app)/screenshots/page.tsx  # Batch screenshot processor
│   ├── app/(app)/contacts/page.tsx     # Contacts table
│   ├── app/(app)/pipeline/page.tsx     # Kanban board
│   ├── app/api/                        # All backend logic (Notion + OpenAI calls)
│   └── lib/                            # Domain logic (extraction, dedup, message generation)
├── config/
│   ├── event.json                      # Synced from Python CRM
│   └── team.json                       # Synced from Python CRM
└── docs/
    ├── team-quickstart.md              # User guide (sent to team)
    └── superpowers/specs/...           # Design spec
```

---

**Questions?** Check `docs/team-quickstart.md` for the user perspective, or `CLAUDE.md` for technical decisions.

Once STEP 5 is done, your team is live. 🚀
