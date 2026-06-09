import { describe, it, expect } from "vitest";
import { buildExtractionPrompt } from "../src/lib/extraction/prompt";
import { parseExtraction } from "../src/lib/extraction/extract";
import maxResp from "./fixtures/extract-max.json";

describe("buildExtractionPrompt", () => {
  it("instructs to exclude reposts and not hallucinate", () => {
    const p = buildExtractionPrompt();
    expect(p).toMatch(/repost/i);
    expect(p).toMatch(/authored/i);
    expect(p).toMatch(/do not (invent|hallucinate)/i);
    expect(p).toMatch(/JSON/);
  });
});

describe("parseExtraction", () => {
  it("parses a valid LLM JSON response", () => {
    const r = parseExtraction(JSON.stringify(maxResp));
    expect(r.current_company).toContain("CLOUDPILOTS");
    expect(r.about).toBe("");
    expect(r.personalization_signals.join(" ")).toMatch(/Gemini|Agentic/);
  });

  it("strips markdown fences and parses the JSON inside", () => {
    const fenced =
      '```json\n{"name":"X","headline":"","current_title":"","current_company":"","location":"","industry":"","seniority_estimate":"","education":[],"experience":[],"skills":[],"authored_posts":[],"personalization_signals":[],"about":"","excluded_reposts_count":0}\n```';
    expect(parseExtraction(fenced).name).toBe("X");
  });

  it("throws on non-JSON input", () => {
    expect(() => parseExtraction("not json at all")).toThrow();
  });
});
