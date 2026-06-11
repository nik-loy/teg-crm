import { describe, it, expect, vi } from "vitest";
import { parsePendingRequests, parseLinkedInText } from "../src/lib/extraction/parse-pending-requests";

const FIXTURE_TWO = `Aliosha Milsztein's profile picture
Aliosha Milsztein
Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM
Sent 1 week ago
Withdraw
Elisabeth Neurauter's profile picture
Elisabeth Neurauter
Director Strategic Accounts at Snowflake | Ex-BCG
Sent 1 week ago
Withdraw`;

const FIXTURE_MULTILINE_HEADLINE = `Max Mustermann's profile picture
Max Mustermann
Senior Consultant
McKinsey & Company
München, Germany
Sent 3 days ago
Withdraw`;

const FIXTURE_DUPLICATE = `Anna Schmidt's profile picture
Anna Schmidt
Product Manager at Google
Sent 2 weeks ago
Withdraw
Anna Schmidt's profile picture
Anna Schmidt
Product Manager at Google
Sent 2 weeks ago
Withdraw`;

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
                        headline:
                          "Agentic AI @ Personio I Founding CEO @ aurio (acq. by Personio) I CDTM",
                        sentDaysAgo: 7,
                      },
                      {
                        name: "Elisabeth Neurauter",
                        headline: "Director Strategic Accounts at Snowflake | Ex-BCG",
                        sentDaysAgo: 7,
                      },
                    ],
                    stats: { totalLines: 10, parsed: 2, failed: 0, duplicateDetected: 0 },
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

// ─── parseLinkedInText (pure text parser) ─────────────────────────────────────

describe("parseLinkedInText", () => {
  it("parses 2 requests from fixture", () => {
    const r = parseLinkedInText(FIXTURE_TWO);
    expect(r.requests).toHaveLength(2);
    expect(r.success).toBe(true);
  });

  it("extracts correct names", () => {
    const r = parseLinkedInText(FIXTURE_TWO);
    expect(r.requests[0].name).toBe("Aliosha Milsztein");
    expect(r.requests[1].name).toBe("Elisabeth Neurauter");
  });

  it("extracts single-line headline correctly", () => {
    const r = parseLinkedInText(FIXTURE_TWO);
    expect(r.requests[0].headline).toContain("Personio");
    expect(r.requests[1].headline).toContain("Snowflake");
  });

  it("joins multi-line headlines with ·", () => {
    const r = parseLinkedInText(FIXTURE_MULTILINE_HEADLINE);
    expect(r.requests[0].headline).toContain("Senior Consultant");
    expect(r.requests[0].headline).toContain("McKinsey");
  });

  it("converts 1 week ago to 7 days", () => {
    const r = parseLinkedInText(FIXTURE_TWO);
    expect(r.requests[0].sentDaysAgo).toBe(7);
  });

  it("converts 3 days ago correctly", () => {
    const r = parseLinkedInText(FIXTURE_MULTILINE_HEADLINE);
    expect(r.requests[0].sentDaysAgo).toBe(3);
  });

  it("sentDate is a YYYY-MM-DD string", () => {
    const r = parseLinkedInText(FIXTURE_TWO);
    expect(r.requests[0].sentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

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
    const r = parseLinkedInText("hello world this is not linkedin");
    expect(r.success).toBe(false);
  });
});

// ─── parsePendingRequests (integration) ──────────────────────────────────────

describe("parsePendingRequests", () => {
  it("returns correct request count via text parser (no API needed)", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.requests).toHaveLength(2);
  });

  it("parses first name correctly", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.requests[0].name).toBe("Aliosha Milsztein");
  });

  it("parses second name correctly", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.requests[1].name).toBe("Elisabeth Neurauter");
  });

  it("parses first headline correctly", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.requests[0].headline).toContain("Personio");
  });

  it("parses second headline correctly", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.requests[1].headline).toContain("Snowflake");
  });

  it("converts 1 week ago to 7 days", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.requests[0].sentDaysAgo).toBe(7);
  });

  it("calculates ISO sentDate in YYYY-MM-DD format", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.requests[0].sentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sentDate is approximately 7 days ago", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    const sentDate = new Date(result.requests[0].sentDate!);
    const diffDays = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThan(9);
  });

  it("sets success=true when requests are found", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.success).toBe(true);
  });

  it("reports correct parsed count in stats", async () => {
    const result = await parsePendingRequests(FIXTURE_TWO, "", "");
    expect(result.stats.parsed).toBe(2);
  });

  it("falls back to OpenAI when text is unstructured and returns error on invalid JSON", async () => {
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
    // Text parser returns 0 results → falls back to mocked OpenAI which returns garbage
    const result = await parsePendingRequests("random unstructured text with no linkedin format", "", "test-key");
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
