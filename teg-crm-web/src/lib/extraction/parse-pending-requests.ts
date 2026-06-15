import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPendingRequestsPrompt } from "./pending-requests-prompt";
import type { PendingRequest, ParseResult } from "./pending-requests-types";

interface RawParsed {
  requests?: Array<{ name?: string; headline?: string; sentDaysAgo?: number }>;
  stats?: Record<string, number>;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function parseDaysAgo(text: string): number {
  // English: handles seconds/minutes/hours → same day (0)
  const eng = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?/i);
  if (eng) {
    const n = parseInt(eng[1], 10);
    const unit = eng[2].toLowerCase();
    if (["second", "minute", "hour"].includes(unit)) return 0;
    if (unit === "day") return n;
    if (unit === "week") return n * 7;
    if (unit === "month") return n * 30;
    if (unit === "year") return n * 365;
  }
  // German: Sekunden/Minuten/Stunden → same day
  const deu = text.match(/(\d+)\s+(Sekunde|Minute|Stunde|Tag|Woche|Monat|Jahr)/i);
  if (deu) {
    const n = parseInt(deu[1], 10);
    const unit = deu[2].toLowerCase();
    if (["sekunde", "minute", "stunde"].includes(unit)) return 0;
    if (unit === "tag") return n;
    if (unit === "woche") return n * 7;
    if (unit === "monat") return n * 30;
    if (unit === "jahr") return n * 365;
  }
  if (/yesterday|gestern/i.test(text)) return 1;
  return 0;
}

/**
 * Matches the "time since sent" line in various LinkedIn UI formats:
 *   English : "Sent 1 week ago", "2 hours ago", "just now", "yesterday"
 *   German  : "Gesendet vor 1 Woche", "Vor 2 Tagen", "gestern"
 */
function isTimeLine(line: string): boolean {
  // "Sent X unit ago" | "X unit ago" | "just now" | "today" | "yesterday"
  if (
    /^(Sent\s+)?(\d+\s+(second|minute|hour|day|week|month|year)s?\s+ago|just\s+now|today|yesterday)$/i.test(
      line
    )
  )
    return true;
  // German: "Gesendet vor 1 Woche", "Vor 3 Tagen", "heute", "gestern"
  // Use \w* to absorb plural suffixes (Wochen, Tagen, Monaten, Jahren, …)
  if (
    /^(Gesendet\s+)?(Vor\s+\d+\s+(Sekunde|Minute|Stunde|Tag|Woche|Monat|Jahr)\w*|heute|gestern)/i.test(
      line
    )
  )
    return true;
  // LinkedIn sometimes shows abbreviated: "1w", "2mo", "3d" — unlikely in copy-paste but safe to handle
  if (/^\d+(s|m|h|d|w|mo)$/.test(line)) return true;
  return false;
}

// ─── Boundary/button lines ────────────────────────────────────────────────────

function isWithdrawLine(line: string): boolean {
  return /^(Withdraw|Zurückziehen|Anfrage\s+zurückziehen)$/i.test(line);
}

function isBoundaryLine(line: string): boolean {
  // English button labels
  if (/^(Withdraw|Cancel|Message|Connect|Follow|Remove|Pending)$/i.test(line)) return true;
  // German button labels
  if (
    /^(Zurückziehen|Anfrage\s+zurückziehen|Abbrechen|Nachricht|Verbinden|Folgen|Entfernen|Ausstehend)$/i.test(
      line
    )
  )
    return true;
  // Image alt-text included by some browsers
  if (/profile picture$/i.test(line)) return true;
  if (/profilbild$/i.test(line)) return true;
  return false;
}

// ─── Strategy 1: anchor on time-line ("Sent 1 week ago", "2 hours ago", …) ───

function extractByTimeLine(
  lines: string[],
  seen: Set<string>
): { requests: PendingRequest[]; duplicates: number } {
  const requests: PendingRequest[] = [];
  let duplicates = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!isTimeLine(lines[i])) continue;
    const sentDaysAgo = parseDaysAgo(lines[i]);

    // Walk backwards collecting name + headline candidates
    const candidates: string[] = [];
    for (let j = i - 1; j >= 0 && j >= i - 12; j--) {
      const l = lines[j];
      if (isTimeLine(l) || isBoundaryLine(l)) break;
      candidates.unshift(l);
    }
    if (candidates.length === 0) continue;

    const filtered = candidates.filter((l) => !/profile picture|profilbild/i.test(l));
    if (filtered.length === 0) continue;

    const name = filtered[0];
    const key = name.toLowerCase();
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    requests.push({
      name,
      headline: filtered.slice(1).join(" · "),
      sentDaysAgo,
      sentDate: new Date(Date.now() - sentDaysAgo * 86400000).toISOString().split("T")[0],
      linkedinUrl: undefined,
    });
  }

  return { requests, duplicates };
}

// ─── Strategy 2: anchor on "Withdraw" button ──────────────────────────────────

function extractByWithdraw(
  lines: string[],
  seen: Set<string>
): { requests: PendingRequest[]; duplicates: number } {
  const requests: PendingRequest[] = [];
  let duplicates = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!isWithdrawLine(lines[i])) continue;

    // Look for a time-line in the 6 lines above Withdraw
    let timeIdx = -1;
    let sentDaysAgo = 0;
    for (let j = i - 1; j >= 0 && j >= i - 6; j--) {
      if (isTimeLine(lines[j])) {
        timeIdx = j;
        sentDaysAgo = parseDaysAgo(lines[j]);
        break;
      }
    }

    // Collect name + headline above the time-line (or directly above Withdraw if no time line)
    const aboveLine = timeIdx !== -1 ? timeIdx - 1 : i - 1;
    const candidates: string[] = [];
    for (let j = aboveLine; j >= 0 && j >= aboveLine - 10; j--) {
      const l = lines[j];
      if (isWithdrawLine(l) || isTimeLine(l) || isBoundaryLine(l)) break;
      candidates.unshift(l);
    }
    if (candidates.length === 0) continue;

    const filtered = candidates.filter((l) => !/profile picture|profilbild/i.test(l));
    if (filtered.length === 0) continue;

    const name = filtered[0];
    const key = name.toLowerCase();
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    requests.push({
      name,
      headline: filtered.slice(1).join(" · "),
      sentDaysAgo,
      sentDate: new Date(Date.now() - sentDaysAgo * 86400000).toISOString().split("T")[0],
      linkedinUrl: undefined,
    });
  }

  return { requests, duplicates };
}

// ─── Public pure-text entry point ─────────────────────────────────────────────

export function parseLinkedInText(pastedText: string): ParseResult {
  const lines = pastedText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Strategy 1: anchor on time-line ("Sent 1 week ago", "2 hours ago", "vor 3 Tagen", …)
  const seen1 = new Set<string>();
  const s1 = extractByTimeLine(lines, seen1);
  if (s1.requests.length > 0) {
    return {
      success: true,
      requests: s1.requests,
      errors: [],
      stats: { totalLines: lines.length, parsed: s1.requests.length, failed: 0, duplicateDetected: s1.duplicates },
    };
  }

  // Strategy 2: anchor on "Withdraw" button (handles formats where time line is absent/unrecognised)
  const seen2 = new Set<string>();
  const s2 = extractByWithdraw(lines, seen2);
  if (s2.requests.length > 0) {
    return {
      success: true,
      requests: s2.requests,
      errors: [],
      stats: { totalLines: lines.length, parsed: s2.requests.length, failed: 0, duplicateDetected: s2.duplicates },
    };
  }

  return {
    success: false,
    requests: [],
    errors: [
      {
        reason:
          "No pending requests found — paste the full page text from LinkedIn's Sent Invitations tab",
      },
    ],
    stats: { totalLines: lines.length, parsed: 0, failed: 0, duplicateDetected: 0 },
  };
}

// ─── AI fallbacks (only used if text parser returns 0 results) ────────────────

function cleanJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const inner = trimmed.split("```")[1] ?? "";
    return inner.replace(/^json\n?/i, "").trim();
  }
  return trimmed;
}

function enrichRequests(raw: RawParsed, totalLines: number): ParseResult {
  const now = new Date();
  const requests: PendingRequest[] = (raw.requests ?? [])
    .filter((r) => r.name?.trim())
    .map((r) => ({
      name: r.name!.trim(),
      headline: r.headline?.trim() ?? "",
      sentDaysAgo: r.sentDaysAgo ?? 0,
      sentDate: new Date(now.getTime() - (r.sentDaysAgo ?? 0) * 86400000)
        .toISOString()
        .split("T")[0],
      linkedinUrl: undefined,
    }));

  return {
    success: requests.length > 0,
    requests,
    errors: [],
    stats: {
      totalLines,
      parsed: requests.length,
      failed: raw.stats?.failed ?? 0,
      duplicateDetected: raw.stats?.duplicateDetected ?? 0,
    },
  };
}

async function parseWithGemini(pastedText: string, apiKey: string): Promise<RawParsed | null> {
  try {
    console.log("[pending-requests/gemini] Calling gemini-2.0-flash...");
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                buildPendingRequestsPrompt() +
                "\n\n---\n\nParse this LinkedIn pending requests text:\n\n" +
                pastedText,
            },
          ],
        },
      ],
    });
    const raw = response.response.text();
    console.log("[pending-requests/gemini] Raw:", raw.slice(0, 200));
    const parsed = JSON.parse(cleanJsonText(raw));
    console.log("[pending-requests/gemini] Parsed", parsed.requests?.length ?? 0, "requests");
    return parsed;
  } catch (e) {
    console.error("[pending-requests/gemini] Error:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export interface ParseOptions {
  /** Gemini API key. Only used when `allowAiFallback` is true. */
  geminiKey?: string;
  /**
   * Opt-in to the Gemini fallback for inputs the pure-text parser cannot handle.
   * OFF by default — the parser never makes a network call or incurs any cost
   * unless this is explicitly enabled (env: PENDING_REQUESTS_AI_FALLBACK=1).
   * NOTE: there is intentionally NO OpenAI path — it was removed to guarantee
   * zero paid-API usage (the source of the previous 429 quota errors).
   */
  allowAiFallback?: boolean;
}

export async function parsePendingRequests(
  pastedText: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { geminiKey = "", allowAiFallback = false } = options;

  // 1. Pure text parser — no API call, no rate limits, zero cost. This is the default.
  const textResult = parseLinkedInText(pastedText);
  if (textResult.success) return textResult;

  // 2. Optional Gemini fallback — disabled unless explicitly opted in AND a key exists.
  //    Free-tier Gemini only; can still be rate-limited, so it degrades gracefully
  //    back to the helpful text-parser message rather than surfacing an API error.
  if (allowAiFallback && geminiKey) {
    console.log("[pending-requests/text] 0 results — AI fallback enabled, trying Gemini");
    const parsed = await parseWithGemini(pastedText, geminiKey);
    if (parsed) {
      const enriched = enrichRequests(parsed, pastedText.split("\n").length);
      if (enriched.success) return enriched;
    }
    console.log("[pending-requests/gemini] no usable result — returning text-parser message");
  }

  // 3. Default outcome when nothing was found: the cost-free, helpful message from the
  //    text parser ("paste the full Sent page…"). Never an API/quota error.
  return textResult;
}
