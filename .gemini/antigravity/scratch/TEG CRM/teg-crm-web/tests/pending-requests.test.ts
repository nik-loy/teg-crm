import { describe, it, expect, vi } from "vitest";
import { parsePendingRequests, parseLinkedInText } from "../src/lib/extraction/parse-pending-requests";

// Real browser copy-paste: NO "profile picture" lines (most common case)
const FIXTURE_NO_PICTURE_LINES = `Aliosha Milsztein
Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM
Sent 1 week ago
Withdraw
Elisabeth Neurauter
Director Strategic Accounts at Snowflake | Ex-BCG
Sent 1 week ago
Withdraw`;

// With "profile picture" alt-text lines (some browsers/OS include these)
const FIXTURE_WITH_PICTURE_LINES = `Aliosha Milsztein's profile picture
Aliosha Milsztein
Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM
Sent 1 week ago
Withdraw
Elisabeth Neurauter's profile picture
Elisabeth Neurauter
Director Strategic Accounts at Snowflake | Ex-BCG
Sent 1 week ago
Withdraw`;

// Multi-line headline (no profile picture lines)
const FIXTURE_MULTILINE_HEADLINE = `Max Mustermann
Senior Consultant
McKinsey & Company
München, Germany
Sent 3 days ago
Withdraw`;

// Duplicate names
const FIXTURE_DUPLICATE = `Anna Schmidt
Product Manager at Google
Sent 2 weeks ago
Withdraw
Anna Schmidt
Product Manager at Google
Sent 2 weeks ago
Withdraw`;

// "X ago" WITHOUT "Sent" prefix — LinkedIn sometimes omits it
const FIXTURE_NO_SENT_PREFIX = `Julia Bauer
Senior Product Manager at Microsoft
1 week ago
Withdraw
Thomas Richter
Engineering Manager at Amazon
3 days ago
Withdraw`;

// Hours-ago format (triggers sentDaysAgo = 0)
const FIXTURE_HOURS_AGO = `Lena Hoffman
UX Designer at Figma
2 hours ago
Withdraw`;

// Withdraw-only (no time line at all — edge case)
const FIXTURE_WITHDRAW_ONLY = `Klaus Werner
CEO at TechStartup Munich
Withdraw`;

// German LinkedIn format
const FIXTURE_GERMAN = `Markus Becker
Softwareentwickler bei SAP
Gesendet vor 2 Wochen
Zurückziehen
Sandra Maier
Marketing Manager bei BMW
Vor 5 Tagen
Zurückziehen`;

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    requests: [
                      {
                        name: "Aliosha Milsztein",
                        headline: "Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM",
                        sentDaysAgo: 7,
                      },
                      {
                        name: "Elisabeth Neurauter",
                        headline: "Director Strategic Accounts at Snowflake | Ex-BCG",
                        sentDaysAgo: 7,
                      },
                    ],
                    stats: { totalLines: 8, parsed: 2, failed: 0, duplicateDetected: 0 },
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

// ─── parseLinkedInText — no profile picture lines (real copy-paste) ───────────

describe("parseLinkedInText — no profile picture lines", () => {
  it("parses 2 requests", () => {
    expect(parseLinkedInText(FIXTURE_NO_PICTURE_LINES).requests).toHaveLength(2);
  });

  it("extracts correct names", () => {
    const r = parseLinkedInText(FIXTURE_NO_PICTURE_LINES);
    expect(r.requests[0].name).toBe("Aliosha Milsztein");
    expect(r.requests[1].name).toBe("Elisabeth Neurauter");
  });

  it("extracts single-line headline", () => {
    const r = parseLinkedInText(FIXTURE_NO_PICTURE_LINES);
    expect(r.requests[0].headline).toContain("Personio");
    expect(r.requests[1].headline).toContain("Snowflake");
  });

  it("converts 1 week ago to 7 days", () => {
    const r = parseLinkedInText(FIXTURE_NO_PICTURE_LINES);
    expect(r.requests[0].sentDaysAgo).toBe(7);
  });

  it("sentDate is a YYYY-MM-DD string ~7 days ago", () => {
    const r = parseLinkedInText(FIXTURE_NO_PICTURE_LINES);
    expect(r.requests[0].sentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const diff = (Date.now() - new Date(r.requests[0].sentDate!).getTime()) / 86400000;
    expect(diff).toBeGreaterThanOrEqual(6);
    expect(diff).toBeLessThan(9);
  });

  it("sets success=true", () => {
    expect(parseLinkedInText(FIXTURE_NO_PICTURE_LINES).success).toBe(true);
  });
});

// ─── parseLinkedInText — with profile picture lines (some browsers) ───────────

describe("parseLinkedInText — with profile picture lines", () => {
  it("parses 2 requests", () => {
    expect(parseLinkedInText(FIXTURE_WITH_PICTURE_LINES).requests).toHaveLength(2);
  });

  it("extracts correct names (not the picture line)", () => {
    const r = parseLinkedInText(FIXTURE_WITH_PICTURE_LINES);
    expect(r.requests[0].name).toBe("Aliosha Milsztein");
    expect(r.requests[1].name).toBe("Elisabeth Neurauter");
  });

  it("headline does not include 'profile picture'", () => {
    const r = parseLinkedInText(FIXTURE_WITH_PICTURE_LINES);
    expect(r.requests[0].headline).not.toContain("profile picture");
  });
});

// ─── parseLinkedInText — multi-line headline ──────────────────────────────────

describe("parseLinkedInText — multi-line headline", () => {
  it("joins headline lines with ·", () => {
    const r = parseLinkedInText(FIXTURE_MULTILINE_HEADLINE);
    expect(r.requests[0].headline).toContain("Senior Consultant");
    expect(r.requests[0].headline).toContain("McKinsey");
  });

  it("converts 3 days ago correctly", () => {
    expect(parseLinkedInText(FIXTURE_MULTILINE_HEADLINE).requests[0].sentDaysAgo).toBe(3);
  });
});

// ─── parseLinkedInText — "X ago" without "Sent" prefix ──────────────────────

describe("parseLinkedInText — no 'Sent' prefix", () => {
  it("parses 2 requests from '1 week ago' format", () => {
    expect(parseLinkedInText(FIXTURE_NO_SENT_PREFIX).requests).toHaveLength(2);
  });

  it("extracts correct names", () => {
    const r = parseLinkedInText(FIXTURE_NO_SENT_PREFIX);
    expect(r.requests[0].name).toBe("Julia Bauer");
    expect(r.requests[1].name).toBe("Thomas Richter");
  });

  it("converts 1 week ago to 7 days", () => {
    expect(parseLinkedInText(FIXTURE_NO_SENT_PREFIX).requests[0].sentDaysAgo).toBe(7);
  });

  it("converts 3 days ago correctly", () => {
    expect(parseLinkedInText(FIXTURE_NO_SENT_PREFIX).requests[1].sentDaysAgo).toBe(3);
  });
});

// ─── parseLinkedInText — hours ago ───────────────────────────────────────────

describe("parseLinkedInText — hours ago", () => {
  it("parses entry with '2 hours ago'", () => {
    expect(parseLinkedInText(FIXTURE_HOURS_AGO).requests).toHaveLength(1);
  });

  it("sets sentDaysAgo to 0 for hours", () => {
    expect(parseLinkedInText(FIXTURE_HOURS_AGO).requests[0].sentDaysAgo).toBe(0);
  });

  it("extracts correct name", () => {
    expect(parseLinkedInText(FIXTURE_HOURS_AGO).requests[0].name).toBe("Lena Hoffman");
  });
});

// ─── parseLinkedInText — German LinkedIn ─────────────────────────────────────

describe("parseLinkedInText — German LinkedIn", () => {
  it("parses 2 requests from German format", () => {
    expect(parseLinkedInText(FIXTURE_GERMAN).requests).toHaveLength(2);
  });

  it("extracts correct German names", () => {
    const r = parseLinkedInText(FIXTURE_GERMAN);
    expect(r.requests[0].name).toBe("Markus Becker");
    expect(r.requests[1].name).toBe("Sandra Maier");
  });

  it("converts 'vor 2 Wochen' to 14 days", () => {
    expect(parseLinkedInText(FIXTURE_GERMAN).requests[0].sentDaysAgo).toBe(14);
  });

  it("converts 'Vor 5 Tagen' to 5 days", () => {
    expect(parseLinkedInText(FIXTURE_GERMAN).requests[1].sentDaysAgo).toBe(5);
  });
});

// ─── parseLinkedInText — Withdraw-anchor fallback ────────────────────────────

describe("parseLinkedInText — Withdraw anchor (no time line)", () => {
  it("extracts name when no time line present", () => {
    const r = parseLinkedInText(FIXTURE_WITHDRAW_ONLY);
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0].name).toBe("Klaus Werner");
  });

  it("sets sentDaysAgo to 0 when no time line", () => {
    expect(parseLinkedInText(FIXTURE_WITHDRAW_ONLY).requests[0].sentDaysAgo).toBe(0);
  });
});

// ─── parseLinkedInText — edge cases ──────────────────────────────────────────

describe("parseLinkedInText — edge cases", () => {
  it("deduplicates by name", () => {
    const r = parseLinkedInText(FIXTURE_DUPLICATE);
    expect(r.requests).toHaveLength(1);
    expect(r.stats.duplicateDetected).toBe(1);
  });

  it("returns success=false with helpful error for empty input", () => {
    const r = parseLinkedInText("   ");
    expect(r.success).toBe(false);
    expect(r.errors[0].reason).toMatch(/No pending requests/i);
  });

  it("returns success=false for unstructured text", () => {
    expect(parseLinkedInText("hello world this is not linkedin").success).toBe(false);
  });
});

// ─── parsePendingRequests integration ────────────────────────────────────────

describe("parsePendingRequests", () => {
  it("uses text parser — no API keys needed", async () => {
    const result = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(result.requests).toHaveLength(2);
    expect(result.success).toBe(true);
  });

  it("parses first name correctly", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(r.requests[0].name).toBe("Aliosha Milsztein");
  });

  it("parses second name correctly", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(r.requests[1].name).toBe("Elisabeth Neurauter");
  });

  it("parses first headline correctly", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(r.requests[0].headline).toContain("Personio");
  });

  it("parses second headline correctly", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(r.requests[1].headline).toContain("Snowflake");
  });

  it("converts 1 week ago to 7 days", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(r.requests[0].sentDaysAgo).toBe(7);
  });

  it("calculates ISO sentDate in YYYY-MM-DD format", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(r.requests[0].sentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sentDate is approximately 7 days ago", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    const diff = (Date.now() - new Date(r.requests[0].sentDate!).getTime()) / 86400000;
    expect(diff).toBeGreaterThanOrEqual(6);
    expect(diff).toBeLessThan(9);
  });

  it("sets success=true when requests are found", async () => {
    expect((await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "")).success).toBe(true);
  });

  it("reports correct parsed count in stats", async () => {
    const r = await parsePendingRequests(FIXTURE_NO_PICTURE_LINES, "", "");
    expect(r.stats.parsed).toBe(2);
  });

  it("falls back to OpenAI for unstructured text, returns error on invalid JSON", async () => {
    const { default: OpenAI } = await import("openai");
    const mockInstance = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: "not valid json {{" } }],
          }),
        },
      },
    };
    (OpenAI as ReturnType<typeof vi.fn>).mockImplementationOnce(() => mockInstance);
    const result = await parsePendingRequests("random unstructured text with no linkedin format", "", "test-key");
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
