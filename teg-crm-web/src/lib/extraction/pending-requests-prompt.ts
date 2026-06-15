export function buildPendingRequestsPrompt(): string {
  return `You are parsing LinkedIn "Sent Connection Requests" page text.
Users copy-paste their PENDING OUTGOING connection requests.

STRUCTURE (repeats for each person):
- Name's profile picture
- Name
- Headline (1-5 lines, job title @ company)
- Sent X [days/weeks/months] ago
- Withdraw button
- [Next person]

RULES:
1. Extract ONLY pending requests (ones they SENT, waiting for response)
2. Parse name: skip lines ending in "'s profile picture", take the NEXT line as name
3. Parse headline: all text between name and "Sent"
4. Convert "Sent X [days/weeks/months] ago" to days integer:
   - "Sent 1 week ago" → 7
   - "Sent 2 weeks ago" → 14
   - "Sent 3 days ago" → 3
   - "Sent 1 month ago" → 30
5. NO LinkedIn URLs in pending requests page (linkedinUrl will always be empty)
6. Ignore: "Withdraw", lines ending in "'s profile picture", image alt text
7. Do NOT invent missing fields — use empty string for missing headline
8. Deduplicate by name (same name twice → keep first occurrence)

OUTPUT: valid JSON only, no markdown, no explanation:
{
  "requests": [
    {"name": "Aliosha Milsztein", "headline": "Agentic AI @ Personio | Founding CEO @ aurio", "sentDaysAgo": 7},
    {"name": "Elisabeth Neurauter", "headline": "Director Strategic Accounts at Snowflake | Ex-BCG", "sentDaysAgo": 7}
  ],
  "stats": {"totalLines": 120, "parsed": 20, "failed": 0, "duplicateDetected": 0}
}`;
}
