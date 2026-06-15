import { describe, it, expect } from "vitest";
import { pageToContact } from "../src/lib/notion/map";

const fullPage = {
  id: "abc123",
  url: "https://www.notion.so/abc123",
  properties: {
    Name: { type: "title", title: [{ plain_text: "Anna Müller" }] },
    "LinkedIn URL": { type: "url", url: "https://linkedin.com/in/anna" },
    "Job Title": { type: "rich_text", rich_text: [{ plain_text: "Senior Consultant" }] },
    Company: { type: "relation", relation: [{ id: "company-page-id" }] },
    Tier: { type: "select", select: { name: "Tier 1" } },
    "Pipeline Stage": { type: "select", select: { name: "Engaged" } },
    "LinkedIn Outreach Status": { type: "select", select: { name: "Connected" } },
    "Outreach Owner": { type: "rich_text", rich_text: [{ plain_text: "Jonas Böhrer" }] },
    "Last Contact Date": { type: "date", date: { start: "2026-06-01" } },
    "Follow-Up Due Date": { type: "date", date: { start: "2026-06-10" } },
    "Follow-Up Owner": { type: "people", people: [{ name: "Jonas Böhrer" }] },
    "Follow-Up Complete": { type: "checkbox", checkbox: false },
    Notes: { type: "rich_text", rich_text: [{ plain_text: "Met at ACC 2025" }] },
  },
};

const emptyPage = {
  id: "def456",
  url: "https://www.notion.so/def456",
  properties: {
    Name: { type: "title", title: [] },
    "LinkedIn URL": { type: "url", url: null },
    "Job Title": { type: "rich_text", rich_text: [] },
    Company: { type: "relation", relation: [] },
    Tier: { type: "select", select: null },
    "Pipeline Stage": { type: "select", select: null },
    "LinkedIn Outreach Status": { type: "select", select: null },
    "Outreach Owner": { type: "rich_text", rich_text: [] },
    "Last Contact Date": { type: "date", date: null },
    "Follow-Up Due Date": { type: "date", date: null },
    "Follow-Up Owner": { type: "people", people: [] },
    "Follow-Up Complete": { type: "checkbox", checkbox: false },
    Notes: { type: "rich_text", rich_text: [] },
  },
};

describe("pageToContact", () => {
  it("extracts all fields from a full page", () => {
    const c = pageToContact(fullPage as any);
    expect(c.id).toBe("abc123");
    expect(c.name).toBe("Anna Müller");
    expect(c.linkedinUrl).toBe("https://linkedin.com/in/anna");
    expect(c.jobTitle).toBe("Senior Consultant");
    expect(c.companyId).toBe("company-page-id");
    expect(c.tier).toBe("Tier 1");
    expect(c.pipelineStage).toBe("Engaged");
    expect(c.outreachStatus).toBe("Connected");
    expect(c.outreachOwner).toBe("Jonas Böhrer");
    expect(c.lastContactDate).toBe("2026-06-01");
    expect(c.followUpDueDate).toBe("2026-06-10");
    expect(c.followUpOwner).toBe("Jonas Böhrer");
    expect(c.followUpComplete).toBe(false);
    expect(c.notes).toBe("Met at ACC 2025");
    expect(c.notionUrl).toBe("https://www.notion.so/abc123");
  });

  it("concatenates all rich_text chunks so multi-chunk experience is not truncated", () => {
    const multiChunkPage = {
      id: "multi1",
      url: "https://www.notion.so/multi1",
      properties: {
        Name: { type: "title", title: [{ plain_text: "Test User" }] },
        "LinkedIn URL": { type: "url", url: null },
        "Job Title": { type: "rich_text", rich_text: [] },
        Company: { type: "relation", relation: [] },
        Tier: { type: "select", select: null },
        "Pipeline Stage": { type: "select", select: null },
        "LinkedIn Outreach Status": { type: "select", select: null },
        "Outreach Owner": { type: "rich_text", rich_text: [] },
        "Last Contact Date": { type: "date", date: null },
        "Follow-Up Due Date": { type: "date", date: null },
        "Follow-Up Owner": { type: "people", people: [] },
        "Follow-Up Complete": { type: "checkbox", checkbox: false },
        Notes: { type: "rich_text", rich_text: [] },
        // Experience split across two 2000-char chunks (simulating a 10-job career history)
        Experience: {
          type: "rich_text",
          rich_text: [
            { plain_text: "Partner · McKinsey (Jan 2020 – Present) [current]\n" },
            { plain_text: "Manager · BCG (Jun 2016 – Dec 2019)" },
          ],
        },
      },
    };
    const c = pageToContact(multiChunkPage as any);
    // Must contain BOTH chunks — not truncated at chunk 1
    expect(c.experience).toContain("McKinsey");
    expect(c.experience).toContain("BCG");
  });

  it("returns empty strings (not undefined) for missing optional fields", () => {
    const c = pageToContact(emptyPage as any);
    expect(c.id).toBe("def456");
    expect(c.name).toBe("");
    expect(c.linkedinUrl).toBe("");
    expect(c.jobTitle).toBe("");
    expect(c.companyId).toBeUndefined();
    expect(c.tier).toBe("");
    expect(c.pipelineStage).toBe("");
    expect(c.outreachStatus).toBe("");
    expect(c.outreachOwner).toBe("");
    expect(c.lastContactDate).toBe("");
    expect(c.followUpDueDate).toBe("");
    expect(c.followUpOwner).toBe("");
    expect(c.followUpComplete).toBe(false);
    expect(c.notes).toBe("");
  });
});
