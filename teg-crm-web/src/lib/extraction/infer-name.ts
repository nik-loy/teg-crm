/**
 * Deterministic name guess from a pasted LinkedIn profile.
 *
 * When you copy a LinkedIn profile the name is, essentially always, the first
 * substantive line (the headline follows on line 2, location on line 3).  This
 * heuristic gives us a name WITHOUT depending on the LLM, so we can:
 *   (a) cross-check the LLM's `name` (disagreement ⇒ lower confidence), and
 *   (b) still match a contact if the LLM call fails or returns junk.
 */

const NOISE_LINES = new Set([
  "message", "connect", "more", "follow", "following", "pending", "withdraw",
  "view profile", "open to", "add profile section", "enhance profile",
  "1st", "2nd", "3rd", "·",
]);

const SECTION_HEADERS = new Set([
  "experience", "education", "skills", "activity", "about", "featured",
  "licenses & certifications", "licenses and certifications", "projects",
  "volunteering", "languages", "interests", "recommendations", "courses",
  "honors & awards", "publications", "highlights",
]);

export function inferNameFromPaste(text: string): string {
  if (!text) return "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    if (NOISE_LINES.has(lower)) continue;
    if (SECTION_HEADERS.has(lower)) continue;
    if (/\d/.test(line)) continue;          // follower counts, dates, "500+ connections"
    if (line.includes("@") || line.includes("|")) continue; // headline, not a name
    if (line.length > 60) continue;          // headlines/sentences, not names
    if (line.split(/\s+/).length > 5) continue;

    return line;
  }
  return "";
}
