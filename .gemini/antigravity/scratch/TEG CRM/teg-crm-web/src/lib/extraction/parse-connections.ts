import type { Connection, ConnectionParseResult } from "./connections-types";

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
