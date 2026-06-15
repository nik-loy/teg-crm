import type { Connection, ConnectionParseResult, MessageParseResult } from "./connections-types";

// ─── Date helpers ──────────────────────────────────────────────────────────────

const DE_MONTHS: Record<string, string> = {
  januar: "January", februar: "February", "märz": "March",
  april: "April", mai: "May", juni: "June",
  juli: "July", august: "August", september: "September",
  oktober: "October", november: "November", dezember: "December",
};

/**
 * Returns true for the per-person "connected on" anchor line, in either
 * LinkedIn UI language:
 *   EN: "Connected on June 12, 2026"
 *   DE: "Am 12. Juni 2026 vernetzt"   ← current German LinkedIn phrasing
 *   DE: "Verbunden am 12. Juni 2026" / "Kontakt seit 12. Juni 2026"  ← older variants
 */
export function isConnectedOnLine(line: string): boolean {
  if (/^Connected on [A-Z][a-z]+ \d{1,2},?\s+\d{4}$/i.test(line)) return true;
  if (/^Am\s+\d{1,2}\.\s+\S+\s+\d{4}\s+vernetzt$/i.test(line)) return true;
  if (/^(Verbunden am|Kontakt seit)\s+\d{1,2}\.\s+\S+\s+\d{4}/i.test(line)) return true;
  return false;
}

/**
 * Format a Date as "YYYY-MM-DD" using its LOCAL calendar components.
 * Never use `.toISOString()` here: a date-only value parsed as local midnight
 * shifts to the previous day in UTC for any positive-offset timezone (the whole
 * Munich team is UTC+2 in summer), which would save every connection one day early.
 */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseConnectedOnDate(line: string): string {
  const engMatch = line.match(/Connected on (.+)$/i);
  if (engMatch) {
    const parsed = new Date(engMatch[1]);
    if (!isNaN(parsed.getTime())) return formatLocalDate(parsed);
  }
  // German — pull day / month-name / year from any supported phrasing:
  //   "Am 12. Juni 2026 vernetzt" · "Verbunden am 12. Juni 2026" · "Kontakt seit 12. Juni 2026"
  const deMatch =
    line.match(/^Am\s+(\d{1,2})\.\s+(\S+)\s+(\d{4})\s+vernetzt/i) ??
    line.match(/(?:Verbunden am|Kontakt seit)\s+(\d{1,2})\.\s+(\S+)\s+(\d{4})/i);
  if (deMatch) {
    const [, day, monthDe, year] = deMatch;
    const monthEn = DE_MONTHS[monthDe.toLowerCase()];
    if (monthEn) {
      const parsed = new Date(`${monthEn} ${day}, ${year}`);
      if (!isNaN(parsed.getTime())) return formatLocalDate(parsed);
    }
  }
  return formatLocalDate(new Date());
}

// ─── Boundary detection ────────────────────────────────────────────────────────

function isBoundaryLine(line: string): boolean {
  // Action buttons that appear after the "Connected on" line
  if (/^(Message|Nachricht|Follow|Remove|Block|Report|Withdraw|Connect)$/i.test(line)) return true;
  // Profile picture alt-text (EN + DE)
  if (/profile picture$/i.test(line)) return true; // "Max's profile picture"
  if (/profilbild$/i.test(line)) return true;      // "Max Mustermanns Profilbild" / "… Weberpals' Profilbild"
  if (/^profilbild von /i.test(line)) return true; // "Profilbild von Max, offen für Jobangebote" (open-to-work)
  return false;
}

// ─── Extraction ────────────────────────────────────────────────────────────────

export function parseLinkedInConnections(pastedText: string): ConnectionParseResult {
  const lines = pastedText.split("\n").map((l) => l.trim()).filter(Boolean);
  const connections: Connection[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!isConnectedOnLine(lines[i])) continue;

    const connectedOn = parseConnectedOnDate(lines[i]);

    // Walk backwards from the "Connected on" line to collect name + headline
    const candidates: string[] = [];
    for (let j = i - 1; j >= 0 && j >= i - 12; j--) {
      const l = lines[j];
      // Stop at a previous entry's "Connected on" line or a button boundary
      if (isConnectedOnLine(l) || isBoundaryLine(l)) break;
      candidates.unshift(l);
    }
    if (candidates.length === 0) continue;

    // Drop any remaining profile-picture alt-text lines
    const filtered = candidates.filter((l) => !/profile picture|profilbild/i.test(l));
    if (filtered.length === 0) continue;

    const name = filtered[0];
    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    connections.push({
      name,
      headline: filtered.slice(1).join(" · "),
      connectedOn,
      linkedinUrl: undefined,
    });
  }

  if (connections.length === 0) {
    return {
      success: false,
      connections: [],
      errors: [
        {
          reason:
            "No connections found — paste the full page text from your LinkedIn Connections list.",
        },
      ],
      stats: { totalLines: lines.length, parsed: 0, failed: 0, duplicateDetected: duplicates },
    };
  }

  return {
    success: true,
    connections,
    errors: [],
    stats: {
      totalLines: lines.length,
      parsed: connections.length,
      failed: 0,
      duplicateDetected: duplicates,
    },
  };
}

// ─── LinkedIn Messages tab parser ─────────────────────────────────────────────
// Extracts contact names from text pasted from the LinkedIn Messaging tab.
// Works for both English and German LinkedIn UI.

function isMsgOptionsLine(line: string): boolean {
  // EN: "Open the options list in your conversation with X and Y"
  if (/^Open the options list in your conversation with .+/i.test(line)) return true;
  // DE: "Liste der Optionen in Ihrer Unterhaltung mit X und Y öffnen"
  if (/^Liste der Optionen in Ihrer Unterhaltung mit .+ öffnen$/i.test(line)) return true;
  return false;
}

function isMsgNavLine(line: string): boolean {
  // Accessibility nav lines always start with ". "
  return line.startsWith(". ");
}

function isMsgTimestampLine(line: string): boolean {
  if (/^\d{1,2}:\d{2}$/.test(line)) return true; // "10:16", "12:16"
  if (/^[A-Za-zÄäÖöÜüß]{2,9} \d{1,2}$/.test(line)) return true; // "Jun 8", "Dez 3"
  return false;
}

function isMsgPreviewLine(line: string): boolean {
  // Message preview: "You: …", "Sie: …", "Name: …" (word up to 25 chars + ": ")
  if (/^[A-Za-zÄäÖöÜüß]{1,25}:\s/.test(line)) return true;
  if (/^(Sponsored|Anzeige)\b/i.test(line)) return true;
  return false;
}

function isMsgUiChrome(line: string): boolean {
  return /^(Nachrichten|Jobs Ungelesen|Neue Nachricht|Zu den Informationen|Liste der Unterhaltungen|Hinweis zur Verwendung|Messaging|Search messages|New message|Compose new message|Als Favorit|Ungelesen|InMail\b)/i.test(line);
}

function cleanMsgName(raw: string): string {
  return raw
    // ", #HIRINGStatus is reachable"
    .replace(/,\s*(#\w+)?Status is \w+[\w.]*\s*$/i, "")
    // "TyagiStatus is reachable" (directly concatenated, no separator)
    .replace(/([A-Za-zÄäÖöÜüßÀ-ÿ])Status is \w+[\w.]*\s*$/i, "$1")
    // " Status is reachable" (space-separated)
    .replace(/\s+Status is \w+[\w.]*\s*$/i, "")
    .trim();
}

function looksLikeMsgName(line: string): boolean {
  if (line.length < 3 || line.length > 80) return false;
  if (!line.includes(" ")) return false; // must be at least two words
  if (line.includes(": ")) return false; // message preview marker
  if (!(/^[A-Za-zÄäÖöÜüßÀ-ÿ"'(]/.test(line))) return false; // must start with a letter
  if (isMsgOptionsLine(line) || isMsgNavLine(line)) return false;
  if (isMsgTimestampLine(line) || isMsgPreviewLine(line)) return false;
  if (isMsgUiChrome(line)) return false;
  return true;
}

export function parseLinkedInMessages(pastedText: string): MessageParseResult {
  const lines = pastedText.split("\n").map((l) => l.trim()).filter(Boolean);
  const names: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!isMsgOptionsLine(lines[i])) continue;

    // Walk backward from the options anchor to find the contact's name.
    // Skip nav, timestamps, message previews, and UI chrome.
    for (let j = i - 1; j >= 0 && j >= i - 20; j--) {
      const l = lines[j];

      if (isMsgOptionsLine(l)) break; // reached previous conversation

      if (
        isMsgNavLine(l) ||
        isMsgTimestampLine(l) ||
        isMsgPreviewLine(l) ||
        isMsgUiChrome(l) ||
        l.length > 200
      ) {
        continue;
      }

      const cleaned = cleanMsgName(l);
      if (looksLikeMsgName(cleaned)) {
        const key = cleaned.toLowerCase();
        if (seen.has(key)) {
          duplicates++;
        } else {
          seen.add(key);
          names.push(cleaned);
        }
        break;
      }
    }
  }

  if (names.length === 0) {
    return {
      success: false,
      names: [],
      errors: [
        {
          reason:
            "No names found — paste the full page text from your LinkedIn Messages tab (Ctrl+A to select all, then copy). Make sure the copied text includes the navigation lines below each conversation.",
        },
      ],
      stats: { totalLines: lines.length, parsed: 0, failed: 0, duplicateDetected: duplicates },
    };
  }

  return {
    success: true,
    names,
    errors: [],
    stats: {
      totalLines: lines.length,
      parsed: names.length,
      failed: 0,
      duplicateDetected: duplicates,
    },
  };
}
