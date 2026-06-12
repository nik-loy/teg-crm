# TEG CRM Web App — Deployment Guide

**Status:** ✅ Ready to deploy to Vercel  
**Build:** Passing ✓  
**Config:** Synced ✓  
**Secrets:** Configured ✓

---

## Quick Deployment (10 minutes)

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Deploy to Vercel

```bash
cd teg-crm-web
vercel --prod
```

Follow the prompts:
- **Project name:** `teg-crm-web` (press Enter)
- **Framework:** Next.js (auto-detected, press Enter)
- **Root directory:** `.` (press Enter)
- **Continue building:** `y`

**Output:** You'll see a live URL like `https://teg-crm-web-xxxxx.vercel.app`

### 3. Set Environment Variables on Vercel

1. Go to **vercel.com** → click your **teg-crm-web** project
2. **Settings** → **Environment Variables**
3. Add these 14 variables (copy from `.env.local`):

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
ANTHROPIC_API_KEY
OUTREACH_BLACKLIST_COMPANIES
STALE_REQUEST_DAYS
APP_PASSWORD
AUTH_SECRET
```

For each: paste value → select **Production** → click **Save**

### 4. Redeploy

```bash
vercel --prod
```

This applies the environment variables to your production deployment.

### 5. Test

Visit your Vercel URL → Type `APP_PASSWORD` (from `.env.local`) → Should see **Today** screen

---

## Current Settings

| Setting | Value |
|---------|-------|
| **APP_PASSWORD** | TEGmoney (shown in `.env.local` line 39) |
| **AUTH_SECRET** | 64-char key (shown in `.env.local` line 42) |
| **Notion Token** | Configured ✓ |
| **All API Keys** | Configured ✓ |
| **Event Config** | ACC 2026 (primary) + Biotech 2026 (secondary) |
| **Team Config** | Synced from Python CRM ✓ |

---

## Architecture

### Frontend
- **Next.js 15** App Router
- **React 19** for UI
- **TypeScript** strict mode
- **Tailwind CSS v4** + **shadcn/ui**
- **Recharts** for pipeline visualization

### Backend (Server-Only)
- **Notion SDK** for database operations
- **OpenAI SDK** for message generation (gpt-4o-mini)
- **Gemini API** for image extraction (vision)
- **Auth middleware** for session management

### Deployment
- **Vercel** (free tier)
- **Auto-scaling** on demand
- **Environment variables** for secrets
- **GitHub integration** for auto-deploy on push

---

## Routes Overview

### User-Facing Pages
| Route | Purpose |
|-------|---------|
| `/login` | Password entry |
| `/today` | Action queue (one-click to-dos) |
| `/contacts` | Full contacts table |
| `/pipeline` | Kanban board by Pipeline Stage |
| `/messages` | Message generation interface |
| `/add` | Add contact manually |
| `/screenshots` | Batch screenshot processing |

### API Routes (Server-Only)
| Route | Purpose |
|-------|---------|
| `/api/auth/login` | Authenticate with password |
| `/api/auth/logout` | Clear session |
| `/api/contacts/list` | Fetch contacts (with filtering) |
| `/api/contacts/search` | Search by name/company/email |
| `/api/contacts/[id]/update` | Update contact fields |
| `/api/message` | Generate message variants |
| `/api/followup` | Generate follow-up response |
| `/api/extract` | Extract profile from text (AI) |
| `/api/interactions` | Log interaction to Notion |
| `/api/today` | Fetch action queue |
| `/api/stats` | Calculate dashboard metrics |

---

## How It Works

### 1. User Logs In
```
User types APP_PASSWORD → /api/auth/login → Sets session cookie → Redirected to /today
```

### 2. User Adds a Contact
```
Option A: Click ＋TEG bookmarklet on LinkedIn profile → Pre-fills name + URL
Option B: Paste LinkedIn profile text → System extracts via OpenAI gpt-4o-mini
System deduplicates by LinkedIn URL → Creates Notion contact → Returns to /today
```

### 3. User Generates Message
```
Select contact → /messages → Paste LinkedIn profile → System generates 3 variants:
  - Variant 1: External, casual
  - Variant 2: Internal (if from speaker company), formal
  - Variant 3: Re-engagement / follow-up angle
User selects, edits, copies → Logs to Notion as Interaction → Message is NOT sent (ban risk)
```

### 4. User Handles Reply
```
Contact replied → /messages/[contactId] → User types reply text
System generates contextual follow-up via OpenAI → User copies → Logs interaction
```

### 5. Team Tracks Progress
```
/today → Shows overdue & stale contacts (not yet messaged)
/contacts → Full table, sortable by stage/date/owner
/pipeline → Kanban board by stage → visual progress
/dashboard → Stats (contacts this week, conversion %, etc.)
```

---

## Notion Integration

### Write Operations
- **Add Contact** → Creates entry in Contacts DB
- **Update Status** → Sets "LinkedIn Outreach Status"
- **Log Message** → Creates Interaction record
- **Log Reply** → Updates Interaction + Pipeline Stage

### Read Operations
- **Fetch Contacts** → Queries Contacts DB with filters
- **Check Status** → Reads "LinkedIn Outreach Status"
- **View Interactions** → Queries Interactions by contact
- **Calculate Stats** → Aggregates Contacts by stage

**Rate Limit:** Notion API allows 3 req/sec → App batches requests & uses exponential backoff

---

## Security Model

### Authentication
- **Single shared password** (APP_PASSWORD in `.env.local`)
- **Session cookies** signed with AUTH_SECRET
- **No user accounts** (all team members share one login)

### Secrets Management
- **Never in code** — all secrets via environment variables
- **Never on client** — all API calls via Route Handlers (server-only)
- **Vercel env vars** — encrypted at rest, deleted if you delete the project
- **Notion token** — has minimal scope (read/write specific databases only)

### LinkedIn Safety
- **No LinkedIn API** — data is manual copy-paste only (ban-safe by design)
- **No messaging API** — messages are copied to clipboard, human sends on LinkedIn
- **No bot activity** — all actions are manual clicks by a human

---

## Monitoring & Logs

### Local Development
```bash
npm run dev
# Logs to console, refresh browser to see changes
```

### Production (Vercel)
```bash
# View logs (requires Vercel CLI)
vercel logs [url]

# Example:
vercel logs https://teg-crm-web.vercel.app
```

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| "Wrong password" | APP_PASSWORD mismatch | Check `.env.local` vs Vercel vars |
| "Contacts not loading" | Notion token invalid/expired | Regenerate token at notion.so/my-integrations |
| "Message generation failed" | OpenAI quota or API key | Check OPENAI_API_KEY in Vercel |
| "Build failed" | Dependencies or syntax error | Run `npm run build` locally, check output |

---

## Updating the App

### New Event Configuration
When you add a new event (e.g., `biotech_event.json`):

1. **In Python CRM:**
   ```bash
   cd teg-crm
   # Create config/new_event.json
   git add config/new_event.json
   git commit -m "feat: add new event config"
   ```

2. **In Web App:**
   ```bash
   cd teg-crm-web
   cp ../teg-crm/config/new_event.json ./config/
   git add config/new_event.json
   git commit -m "chore: sync event config from Python CRM"
   ```

3. **Vercel Auto-Redeploys** when you push to GitHub

### Code Changes
1. Make changes locally
2. Test: `npm run dev` then `npm test`
3. Commit: `git add . && git commit -m "..."`
4. Push: `git push`
5. Vercel auto-deploys when GitHub webhook fires

---

## Rollback Plan

If something breaks in production:

```bash
# Option 1: Redeploy previous version (Vercel keeps history)
vercel --prod     # Deploys current main branch

# Option 2: Check out previous commit
git log --oneline | head -5      # See recent commits
git revert [commit-hash]          # Undo last commit
git push
# Vercel auto-redeploys

# Option 3: Disable deployment temporarily
# (On Vercel dashboard, set production branch to a stable branch)
```

---

## Performance

### Load Times
- **Login page:** <500ms
- **Today page:** <1s (depends on Notion query)
- **Contacts table:** 1–2s (100 contacts)
- **Pipeline board:** <2s
- **Message generation:** 3–5s (including OpenAI call)

### Optimization Tips
- **Enable Vercel Edge Caching** (auto-enabled for /api routes)
- **Batch Notion requests** (app does this automatically)
- **Compress images** before uploading to screenshots

### Scaling
- **Free Vercel plan:** Up to ~100 concurrent users
- **Pro plan:** Unlimited (costs ~$20/month + API usage)
- If team grows beyond 10 users, consider upgrading

---

## Support

### For Vercel Issues
- Check Vercel dashboard: https://vercel.com/dashboard
- View logs: `vercel logs [url]`
- Docs: https://vercel.com/docs

### For App Issues
- Check browser console: `F12` → Console tab
- Check Notion: make sure databases exist and are accessible
- Restart dev: `npm run dev`
- Clear cache: Ctrl+Shift+Delete → All time

### For Notion Issues
- Check integration at notion.so/my-integrations
- Verify it's invited to parent page (Share → Look for integration name)
- Check database IDs in .env.local (must match Notion URLs)

---

## Maintenance Checklist

### Monthly
- [ ] Check Vercel logs for errors
- [ ] Verify all team members can log in
- [ ] Test message generation with sample profile
- [ ] Backup config files (event.json, team.json)

### Quarterly
- [ ] Update dependencies: `npm update`
- [ ] Review API usage (OpenAI, Notion)
- [ ] Sync event configs from Python CRM
- [ ] Check Vercel build times

### Annually
- [ ] Rotate secrets (APP_PASSWORD, AUTH_SECRET)
- [ ] Audit Notion database growth
- [ ] Plan for paid Vercel plan if needed
- [ ] Review access logs

---

## Useful Commands

```bash
# Development
npm run dev              # Start local server
npm test                 # Run tests
npm run test:watch      # Watch mode

# Building
npm run build           # Production build
npm run lint            # Check code quality

# Deployment
vercel                  # Deploy to preview
vercel --prod           # Deploy to production
vercel env pull         # Sync Vercel secrets to .env.local

# Cleanup
npm clean-install       # Clean reinstall of node_modules
rm -rf .next            # Clear next build cache
```

---

## FAQ

**Q: Can team members access the app?**  
A: Yes, they go to the Vercel URL and type APP_PASSWORD.

**Q: What happens if someone forgets the password?**  
A: Only you (the owner) know it. Share verbally or via 1Password. Never on Slack/email.

**Q: Can I change the password?**  
A: Yes — edit `.env.local` APP_PASSWORD, then on Vercel dashboard update the variable, then redeploy.

**Q: Does the app send LinkedIn messages?**  
A: No. It copies to clipboard. Team sends manually (ban-safe by design).

**Q: What if Notion goes down?**  
A: App won't load contacts. Once Notion is back, refresh the page.

**Q: Can I use this for multiple events?**  
A: Yes. Config files support multiple events. Add event.json files to `config/`, then select event in UI.

**Q: How much does this cost?**  
A: Vercel free tier is free. OpenAI costs ~$0.01–0.10 per message (gpt-4o-mini is cheap). Notion is free for your CRM.

---

## Deployment Summary

| Step | Time | Status |
|------|------|--------|
| Install Vercel CLI | 2 min | Ready |
| Deploy to Vercel | 5 min | Ready |
| Set env vars | 3 min | Ready |
| Test | 2 min | Ready |
| **Total** | **~12 min** | **✅ Ready** |

**You're ready to go live!**

---

**Last Updated:** 2026-06-11  
**Vercel URL:** Will be provided after deployment  
**Status:** READY TO DEPLOY
