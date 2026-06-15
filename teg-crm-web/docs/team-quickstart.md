# TEG CRM — Team Quickstart

Everything the sales team needs to use the CRM web app.

---

## Getting in

**App URL:** *(fill in after Vercel deploy, e.g. `https://teg-crm.vercel.app`)*

**Password:** *(share via team chat — do not put here)*

Open the URL in any browser, type the password, and you're in. The session stays active for 30 days.

---

## Installing the bookmarklet (do this once)

The bookmarklet lets you log a LinkedIn contact in 2 seconds while on their profile.

1. Open the app and go to **Add Contact** → click **"Install Bookmarklet"** at the top.
2. On that page, drag the **＋TEG** button to your browser's bookmarks bar.
3. Done. Now when you're on any LinkedIn profile, click **＋TEG** in your bookmarks bar — the app opens pre-filled with the URL and name.

> **Phone:** Bookmarks work on Chrome mobile too. Add it to your mobile bookmarks the same way.

---

## Your daily loop

### 1. Check Today

Open the app → **Today**. Use the dropdown to filter to your name.

You'll see action buckets:
- **Replies Needed** — someone replied; draft a follow-up
- **Follow-Ups Due** — a follow-up is overdue in Notion
- **Stale Requests** — request sent >5 days ago with no update
- **Message Now** — connected but not yet messaged

Click the button next to a contact to go to their message screen.

### 2. Log new contacts

**From LinkedIn (desktop):**
1. Go to their LinkedIn profile → click **＋TEG** bookmarklet → name and URL pre-fill.
2. Optionally paste their full profile text (headline + about + experience) into "Paste LinkedIn profile text" to auto-fill fields.
3. Set Tier (1 = C-level, 2 = VP/Director, 3 = Manager/Other) and Status.
4. Click **Add to Notion**.

**From a connection request you sent (screenshots):**
1. Open the app → **Screenshots**.
2. Take a screenshot of your LinkedIn "Sent Invitations" page and drop it there.
3. Review the extracted names and titles.
4. Click **Create contacts** to add them all at once.

### 3. Write an outreach message

1. In the app → **Messages** → search for the contact by name.
2. Optionally paste their LinkedIn profile text in the box at the top for more personalisation.
3. The AI generates **3 message variants** on different angles (e.g. their posts, their role, the event format).
4. Pick the one you like, edit it in the text box, copy it, then paste and send on LinkedIn manually.
5. Click **Mark as messaged + log** to record it in Notion.

> The app never sends messages directly — you always paste and send yourself (no LinkedIn ban risk).

### 4. Handle a reply

When someone replies on LinkedIn:

1. Go to **Messages** → search for the contact.
2. Scroll to the bottom of the message screen → **Follow-up** panel.
3. Paste their reply text.
4. Click **Draft reply** → get a short, warm response.
5. Copy and send on LinkedIn.
6. Click **Log follow-up** to record it.
7. If the reply sounds positive (e.g. "klingt spannend"), a **Mark as Engaged** button appears — click it to promote their pipeline stage.

---

## Moving contacts through the pipeline

**Pipeline board** (drag and drop): drag a card to a new column. A confirmation dialog prevents accidents.

**Contacts table** (inline edit): click any row → side panel opens → change Stage, Tier, or Status directly from the table.

---

## Phone workflow (pending requests)

Best done on your phone after sending a batch of LinkedIn requests:

1. Take a screenshot of your "Sent Invitations" page.
2. Open the app in Chrome on your phone → **Screenshots**.
3. Upload the screenshot → review the extracted names → **Create contacts**.
4. Done — they appear in Notion with "Request Sent" status.

Fill in their LinkedIn URL later once they accept the request (find them in **Contacts**, click their row, edit).

---

## Tips

- **Filter Today to your name** using the dropdown — each sales team member has their own queue.
- **Tier 1** contacts get the most personalised messages. Paste their full LinkedIn profile for best results.
- **Bookmarklet fails?** Some company SSO browsers block bookmarklets. Use the Add Contact page directly.
- **Message variants differ** — if none feels right, click **Regenerate**.
- **Already a contact?** The app deduplicates by LinkedIn URL — adding a duplicate just enriches empty fields.

---

## If something breaks

Check that all env vars are set in Vercel (Notion token, DB IDs, OpenAI key). Reach out to the tech lead.
