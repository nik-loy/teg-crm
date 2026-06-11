import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPendingRequestsPrompt } from "./pending-requests-prompt";
import type { PendingRequest, ParseResult } from "./pending-requests-types";

interface RawParsed {
  requests?: Array<{ name?: string; headline?: string; sentDaysAgo?: number }>;
  stats?: Record<string, number>;
}

// ─── Pure text parser (primary — no API calls) ────────────────────────────────

function parseDaysAgo(text: string): number {
  const m = text.match(/(\d+)\s+(day|week|month)s?/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit === "day") return n;
  if (unit === "week") return n * 7;
  if (unit === "month") return n * 30;
  return 0;
}

function isSentLine(line: string): boolean {
  return /^Sent\s+(\d+\s+(day|week|month)s?\s+ago|just\s+now|today)/i.test(line);
}

// Lines that mark a block boundary but are never a name/headline
function isBoundaryLine(line: string): boolean {
  // "Withdraw", "Cancel" buttons; image alt text like "John's profile picture"
  return (
    /^(Withdraw|Cancel|Message|Connect|Follow|Remove|Pending)$/i.test(line) ||
    /profile picture$/i.test(line)
  );
}

/**
 * Anchors on every "Sent X ago" line, then walks backwards to collect
 * [name, ...headlineParts]. Works whether or not "profile picture" alt-text
 * lines are present — real browser copy-paste usually omits them.
 */
export function parseLinkedInText(pastedText: string): ParseResult {
  const lines = pastedText.split("\n").map((l) => l.trim()).filter(Boolean);
  const requests: PendingRequest[] = [];
  const seen = new Set<string>();
  let duplicateDetected = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!isSentLine(lines[i])) continue;

    const sentDaysAgo = parseDaysAgo(lines[i]);

    // Walk backwards from the "Sent" line, collecting candidate lines until
    // we hit another "Sent" line, a boundary line, or exhaust the look-back.
    const candidates: string[] = [];
    for (let j = i - 1; j >= 0 && j >= i - 12; j--) {
      const l = lines[j];
      if (isSentLine(l) || isBoundaryLine(l)) break;
      candidates.unshift(l); // maintain top-to-bottom order
    }

    if (candidates.length === 0) continue;

    const name = candidates[0];
    const headlineParts = candidates.slice(1);

    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicateDetected++;
    } else {
      seen.add(key);
      requests.push({
        name,
        headline: headlineParts.join(" · "),
        sentDaysAgo,
        sentDate: new Date(Date.now() - sentDaysAgo * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        linkedinUrl: undefined,
      });
    }
  }

  return {
    success: requests.length > 0,
    requests,
    errors:
      requests.length === 0
        ? [{ reason: "No pending requests found — paste the full page text from LinkedIn's Sent Invitations tab" }]
        : [],
    stats: { totalLines: lines.length, parsed: requests.length, failed: 0, duplicateDetected },
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
      sentDate: new Date(now.getTime() - (r.sentDaysAgo ?? 0) * 24 * 60 * 60 * 1000)
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

async function parseWithOpenAI(pastedText: string, apiKey: string): Promise<RawParsed> {
  console.log("[pending-requests/openai] Calling gpt-4o-mini...");
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildPendingRequestsPrompt() },
      { role: "user", content: pastedText },
    ],
    temperature: 0,
  });
  const content = resp.choices[0].message.content ?? "{}";
  return JSON.parse(content);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function parsePendingRequests(
  pastedText: string,
  geminiKey: string,
  openaiKey: string
): Promise<ParseResult> {
  const totalLines = pastedText.split("\n").length;

  // 1. Pure text parser — no API call, no rate limits, zero cost
  const textResult = parseLinkedInText(pastedText);
  if (textResult.success) return textResult;

  console.log("[pending-requests/text] 0 results — falling back to AI");

  // 2. Gemini fallback (if text structure was unexpected)
  // 3. OpenAI last resort
  try {
    let parsed: RawParsed | null = null;

    if (geminiKey) {
      parsed = await parseWithGemini(pastedText, geminiKey);
    }
    if (!parsed && openaiKey) {
      parsed = await parseWithOpenAI(pastedText, openaiKey);
    }
    if (!parsed) {
      throw new Error("No AI provider available — set GEMINI_API_KEY or OPENAI_API_KEY");
    }

    return enrichRequests(parsed, totalLines);
  } catch (e) {
    console.error("[pending-requests/parse] Fatal:", e instanceof Error ? e.message : e);
    return {
      success: false,
      requests: [],
      errors: [{ reason: e instanceof Error ? e.message : "AI parsing failed" }],
      stats: { totalLines, parsed: 0, failed: 1, duplicateDetected: 0 },
    };
  }
}
