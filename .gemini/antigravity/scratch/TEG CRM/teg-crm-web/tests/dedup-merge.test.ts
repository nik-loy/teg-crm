import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Notion client so no real API calls are made.
// queryAll calls notion().databases.query via withRetry — we mock withRetry to
// return a controlled response.  This keeps findByUrl/findByName as real code.
vi.mock("../src/lib/notion/client", () => {
  const withRetry = vi.fn();
  const notion = vi.fn(() => ({ databases: { query: vi.fn() } }));
  return { withRetry, notion };
});

import { withRetry } from "../src/lib/notion/client";
import {
  findByUrl,
  findByName,
  resolveMerge,
  filterPatchToSchema,
} from "../src/lib/notion/contacts";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Build a minimal Notion page-like object that pageToContact can parse. */
function makePage(id: string, name: string, linkedinUrl: string) {
  return {
    id,
    object: "page" as const,
    properties: {
      Name: {
        id: "title",
        type: "title",
        title: [{ plain_text: name, text: { content: name } }],
      },
      "LinkedIn URL": {
        id: "url",
        type: "url",
        url: linkedinUrl,
      },
    },
  };
}

/** Stub withRetry to return a fake databases.query response. */
function stubQueryResponse(pages: ReturnType<typeof makePage>[]) {
  vi.mocked(withRetry).mockResolvedValueOnce({
    results: pages,
    has_more: false,
    next_cursor: null,
  });
}

// ------------------------------------------------------------------
// Contact helper (used by resolveMerge tests — no mocking needed)
// ------------------------------------------------------------------

const mockContact = (
  overrides: Partial<{
    id: string;
    name: string;
    linkedinUrl: string;
    jobTitle: string;
    company: string;
    tier: string;
  }>
) => ({
  id: "page-1",
  name: "Anna Müller",
  linkedinUrl: "https://linkedin.com/in/anna",
  jobTitle: "Consultant",
  company: "",
  companyId: undefined,
  tier: "Tier 1",
  pipelineStage: "Awareness",
  outreachStatus: "Request Sent",
  outreachOwner: "Jonas",
  lastContactDate: "2026-06-01",
  followUpDueDate: "",
  followUpOwner: "",
  followUpComplete: false,
  notes: "",
  ...overrides,
});

// ------------------------------------------------------------------
// findByUrl
// ------------------------------------------------------------------

describe("findByUrl", () => {
  beforeEach(() => vi.mocked(withRetry).mockReset());

  it("returns the page id when a contact has the exact LinkedIn URL", async () => {
    stubQueryResponse([makePage("page-1", "Anna Müller", "https://linkedin.com/in/anna")]);
    const result = await findByUrl("https://linkedin.com/in/anna", "db-id");
    expect(result).toBe("page-1");
  });

  it("returns undefined when no contact has that URL", async () => {
    stubQueryResponse([]);
    const result = await findByUrl("https://linkedin.com/in/nobody", "db-id");
    expect(result).toBeUndefined();
  });
});

// ------------------------------------------------------------------
// findByName
// ------------------------------------------------------------------

describe("findByName", () => {
  beforeEach(() => vi.mocked(withRetry).mockReset());

  it("returns page id for case-insensitive name match", async () => {
    stubQueryResponse([makePage("page-1", "Anna Müller", "")]);
    const result = await findByName("anna müller", "db-id");
    expect(result).toBe("page-1");
  });

  it("returns undefined when no name matches", async () => {
    stubQueryResponse([makePage("page-2", "Jonas Böhrer", "")]);
    const result = await findByName("Unknown Person", "db-id");
    expect(result).toBeUndefined();
  });
});

// ------------------------------------------------------------------
// resolveMerge — pure function, no mocks needed
// ------------------------------------------------------------------

describe("resolveMerge", () => {
  it("is non-destructive: keeps existing job title and does not overwrite it", () => {
    const patch = resolveMerge(
      { jobTitle: "New Title", linkedinUrl: "https://linkedin.com/in/anna" },
      mockContact({ jobTitle: "Old Title", linkedinUrl: "" })
    );
    // Existing jobTitle is non-empty → should NOT appear in patch
    expect(patch["Job Title"]).toBeUndefined();
    // Existing linkedinUrl is empty → should be filled
    expect(patch["LinkedIn URL"]).toEqual({ url: "https://linkedin.com/in/anna" });
  });

  it("fills empty company tier when incoming has one", () => {
    const patch = resolveMerge(
      { tier: "Tier 2" },
      mockContact({ tier: "" })
    );
    expect(patch["Tier"]).toEqual({ select: { name: "Tier 2" } });
  });

  it("returns an empty patch when all existing fields are non-empty", () => {
    const patch = resolveMerge(
      { jobTitle: "Ignored", linkedinUrl: "https://linkedin.com/in/anna" },
      mockContact({ jobTitle: "Consultant", linkedinUrl: "https://linkedin.com/in/anna" })
    );
    expect(patch["Job Title"]).toBeUndefined();
    expect(patch["LinkedIn URL"]).toBeUndefined();
    expect(Object.keys(patch)).toHaveLength(0);
  });

  it("fills name when existing name is empty (screenshot merge case)", () => {
    const patch = resolveMerge(
      { name: "Anna Müller" },
      mockContact({ name: "" })
    );
    expect(patch["Name"]).toBeDefined();
  });

  it("fills the crucial Experience and Education fields when empty", () => {
    const patch = resolveMerge(
      {
        experience: "AI Architect · CLOUDPILOTS (Jan 2024 – Present)",
        education: "TUM · M.Sc. (2018 – 2021)",
      },
      mockContact({})
    );
    expect(patch["Experience"]).toBeDefined();
    expect(patch["Education"]).toBeDefined();
  });

  it("fills Profile Summary when empty (gating-bug regression — must not depend on Notes)", () => {
    // Existing has a Note but an empty Profile Summary → summary must still fill.
    const patch = resolveMerge(
      { profileSummary: "HEADLINE: VP Eng" },
      mockContact({ notes: "some earlier note", profileSummary: "" } as Partial<Parameters<typeof resolveMerge>[1]>)
    );
    expect(patch["Profile Summary"]).toBeDefined();
  });

  it("does not overwrite an existing Profile Summary", () => {
    const patch = resolveMerge(
      { profileSummary: "new" },
      mockContact({ profileSummary: "already here" } as Partial<Parameters<typeof resolveMerge>[1]>)
    );
    expect(patch["Profile Summary"]).toBeUndefined();
  });
});

describe("filterPatchToSchema", () => {
  it("keeps properties that exist and drops additive ones that don't", () => {
    const patch = {
      "Job Title": { rich_text: [] },
      "Profile Summary": { rich_text: [] },
      Experience: { rich_text: [] },
      Education: { rich_text: [] },
    };
    const schema = new Set(["Job Title", "Profile Summary"]); // Experience/Education not added yet
    const filtered = filterPatchToSchema(patch, schema);
    expect(filtered["Job Title"]).toBeDefined();
    expect(filtered["Profile Summary"]).toBeDefined();
    expect(filtered["Experience"]).toBeUndefined();
    expect(filtered["Education"]).toBeUndefined();
  });
});
