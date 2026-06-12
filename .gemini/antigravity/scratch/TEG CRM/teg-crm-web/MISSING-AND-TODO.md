# What's Missing & Exactly What You Need To Do

**TL;DR:** App is built. 5 quick tasks to make it live for your team. ~30 min total.

---

## The Missing Pieces (In Order of Doing Them)

### 1️⃣ APP_PASSWORD & AUTH_SECRET (Must Do First)

**Status:** `.env.local` exists but has blank values on lines 37 and 41

**What to do:**
```bash
# Generate AUTH_SECRET
openssl rand -hex 32
# Copy output → edit teg-crm-web/.env.local line 41
# Example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f

# Choose APP_PASSWORD (anything 12+ chars, or use random):
openssl rand -hex 16
# Copy output → edit teg-crm-web/.env.local line 37
# Example: a1b2c3d4e5f6g7h8 (or choose your own like "TeGcRM2024!Secure")
```

**Why:** These are security keys. Only you (the owner) generate them.

**Verify:**
```bash
grep "^APP_PASSWORD=" teg-crm-web/.env.local   # Should show value, not empty
grep "^AUTH_SECRET=" teg-crm-web/.env.local    # Should show 64+ char string
```

---

### 2️⃣ Notion Integration Permission (5 min check)

**Status:** Code is ready; just verify permissions

**What to do:**
1. Open Notion
2. Go to the **parent page** that contains your 6 CRM databases
3. Click **Share** (top right)
4. Look for **"TEG CRM"** in the list
5. **If missing:** click Invite → find TEG CRM → add it
6. **If present:** you're done

**Why:** The app calls Notion API. It needs permission to read/write the databases.

---

### 3️⃣ Deploy to Vercel (10 min, one-time)

**Status:** App builds locally. Not deployed yet.

**What to do:**

```bash
# Step A: Install Vercel CLI
npm install -g vercel

# Step B: Deploy
cd teg-crm-web
vercel --prod
```

Follow the prompts:
- Project name: `teg-crm-web` (press Enter)
- Framework: Next.js (auto-detected, press Enter)
- Continue building: yes
- **Copy the live URL** that's printed (e.g., `https://teg-crm-web.vercel.app`)

**Step C: Set environment variables on Vercel**

1. Go to **vercel.com** → click your **teg-crm-web** project
2. **Settings** → **Environment Variables**
3. Add these 14 variables (copy from `teg-crm-web/.env.local`):
   ```
   NOTION_TOKEN
   NOTION_CONTACTS_DB_ID
   NOTION_COMPANIES_DB_ID
   NOTION_EVENTS_DB_ID
   NOTION_ATTENDANCE_DB_ID
   NOTION_INTERACTIONS_DB_ID
   NOTION_SPEAKERS_DB_ID
   NOTION_SCREENSHOT_INBOX_DB_ID
   OPENAI_API_KEY
   ANTHROPIC_API_KEY (can be empty)
   OUTREACH_BLACKLIST_COMPANIES
   STALE_REQUEST_DAYS
   APP_PASSWORD
   AUTH_SECRET
   ```
4. For each: paste value → select **Production** → click **Save**

**Step D: Redeploy to apply secrets**
```bash
vercel --prod
```

**Verify:** Visit the Vercel URL (e.g., `https://teg-crm-web.vercel.app`) → type APP_PASSWORD → should see **Today** screen

---

### 4️⃣ Copy Config Files (2 min)

**Status:** Config files missing; need to sync from Python CRM

**What to do:**
```bash
# From teg-crm-web folder:
cp ../teg-crm/config/event.json ./config/
cp ../teg-crm/config/team.json ./config/
```

**Why:** The web app uses the same event + team configuration as the Python CRM (for consistency).

**Maintain sync:** If someone updates `event.json` in the Python CRM (new event), copy it here too:
```bash
cp ../teg-crm/config/event.json ./config/event.json
git add config/event.json && git commit -m "chore: sync event config from Python CRM"
```
Vercel will auto-redeploy.

---

### 5️⃣ Share with Team (8 min)

**Status:** Everything is done. Just need to inform team.

**What to do:**

Send this message to your sales team in Slack:

```
🚀 TEG CRM is live!

App URL: https://teg-crm-web.vercel.app
Password: [ask in #sales or DM me]

First time? Read this → [link to docs/team-quickstart.md]

TL;DR:
1. Open app → type password
2. Go to "Add Contact" → click "Install Bookmarklet"
3. From now on, click ＋TEG bookmarklet on LinkedIn profiles
4. App logs contacts → generate messages → track pipeline

Questions? Check the guide or ping me.
```

---

## Check These Before Telling Team

- [ ] **Step 1:** `.env.local` line 37 has non-empty APP_PASSWORD
- [ ] **Step 1:** `.env.local` line 41 has 64+ char AUTH_SECRET
- [ ] **Step 2:** "TEG CRM" integration shows in Notion Share
- [ ] **Step 3:** Vercel URL is live and accessible (test on phone)
- [ ] **Step 3:** All 14 env vars set in Vercel dashboard
- [ ] **Step 4:** `config/event.json` and `config/team.json` exist locally
- [ ] **Step 5:** Team received Vercel URL + password

If all boxes checked → **you're done. Team is live.**

---

## Quick Local Test (Before Vercel)

```bash
cd teg-crm-web
npm run dev
```

Open `http://localhost:3000`:
- Type APP_PASSWORD → should see **Today** page ✅
- Click "Add Contact" → bookmarklet button visible ✅
- Click "Messages" → search works ✅
- Click "Contacts" → see table ✅
- Click "Pipeline" → see kanban ✅

If all pass → app is working. Ready to deploy.

---

## Common Mistakes to Avoid

❌ **Don't:** Set APP_PASSWORD = "password" (too weak)  
✅ **Do:** Use `openssl rand -hex 16` output or strong password

❌ **Don't:** Deploy before setting env vars on Vercel  
✅ **Do:** Set all 14 vars BEFORE final deploy

❌ **Don't:** Share AUTH_SECRET on Slack  
✅ **Do:** Store in 1Password or just don't share (server secret)

❌ **Don't:** Deploy, test, then realize config files are missing  
✅ **Do:** Copy event.json + team.json BEFORE deploying

❌ **Don't:** Tell team it's live, then discover Notion permission issue  
✅ **Do:** Test "Add Contact" locally first (confirms Notion works)

---

## If Something Goes Wrong

| Error | Cause | Fix |
|-------|-------|-----|
| "Wrong password" after deploy | Vercel APP_PASSWORD doesn't match what you're typing | Check Vercel env var exactly matches |
| Contacts don't load | Notion token invalid or not invited | Check NOTION_TOKEN in .env.local. Check integration in Notion Share. |
| Build fails | Missing dependency or broken code | Run `npm run build` locally. Should succeed. |
| "Can't access Vercel URL" | Deployment failed | Check `vercel logs` in terminal |
| Notion updates take 10+ sec | API lag (normal) | Refresh app after 5 sec. This is expected. |

---

## Timeline

| Step | Time | What Happens |
|------|------|--------------|
| 1 | 5 min | Edit .env.local (add APP_PASSWORD + AUTH_SECRET) |
| 2 | 5 min | Check Notion integration permission |
| 3 | 10 min | Deploy to Vercel + set env vars + redeploy |
| 4 | 2 min | Copy config files |
| 5 | 8 min | Share Vercel URL + password with team |
| **Total** | **~30 min** | **Team can start using it** |

---

## Files You Created/Modified Today

```
teg-crm-web/
├── .env.local                          ← Modified (added secrets)
├── docs/
│   ├── TEAM-SETUP-GUIDE.md             ← New (your reference)
│   ├── IMPLEMENTATION-STATUS.md        ← New (status overview)
│   └── TEAM-QUICK-REFERENCE.md         ← New (for your team)
└── MISSING-AND-TODO.md                 ← This file
```

---

## Next Steps

1. **Right now:**
   - Edit `.env.local` (add APP_PASSWORD + AUTH_SECRET)
   - Test locally: `npm run dev`

2. **Then:**
   - Check Notion integration
   - Deploy to Vercel

3. **Finally:**
   - Copy config files
   - Share with team

**Question:** Want me to help with any of these steps?

---

**Last updated:** 2026-06-09  
**Branch:** `feature/crm-web-app`  
**Status:** Ready to deploy (waiting on you for 5 steps)
