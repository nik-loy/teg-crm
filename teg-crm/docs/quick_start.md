# TEG CRM — Quick Start: Outreach Workflow

This guide covers the two commands you will use every day for LinkedIn outreach.  
Everything is typed into the terminal (PowerShell) from the `teg-crm` folder.

---

## Before you start — navigate to the folder

Every time you open a new terminal, run this first:

```
cd "C:\Users\nikla\.gemini\antigravity\scratch\TEG CRM\teg-crm"
```

---

## The two-step workflow

```
Step 1  →  Log the contact to Notion
Step 2  →  Generate the outreach message
```

You always do Step 1 first. Step 2 will not work if the person is not in Notion yet.

---

## Step 1 — Log a contact

**Where does the URL come from?**  
Open the person's LinkedIn profile in your browser. Copy the URL from the address bar.  
It will look like: `https://www.linkedin.com/in/firstname-lastname-abc123/`

**Minimum command (name will be asked interactively):**

```
python -m src.linkedin.contact_logger --url https://www.linkedin.com/in/firstname-lastname
```

After pressing Enter, the terminal will ask:
```
Contact name:
```
Type the person's name and press Enter. Done — the contact is now in Notion.

---

**Full command (everything in one line, nothing asked interactively):**

```
python -m src.linkedin.contact_logger --url https://www.linkedin.com/in/anna-mueller-123 --name "Anna Müller" --title "Senior Consultant" --owner "Niklas Loycke"
```

**What each part means:**

| Part | What to put there |
|---|---|
| `--url` | The LinkedIn URL from the browser address bar — **required** |
| `--name` | Full name as shown on LinkedIn — optional, will be asked if omitted |
| `--title` | Their job title — optional |
| `--tier` | `"Tier 1"`, `"Tier 2"`, or `"Tier 3"` — optional, defaults to Tier 3 |
| `--owner` | Your name, so it is logged against you — optional |
| `--notes` | Any free-text notes — optional |

**Success looks like:**
```
✓ Created: Anna Müller
  https://www.notion.so/Anna-Mueller-abc123...
```
The printed link opens directly to the new contact page in Notion.

**If the contact already exists:**
```
! Contact already exists (page: abc-123-...)
```
No duplicate is created. You can proceed to Step 2.

---

### Logging that you sent a connection request (not yet accepted)

If you just sent the request and they have not accepted yet:

```
python -m src.linkedin.contact_logger --url https://www.linkedin.com/in/anna-mueller-123 --name "Anna Müller" --title "Senior Consultant" --status request_sent --owner "Niklas Loycke"
```

### Marking a request as accepted (they connected back)

Once they accept your LinkedIn connection:

```
python -m src.linkedin.contact_logger --url https://www.linkedin.com/in/anna-mueller-123 --accept
```

This finds the existing contact and updates their status to "Connected" — no other fields change.

---

## Step 2 — Generate the outreach message

**You need:** the same LinkedIn URL you used in Step 1.

```
python -m src.linkedin.message_gen --url  https://www.linkedin.com/in/jonas-boehrer/ --owner "Niklas Loycke"
```

Replace `"Niklas Loycke"` with your own name — this sets the correct invite link UTM tag.

---

**What happens after you press Enter:**

**1.** The script finds Anna in Notion and shows her name and current status.

**2.** You are prompted:
```
Paste everything visible on their LinkedIn profile.
Recommended order:
  1. Name + Headline
  2. About / Bio section
  3. Experience — all entries
  4. Education
  5. Skills (if visible)
  6. Recent posts (highest-value for personalisation)
Press Enter twice when done.
```

Go to LinkedIn, scroll through the profile, **select all visible text and copy it** (Ctrl+A on the profile page does not work — select manually from top to bottom). Paste it into the terminal with Ctrl+V. Press Enter on a blank line to finish.

**3.** The script outputs the AI analysis:
```
──────────────────────────────────────────────────────────
**Fit-Rating:** 4/5
Starker AI-Strategy Fokus bei McKinsey, thematisch sehr nah.
**Senioritäts-Check:**
Senior Consultant — unbedenklich, kein Warning.
**Template:** Intern
Person arbeitet bei einer Firma mit bestätigtem Speaker.
**Ansprache:** Du
Lockerer LinkedIn-Auftritt, unter Manager-Level.
**Nachricht:**
Hey Anna, danke fürs Vernetzen! Hab gesehen, dass du viel mit AI Strategy arbeitest.
Wir machen am 10.6. in München die AI Consulting Conference, auch mit jemandem von
McKinsey. Könnte gut passen, falls du reinschauen willst: luma.com/... VG Finn
──────────────────────────────────────────────────────────
Characters: 387 / 500  (✓ within limit)
```

**4.** Pre-flight checklist is shown, then:
```
Log to Notion and mark as Messaged? [y/n]:
```
- Type `y` → logs the interaction, updates Last Contact Date, marks status as "Messaged"
- Type `n` → nothing is written to Notion

**5.** Copy the message from the `**Nachricht:**` section and send it on LinkedIn.

---

### Fit-Rating — when to proceed

| Rating | Meaning | Action |
|---|---|---|
| 5 | Perfect fit | Always send |
| 4 | Very good | Always send |
| 3 | Decent fit | Use judgement |
| 2 | Weak fit | Probably skip |
| 1 | No fit | Do not send |

If the rating is below 3, the script will not offer to log it — it exits automatically.

---

### If you get a seniority warning

```
⚠ Achtung: sehr senior. Executive Access (€200) wäre vermutlich das passendere Ticket.
```

This means the contact is at Partner / Director / VP / C-Level level at a firm where we have risk-tier rules. You can still send the message, but consider whether the standard ticket pitch is appropriate.

---

## Step 3 (optional) — Handle a reply

When someone replies positively ("Klingt spannend", "Interessiert mich", etc.):

```
python -m src.linkedin.message_gen --url https://www.linkedin.com/in/anna-mueller-123 --owner "Niklas Loycke" --mode follow-up --reply "Klingt spannend, danke!"
```

The script generates a short warm reply (1–3 sentences). If the reply sounds positive, it will also ask:
```
Mark contact as Engaged? (Pipeline Stage: Awareness → Engaged) [y/n]:
```

---

## Common errors and fixes

**`error: the following arguments are required: --url`**  
→ You ran the command without a LinkedIn URL. Add `--url https://linkedin.com/in/...` after the command name.

**`Error: No contact found for this LinkedIn URL`** (during message_gen)  
→ The person is not in Notion yet. Run Step 1 first.

**`! Contact already exists`** (during contact_logger)  
→ Not an error — just a notice. The contact is already there. Go straight to Step 2.

**`Missing required env vars`**  
→ You are not in the right folder. Run `cd "C:\Users\nikla\.gemini\antigravity\scratch\TEG CRM\teg-crm"` first.

---

## Full real-world example (copy and adapt)

```
# You connected with Laura Schneider at BCG, Senior Associate, AI focus

# Step 1 — log her
python -m src.linkedin.contact_logger --url https://www.linkedin.com/in/laura-schneider-bcg --name "Laura Schneider" --title "Senior Associate" --status connected --owner "Niklas Loycke"

# Step 2 — generate the message
python -m src.linkedin.message_gen --url https://www.linkedin.com/in/laura-schneider-bcg --owner "Niklas Loycke"
# → paste her profile when prompted, press Enter on blank line
# → review the message, type y to log it

# Later — she replies "Klingt interessant!"
python -m src.linkedin.message_gen --url https://www.linkedin.com/in/laura-schneider-bcg --owner "Niklas Loycke" --mode follow-up --reply "Klingt interessant!"
```

---

## Where does all this show up in Notion?

| What you did | Where to find it in Notion |
|---|---|
| Logged a contact | **Contacts** database — new row with their name |
| Marked as Messaged | Same row — "LinkedIn Outreach Status" field updated |
| Logged an interaction | **Interactions** database — new row linked to the contact |
| Marked as Engaged | Same contact row — "Pipeline Stage" updated |

You can open any contact in Notion at any time and edit fields manually — the scripts will pick up changes on the next run.
