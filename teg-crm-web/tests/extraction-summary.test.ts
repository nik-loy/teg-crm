import { describe, it, expect } from "vitest";
import {
  renderExperience,
  renderEducation,
  renderSummary,
  toProfileFields,
} from "../src/lib/extraction/summary";
import { parseExtraction } from "../src/lib/extraction/extract";
import maxResp from "./fixtures/extract-max.json";

const max = parseExtraction(JSON.stringify(maxResp));

describe("renderExperience", () => {
  it("renders EVERY role with company and dates (crucial — no role dropped)", () => {
    const out = renderExperience(max.experience);
    const lines = out.split("\n");
    expect(lines).toHaveLength(3);
    expect(out).toContain("AI Solutions Architect · CLOUDPILOTS");
    expect(out).toContain("Cloud Consultant · CLOUDPILOTS");
    expect(out).toContain("Working Student – IT Infrastructure · MAN Truck & Bus");
    expect(out).toContain("Jan 2024 – Present");
    expect(out).toContain("Sep 2020 – Feb 2022");
  });

  it("marks current role with [current] and leaves past roles unmarked", () => {
    const out = renderExperience(max.experience);
    expect(out).toContain("AI Solutions Architect · CLOUDPILOTS (Jan 2024 – Present) [current]");
    expect(out).not.toContain("Cloud Consultant · CLOUDPILOTS (Mar 2022 – Dec 2023) [current]");
    expect(out).not.toContain("MAN Truck & Bus (Sep 2020 – Feb 2022) [current]");
  });
});

describe("renderEducation", () => {
  it("renders EVERY school with degree and years (crucial — no entry dropped)", () => {
    const out = renderEducation(max.education);
    expect(out.split("\n")).toHaveLength(2);
    expect(out).toContain("Technical University of Munich (TUM)");
    expect(out).toContain("Master of Science – Information Systems");
    expect(out).toContain("Ludwig Maximilian University of Munich (LMU)");
    expect(out).toContain("2015 – 2018");
  });
});

describe("renderSummary (lossless mirror)", () => {
  const summary = renderSummary(max);

  it("includes the full experience and education history", () => {
    for (const company of ["CLOUDPILOTS", "MAN Truck & Bus"]) {
      expect(summary).toContain(company);
    }
    for (const school of ["TUM", "LMU"]) {
      expect(summary).toContain(school);
    }
  });

  it("includes headline, location, skills and signals", () => {
    expect(summary).toContain("AI Solutions Architect");
    expect(summary).toContain("Munich, Bavaria, Germany");
    expect(summary).toContain("Vertex AI");
    expect(summary).toContain("Agentic AI");
  });

  it("omits empty sections (no ABOUT label when about is empty)", () => {
    expect(summary).not.toContain("ABOUT:");
  });
});

describe("toProfileFields", () => {
  it("bundles the strings a save route writes", () => {
    const f = toProfileFields(max);
    expect(f.jobTitle).toBe("AI Solutions Architect");
    expect(f.company).toBe("CLOUDPILOTS");
    expect(f.location).toBe("Munich, Bavaria, Germany");
    expect(f.experience.split("\n")).toHaveLength(3);
    expect(f.education.split("\n")).toHaveLength(2);
    expect(f.personalizationSignals).toContain("Gemini Enterprise");
    expect(f.profileSummary.length).toBeGreaterThan(0);
  });
});
