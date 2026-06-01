# Notion Setup Guide

This guide walks through creating the two Notion databases and all views the system needs. Complete this BEFORE running the app — the app will crash if the databases don't exist or property names don't match exactly.

---

## Step 1 — Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it: `TEG Idea Workflow`
4. Set capabilities: Read content, Update content, Insert content
5. Copy the **Internal Integration Secret** → this is your `NOTION_API_KEY`

---

## Step 2 — Create the Ideas Database

1. In your Notion workspace, create a new full-page database
2. Name it: `TEG Ideas`
3. Add the following properties (**names must match EXACTLY, including capitalisation and spaces**):

| Property Name | Type | Options / Notes |
|--------------|------|-----------------|
| `Name` | Title | (already exists by default) |
| `Submitter Name` | Text | — |
| `Submitter Email` | Email | — |
| `Submitter Department` | Select | Add options: Strategy, Operations, Marketing, Sales, Administration and Finance, IT |
| `Submission Type` | Select | Add options: Club Initiative, Inter-dept Request |
| `Category` | Select | Add options: Event, Campaign, Internal Process, Partnership, Tool Request, Design Request, Content Request, Logistics Request, Data/IT Request, Finance Request, Other |
| `Description` | Text | — |
| `Goal` | Text | — |
| `Success Criteria` | Text | — |
| `Departments Needed` | Multi-select | Add SAME options as Submitter Department |
| `Responsible Department` | Select | Add SAME options as Submitter Department |
| `Proposed Timeline` | Date | — |
| `Priority` | Select | Add options: Low, Medium, High, Critical |
| `Inspiration References` | Text | — |
| `Proposed Owner` | Text | — |
| `Risks Concerns` | Text | — |
| `Dependencies` | Text | — |
| `Status` | Select | Add options: Draft, Awaiting Strategy Review, Strategy Approved, Strategy Rejected, Routing, Partially Acknowledged, Fully Acknowledged, Returned to Strategy, Completed |
| `Strategy Notes` | Text | — |
| `Submitted At` | Date | — |
| `Last Processed At` | Date | — |
| `Leantime Ticket IDs` | Text | — |

4. Copy the database ID from the URL:
   - URL looks like: `https://notion.so/yourworkspace/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
   - The `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` part is your `NOTION_IDEAS_DB_ID`

---

## Step 3 — Create the Department Responses Database

1. Create a new full-page database
2. Name it: `TEG Department Responses`
3. Add the following properties:

| Property Name | Type | Options / Notes |
|--------------|------|-----------------|
| `Name` | Title | (already exists) |
| `Idea` | Relation | → link to **TEG Ideas** database |
| `Department` | Select | Add options: Strategy, Operations, Marketing, Sales, Administration and Finance, IT |
| `Department Lead Email` | Email | — |
| `Status` | Select | Add options: Pending, Accepted, Declined, Pushed Back |
| `Decline Reason` | Text | — |
| `Dept Notes` | Text | — |
| `Response Date` | Date | — |
| `Processed At` | Date | — |
| `Leantime Ticket ID` | Text | — |
| `Reminder Count` | Number | Default: 0 |
| `Last Reminder At` | Date | — |

4. Copy this database ID → this is your `NOTION_DEPT_RESPONSES_DB_ID`

---

## Step 4 — Share Databases with the Integration

Both databases must be shared with your Notion integration:

1. Open **TEG Ideas** database
2. Click the `•••` menu (top right) → Connections → Connect to → select `TEG Idea Workflow`
3. Repeat for **TEG Department Responses**

If the integration can't see a database, you'll get a 404 error from the Notion API.

---

## Step 5 — Create the Submission Form (Notion Form)

1. Open **TEG Ideas** database
2. Click `+ New view` → select **Form**
3. Name the view: `Submit an Idea`
4. Configure form fields:
   - **Show** (required): Name, Submitter Name, Submitter Email, Submitter Department, Submission Type, Category, Description, Goal, Success Criteria, Departments Needed, Responsible Department, Proposed Timeline, Priority
   - **Show** (optional, mark as not required): Inspiration References, Proposed Owner, Risks Concerns, Dependencies
   - **Hide** (filled by system): Status, Strategy Notes, Submitted At, Last Processed At, Leantime Ticket IDs
5. Add field descriptions to help submitters:
   - `Submission Type`: "Select Club Initiative for new ideas for the whole club. Select Inter-dept Request if you need something done by another department."
   - `Responsible Department` (only for Inter-dept): "Which department will do the work? Your own department will automatically be tagged as dependent."
   - `Departments Needed` (only for Club Initiative): "Which departments need to be involved in this idea?"
   - `Success Criteria`: "How will we know this worked? Be as specific as possible."
6. Set `Status` field **default value**: `Draft`
7. Share the form link with all club members

---

## Step 6 — Create Inbox Views

### Strategy Inbox (for the Strategy Head)

1. Open **TEG Ideas** database
2. Add a new view: **Table** → name it `Strategy Inbox`
3. Filter: `Status` is `Awaiting Strategy Review` OR `Returned to Strategy`
4. Sort: `Submitted At` ascending (oldest first)
5. Show properties: Name, Submission Type, Submitter Name, Submitter Department, Priority, Submitted At, Status, Strategy Notes
6. Share this view link with the Strategy Head (bookmark it)

### Per-Department Inbox Views (for each department)

Repeat for each of the 6 departments:

1. Open **TEG Department Responses** database
2. Add a new view: **Gallery** → name it `[Dept Name] Inbox`
3. Filter: `Department` is `[Dept Name]` AND `Status` is `Pending`
4. Gallery card preview: show `Dept Notes`, `Idea` (relation)
5. Share this view link with the relevant dept team (bookmark in their Notion space)

> **Important:** Department team members can browse and read all cards. Only the team lead should change the `Status` field (by convention — Notion doesn't enforce this at property level). The team lead changes Status to `Accepted` or `Declined` and fills in notes if declining.

---

## Step 7 — Verify Setup

After filling in your `.env.local`, run:

```bash
npm run dev
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

Then submit a test idea via the Notion form with Status defaulting to "Draft" and wait up to 5 minutes (or trigger the cron manually). The Strategy Head should receive an email.

---

## Property Name Reference

If you ever need to rename a Notion property, update the constant in `src/lib/notion.ts` at the top of the file — that is the only place property names are defined in code.

```typescript
// src/lib/notion.ts — property name constants
export const IDEA_PROPS = {
  TITLE: 'Name',
  SUBMITTER_NAME: 'Submitter Name',
  SUBMITTER_EMAIL: 'Submitter Email',
  // ...
}
```
