# TEG Idea Workflow — How It Works
**For: Strategy & Operations | Version: June 2026**

---

## What Problem Does This Solve?

Before this system existed, ideas at TEG e.V. moved through an informal chain. Someone had an idea, they messaged the right person on WhatsApp or brought it up in a meeting, and from there it either got picked up or quietly died. There was no record, no accountability for who was supposed to respond, no visibility for the person who submitted the idea, and no automatic way to create tasks in Leantime once something was approved.

This workflow automation solves four concrete problems:

1. **Ideas no longer fall through the cracks.** Every submission is tracked. If someone does not act on it within 48 hours, they get a reminder — automatically.

2. **The submitter always knows where their idea stands.** They receive emails at each stage and a progress update whenever a reminder cycle runs.

3. **Approved work lands in Leantime automatically.** Once a department accepts an assignment, a properly formatted ticket is created in their Leantime project without anyone having to copy-paste anything.

4. **Work in Leantime stays visible in Notion.** Every Sunday the system checks on all active Leantime tickets and writes a status update back into Notion. If nothing is moving, it sends alerts — and escalates if the issue persists for a second week.

---

## The Core Concept: Notion Is the Only Interface

No one interacts with this system through a web portal, login screen, or custom app. **The only thing anyone touches is Notion.**

- Club members submit ideas through a Notion form.
- The Strategy Head reviews and decides inside the Ideas database.
- Department leads respond to assignments inside the Department Responses database.

Every 5 minutes, an automated process (running in the background, invisible to users) checks Notion for anything new or changed, and reacts accordingly — sending emails, creating Leantime tickets, setting reminders. Every Sunday morning, a second process checks all open Leantime tickets and writes progress summaries back into the idea rows in Notion. The automation is a silent engine; the human experience is entirely in Notion.

---

## The Two Workflow Paths

Every submission belongs to one of two types. This is set by the submitter when they fill in the form.

---

### Path A — Club Initiative

> *"I have a new idea that TEG as a whole should pursue. It needs multiple departments to make it happen."*

**Examples:** organising a new annual event, launching a sponsorship campaign, building a new internal process, introducing a new tool.

```
Club Member submits form
        │
        ▼
[AUTOMATED] Status → "Awaiting Strategy Review"
           Email sent to Strategy Head:
           "New idea pending your review: [title]"
        │
        ▼
Strategy Head opens idea in Notion
Reviews it, reads the description, goal, success criteria.
Has two options:

    ┌───────────────────────────┐     ┌─────────────────────────────────┐
    │  Sets Status:             │     │  Sets Status:                   │
    │  "Strategy Approved"      │     │  "Strategy Rejected"            │
    │  (can add Strategy Notes) │     │  (must add Strategy Notes       │
    │                           │     │   explaining the reason)        │
    └────────────┬──────────────┘     └───────────────┬─────────────────┘
                 │                                    │
                 ▼                                    ▼
  [AUTOMATED] For each department           [AUTOMATED] Email to submitter:
  listed in "Departments Needed":           "Update on your idea: [title]"
  - Creates a response row                  Contains the Strategy Notes
  - Status → "Routing"                      as the rejection reason.
  - Emails that dept's team lead:
    "New assignment for [dept]: [title]"
                 │
                 ▼
  Each dept lead opens their inbox in Notion.
  Reads the idea. Has two options:

    ┌────────────────────────┐     ┌──────────────────────────────────────┐
    │ Sets Status:           │     │ Sets Status: "Declined"              │
    │ "Accepted"             │     │ Must fill in "Decline Reason"        │
    └──────────┬─────────────┘     └──────────────────┬───────────────────┘
               │                                      │
               ▼                                      ▼
  [AUTOMATED] Leantime ticket          [AUTOMATED] Idea Status →
  created in that dept's               "Returned to Strategy"
  Leantime project.                    Email to Strategy Head:
                                       "[dept] declined — review needed"
               │                      Strategy Head re-evaluates.
               ▼                      Cycle repeats.
  When ALL departments have accepted:
  Idea Status → "Fully Acknowledged"
  Weekly Sunday sync begins tracking Leantime progress.
```

---

### Path B — Inter-department Request

> *"I need another department to do something for my department. It is not a club-wide initiative — it is a direct request."*

**Examples:** Marketing needs IT to set up a new email account. Sales needs Marketing to design a pitch deck. Operations needs Finance to approve a budget for a supplier.

The key difference from Path A: **Strategy does not act as a gatekeeper.** The request goes directly to the responsible department, and Strategy only receives a courtesy notification.

```
Club Member submits form
Selects "Inter-dept Request"
Selects the "Responsible Department" (who does the work)
        │
        ▼
[AUTOMATED] Status → "Routing"
  SIMULTANEOUSLY sends two emails:
  ┌───────────────────────────────────┐  ┌──────────────────────────────────┐
  │ To Responsible Dept lead:         │  │ To Strategy Head (FYI only):     │
  │ "New request assigned to          │  │ "FYI: Inter-dept request         │
  │  [dept]: [title]"                 │  │  in progress: [title]"           │
  │ Action required — they must       │  │ No action needed — information   │
  │ respond in Notion.                │  │ only. Strategy can add notes      │
  └─────────────────┬─────────────────┘  │ at any time but is not blocking. │
                    │                    └──────────────────────────────────┘
                    ▼
  Responsible dept lead opens their inbox in Notion.
  Has two options:

    ┌─────────────────────────┐     ┌───────────────────────────────────────┐
    │ Sets Status: "Accepted" │     │ Sets Status: "Pushed Back"            │
    └───────────┬─────────────┘     │ Must fill in "Decline Reason"         │
                │                  │ and "Dept Notes" (revised terms, etc) │
                │                  └──────────────────────┬────────────────┘
                │                                         │
                ▼                                         ▼
  [AUTOMATED] Leantime ticket            [AUTOMATED] Two emails sent:
  created in responsible dept's          1. To Strategy Head (FYI):
  project. Ticket tags BOTH                 "[dept] pushed back: [title]"
  responsible dept AND submitter's       2. To BOTH the submitter AND
  dept.                                     their own dept head:
                                            "Your request needs attention"
  Idea Status →                             Includes the pushback reason
  "Fully Acknowledged"                      and dept notes.
  Weekly Sunday sync begins.                          │
                                                       ▼
                                         Submitter or their dept head
                                         sets the response to "Accepted"
                                         in Notion (first to act is enough).
                                                       │
                                                       ▼
                                         [AUTOMATED] Leantime ticket created.
                                         Idea Status → "Fully Acknowledged"
                                         Weekly Sunday sync begins.
```

---

## The Reminder System

No one is expected to watch their email constantly. But if an idea gets stuck because someone has not acted, the system sends reminders automatically.

| Situation | Reminder sent to | After how long |
|-----------|-----------------|----------------|
| Strategy has not reviewed the idea | Strategy Head | 48 hours |
| A dept lead has not responded to their assignment | That dept lead | 48 hours |
| Any reminder is sent to a responsible party | The original submitter also receives a "still in progress" update | At the same time |

The reminder count is tracked per item. If repeated reminders go unanswered, the count is visible in Notion so it can be escalated manually.

---

## Weekly Progress Updates from Leantime

Once Leantime tickets have been created for an idea, the workflow does not go silent. Every **Sunday at 9am**, the system checks on every active idea that has Leantime tickets, reads the current status of each ticket, and writes the result back into Notion.

### What gets updated in Notion

Each active idea row in the Ideas database receives:

- **Leantime Summary** — a human-readable line showing the status of each department's ticket (e.g. `Done ✅: Marketing · In Progress 🟡: Operations · New 🔵: IT`)
- **Leantime Last Synced** — the date of the most recent Sunday check

This means the Strategy team can open any active idea in Notion and instantly see whether work is progressing — without logging into Leantime.

### Completion detection

The system automatically detects when an idea is fully done. If all Leantime tickets for an idea have been marked as Done or Archived, the idea's status in Notion is set to **Completed** and emails are sent to the original submitter and the Strategy Head.

Alternatively, a department lead can tick the **Mark Complete** checkbox directly on the Notion idea row at any point — this forces the idea into Completed status regardless of Leantime state. This is the right option for larger, multi-month initiatives where work finishes in phases or where some tickets are intentionally left open as documentation.

### Staleness alerts

If a Sunday check finds that no ticket has changed status compared to the previous week, the system treats this as a stall and sends alerts in two stages:

| Week | What happens |
|------|-------------|
| **Week 1 — no progress** | The team lead of each stalled department receives an email: *"Action needed: no progress on your Leantime ticket for [title]"*. The Notion summary shows a ⚠️ warning. |
| **Week 2 — still no progress** | The Strategy Head and the original submitter are both emailed: *"Escalation: [title] has had no Leantime activity for 2 weeks"*. The Notion summary shows a 🚨 escalation flag. |
| **Week 3+ — fully escalated** | No further automated emails. The escalation note remains visible in Notion. Human intervention is needed at this point. |

If progress resumes at any point (even one ticket changes status), the staleness counter resets to zero and the alerts stop.

### Completed Ideas view

A dedicated **Completed Ideas** view in the Ideas database shows all ideas that have reached Completed status, sorted by completion date. This is the club's archive of implemented ideas.

---

## What Each Role Does (Human Actions Only)

### Club Member (any department)
1. Fill in the Notion submission form.
2. Receive confirmation emails as the idea moves through stages.
3. If a pushback occurs (Inter-dept only), review the reason and accept revised terms in Notion if appropriate.

### Strategy Head
1. Open the **Strategy Inbox** view in Notion (bookmarked link).
2. Read incoming ideas.
3. Set the Status to **Strategy Approved** or **Strategy Rejected**.
4. If rejecting: fill in **Strategy Notes** (these are sent to the submitter).
5. If a Club Initiative dept declines: review the situation, adjust scope if needed, re-approve.
6. Receive FYI emails on all Inter-dept Requests (no action required).
7. Receive staleness escalation emails if a department's Leantime ticket has had no activity for 2 consecutive weeks.
8. Receive a completion email when any idea's work is fully done.

### Department Team Lead
1. Open the **[Your Dept] Inbox** view in Notion (bookmarked link — Gallery view).
2. Review incoming assignment cards.
3. Discuss with your team if needed.
4. Set the Status to **Accepted** or **Declined** (Club Initiative) / **Accepted** or **Pushed Back** (Inter-dept).
5. If declining or pushing back: fill in **Decline Reason** and optionally **Dept Notes**. The system will not process the response if this field is empty.
6. Once work is underway in Leantime: keep your ticket status up to date. The Sunday sync reads these statuses — an unchanged status for two weeks triggers an alert email to you.
7. If your idea is fully done before all tickets are marked complete in Leantime: tick **Mark Complete** on the Notion idea row.

---

## What Happens in Leantime

When a department accepts an assignment, a Leantime ticket is created automatically in their project. The ticket:

- Has the title format: `[TEG] [Idea Title]`
- Contains the full idea description, goal, success criteria
- Contains the Strategy Head's notes (if any were added)
- Contains a direct link back to the Notion idea page
- Is due on the Proposed Timeline date from the submission form (or today if none was set)
- For Inter-dept Requests: also states "Requested by: [submitter's department]" so context is preserved

Once the ticket is created, the Leantime ticket ID is written back into the Notion row, so you can navigate directly from Notion to the Leantime ticket.

**After creation:** Every Sunday the system reads the current status of each ticket and updates the Leantime Summary field on the Notion idea row. The Strategy team and department leads never need to check Leantime directly to know whether work is progressing — Notion shows the live picture.

---

## Email Reference: Every Email the System Can Send

| # | Trigger | Sent To | Subject Line |
|---|---------|---------|-------------|
| 1 | New idea submitted | Strategy Head | New idea pending your review: [title] |
| 2 | Strategy approves a Club Initiative | Each involved dept lead | New assignment for [dept]: [title] |
| 3 | Strategy approves an Inter-dept Request | Responsible dept lead | New request assigned to [dept]: [title] |
| 4 | Strategy approves an Inter-dept Request | Strategy Head (FYI) | FYI: Inter-dept request in progress: [title] |
| 5 | Strategy rejects any idea | Submitter | Update on your idea: [title] |
| 6 | A dept declines a Club Initiative | Strategy Head | [dept] declined assignment — review needed: [title] |
| 7 | A dept pushes back on Inter-dept Request | Strategy Head (FYI) | FYI: [dept] pushed back on request: [title] |
| 8 | A dept pushes back on Inter-dept Request | Submitter + submitter's dept head | Your request needs your attention: [title] |
| 9 | Reminder cycle (48h without action) | Whoever is blocking | Reminder: action required on [title] |
| 10 | Any reminder cycle | Submitter | Your idea is still in progress: [title] |
| 11 | Sunday sync — no Leantime progress for 1 week | Each stalled dept lead | Action needed: no progress on your Leantime ticket for [title] |
| 12 | Sunday sync — no Leantime progress for 2 weeks | Strategy Head + submitter | Escalation: [title] has had no Leantime activity for 2 weeks |
| 13 | All Leantime tickets done, or Mark Complete checked | Submitter + Strategy Head (FYI) | Your idea is complete: [title] |

Every email includes:
- The idea title, submission type, and current status
- A description excerpt
- Strategy Notes (if any have been added)
- A direct "Open in Notion" button linking to the relevant page
- A clear instruction for what the recipient should do next

---

## Status Lifecycle of an Idea

The Status field in Notion is the source of truth for where an idea is in the process. The system sets some statuses automatically; humans set others.

| Status | Set by | Meaning |
|--------|--------|---------|
| **Draft** | Notion form (default) | Just submitted, not yet picked up |
| **Awaiting Strategy Review** | System | Picked up, email sent to Strategy |
| **Strategy Approved** | Strategy Head (human) | Strategy approved — system will route next cycle |
| **Strategy Rejected** | Strategy Head (human) | Strategy rejected — submitter notified |
| **Routing** | System | Department assignments created, routing emails sent |
| **Partially Acknowledged** | System | Some but not all depts have accepted |
| **Fully Acknowledged** | System | All depts accepted, all Leantime tickets created — Sunday sync active |
| **Returned to Strategy** | System | A dept declined (Club Initiative path) |
| **Completed** | System (all tickets done) or human (Mark Complete checkbox) | Work is finished — idea moves to Completed Ideas archive |

---

## Why Notion and Not a Custom App?

This is a deliberate design choice. A custom app would require:
- A login system for every TEG member
- A database to host
- Ongoing maintenance as the club's membership and structure changes
- Training for every new member

Notion is already used across TEG. Everyone has access. Department inboxes are just filtered views of a database. The submission form is a Notion form. Adding a new department is a one-line change in a configuration file — no database migrations, no UI updates.

The automation layer (running every 5 minutes on free infrastructure, plus a Sunday morning check) is invisible to users. It reads Notion, reacts to changes, and writes results back. From the perspective of any club member, the process is: "I fill in a form, I get emails, things happen."

---

## The Automated Schedules at a Glance

### Every 5 minutes

Checks Notion for anything new or changed and processes it in order:

1. **New drafts** — Any idea with Status "Draft" is picked up. Submitted At is recorded. Status moves to "Awaiting Strategy Review". Email goes to Strategy Head.

2. **Strategy decisions** — Any idea Strategy has approved or rejected (but not yet processed) is routed. Dept response rows are created in Notion. Routing emails go out.

3. **Dept responses** — Any dept response that has been set to Accepted, Declined, or Pushed Back (but not yet processed) triggers the appropriate action: Leantime ticket creation, status updates, notification emails.

4. **Reminders** — Stale items (no action in 48 hours) generate reminder emails. Reminder count is incremented.

This ordering is intentional: drafts become visible to Strategy before Strategy decisions are processed, and Strategy decisions create dept response rows before dept responses are checked. This avoids any timing conflicts within a single run.

### Every Sunday at 9am

Checks all active ideas (Status is Routing, Partially Acknowledged, or Fully Acknowledged) that have Leantime ticket IDs. For each one:

1. Reads the current status of every associated Leantime ticket
2. Compares it to the status from the previous Sunday
3. Writes a human-readable Leantime Summary back into the Notion idea row
4. Marks as Completed and notifies the submitter if all tickets are done
5. Sends staleness alerts if nothing has changed

---

## What the System Does Not Do

It is equally important to be clear about what is out of scope:

- It does **not** enforce approval hierarchies beyond the Strategy gate (Path A) or the responsible dept gate (Path B). There is no multi-level sign-off.
- It does **not** replace judgement on escalation. After the two-week escalation email, further action is a human decision.
- It does **not** prevent duplicate submissions. That is a social/process issue.
- It does **not** create tasks automatically inside Leantime beyond the initial ticket. Subtasks, milestones, and internal organisation within Leantime are managed by the department.

---

## For the Operations Team Specifically

When this system is live, the Operations team will interact with it in the following ways:

**Receiving a Club Initiative assignment:**
You will get an email: *"New assignment for Operations: [title]"*. The email contains a summary of the idea and a button linking to your Notion inbox. In Notion, you review the card and set the Status field to Accepted or Declined.

**Receiving an Inter-dept Request:**
Same as above, but the request comes from a specific person in another department. The email identifies who submitted the request and why. If you accept, a Leantime ticket is created in the Operations project automatically. If you push back, the submitter will be notified and can accept the revised terms.

**Keeping your Leantime tickets up to date:**
Once your ticket is active, updating the status in Leantime is all that is needed. Every Sunday the system reads those statuses and surfaces a summary in the Notion idea row — visible to you, the submitter, and the Strategy team. If a ticket shows no change for two consecutive Sundays, you will receive an automated prompt to update it or flag a blocker.

**Your Notion inbox:**
The Operations inbox is a filtered Gallery view in the Department Responses database showing only rows where Department = Operations and Status = Pending. Bookmark this link — it is your to-do list for incoming ideas and requests.

**You will never need to:**
- Create Leantime tickets manually for incoming approved ideas
- Notify the submitter yourself
- Manually update the idea's status in the Ideas database (the system handles that)
- Log into Leantime just to check progress — Notion shows the current state every Sunday

---

## Summary: The Single-Page View

```
SUBMIT          → Notion form → Draft entry created

PICK UP         → Every 5 min → System detects Draft
                               → "Awaiting Strategy Review" + email to Strategy

STRATEGY GATE   → Human: Strategy Head sets Approved or Rejected in Notion
(Path A only)     Rejected → email to submitter with reason, workflow ends
                  Approved → system routes to departments

ROUTING         → System creates one response row per dept (Path A: all needed depts)
                          or one response row for responsible dept (Path B)
                → Emails go to dept leads + Strategy FYI (Path B)

DEPT RESPONSE   → Human: dept lead sets Accepted, Declined, or Pushed Back in Notion
                  Accepted → Leantime ticket created, ticket ID written back to Notion
                  Declined (Path A) → Returned to Strategy, Strategy notified
                  Pushed Back (Path B) → Submitter + their dept head notified

ACTIVE          → Idea Status: "Fully Acknowledged" — all tickets exist in Leantime
                → Every Sunday: system reads Leantime ticket statuses
                               → Writes progress summary into Notion
                               → Week 1 no progress: alerts dept lead(s)
                               → Week 2 no progress: escalates to Strategy + submitter

COMPLETION      → All tickets Done/Archived in Leantime → System sets "Completed"
                               OR human ticks Mark Complete in Notion
                → Email to submitter + Strategy Head
                → Idea moves to "Completed Ideas" view in Notion
```

---

*Built by Niklas Loycke for TEG e.V., June 2026.*
*Technical questions: see the project repository and CLAUDE.md for implementation details.*
