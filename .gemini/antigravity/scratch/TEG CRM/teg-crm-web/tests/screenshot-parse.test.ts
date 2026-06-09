import { describe, it, expect } from "vitest";
import { parseScreenshotJson } from "../src/lib/extraction/screenshot";

describe("parseScreenshotJson", () => {
  it("parses a raw JSON array string", () => {
    const raw = JSON.stringify([
      { name: "Max Müller", job_title: "Senior Consultant", company: "McKinsey" },
    ]);
    const result = parseScreenshotJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Max Müller");
    expect(result[0].job_title).toBe("Senior Consultant");
    expect(result[0].company).toBe("McKinsey");
  });

  it("strips markdown fences and parses the JSON inside", () => {
    const raw =
      "```json\n[{\"name\":\"Anna Bauer\",\"job_title\":\"CTO\",\"company\":\"Siemens\"}]\n```";
    const result = parseScreenshotJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Anna Bauer");
  });

  it("returns empty array for empty string", () => {
    expect(parseScreenshotJson("")).toEqual([]);
  });

  it("returns empty array for '[]'", () => {
    expect(parseScreenshotJson("[]")).toEqual([]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseScreenshotJson("not json")).toThrow();
  });

  it("throws on non-array JSON", () => {
    expect(() => parseScreenshotJson('{"name":"test"}')).toThrow();
  });

  it("allows empty job_title and company", () => {
    const raw = JSON.stringify([{ name: "John Doe", job_title: "", company: "" }]);
    const result = parseScreenshotJson(raw);
    expect(result[0].job_title).toBe("");
    expect(result[0].company).toBe("");
  });

  it("normalises missing fields to empty strings", () => {
    const raw = JSON.stringify([{ name: "Jane" }]);
    const result = parseScreenshotJson(raw);
    expect(result[0].job_title).toBe("");
    expect(result[0].company).toBe("");
  });
});
