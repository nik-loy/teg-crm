import { describe, it, expect } from "vitest";
import {
  scoreMatch,
  rankCandidates,
  isConfidentMatch,
  jaroWinkler,
} from "../src/lib/match/match";
import type { Contact } from "../src/lib/types";

function contact(id: string, name: string): Contact {
  return {
    id,
    name,
    linkedinUrl: "",
    jobTitle: "",
    company: "",
    tier: "",
    pipelineStage: "Awareness",
    outreachStatus: "Request Sent",
    outreachOwner: "",
    lastContactDate: "",
    followUpDueDate: "",
    followUpOwner: "",
    followUpComplete: false,
    notes: "",
  };
}

describe("scoreMatch", () => {
  it("scores an exact (diacritic/title-insensitive) match as 1.0", () => {
    expect(scoreMatch("Dr. Anna Müller", "Anna Muller").score).toBe(1);
  });

  it("scores a middle-name difference highly", () => {
    const r = scoreMatch("Anna Maria Müller", "Anna Müller");
    expect(r.score).toBeGreaterThanOrEqual(0.9);
    expect(r.reason).toMatch(/middle/);
  });

  it("gives a partial-match score when one name contains the other", () => {
    const r = scoreMatch("Anna Müller", "Anna Müller Schmidt");
    expect(r.score).toBeGreaterThanOrEqual(0.8);
  });

  it("gives a low score to unrelated names", () => {
    expect(scoreMatch("Anna Müller", "Jonas Böhrer").score).toBeLessThan(0.55);
  });
});

describe("jaroWinkler", () => {
  it("rates close typos highly and unrelated strings low", () => {
    expect(jaroWinkler("mueller", "muller")).toBeGreaterThan(0.85);
    expect(jaroWinkler("anna", "jonas")).toBeLessThan(0.7);
  });
});

describe("rankCandidates", () => {
  const pool = [
    contact("1", "Anna Müller"),
    contact("2", "Anna Mueller"),
    contact("3", "Jonas Böhrer"),
    contact("4", "Maximilian Wiese"),
  ];

  it("ranks the exact match first and filters weak ones", () => {
    const ranked = rankCandidates("Anna Müller", pool);
    expect(ranked[0].contact.id).toBe("1");
    expect(ranked.every((c) => c.score >= 0.55)).toBe(true);
    expect(ranked.find((c) => c.contact.id === "4")).toBeUndefined();
  });

  it("de-dupes the same contact id", () => {
    const ranked = rankCandidates("Anna Müller", [...pool, contact("1", "Anna Müller")]);
    expect(ranked.filter((c) => c.contact.id === "1")).toHaveLength(1);
  });

  it("returns [] when nothing is close", () => {
    expect(rankCandidates("Zzz Qqq", pool)).toEqual([]);
  });
});

describe("isConfidentMatch", () => {
  it("is confident for a single strong unique match", () => {
    const ranked = rankCandidates("Maximilian Wiese", [contact("4", "Maximilian Wiese")]);
    expect(isConfidentMatch(ranked)).toBe(true);
  });

  it("is NOT confident when two candidates are both strong (ambiguous)", () => {
    const ranked = rankCandidates("Anna Müller", [
      contact("1", "Anna Müller"),
      contact("2", "Anna Müller"),
    ]);
    expect(isConfidentMatch(ranked)).toBe(false);
  });

  it("is NOT confident on a weak top candidate", () => {
    const ranked = rankCandidates("Ana Mler", [contact("1", "Anna Müller Schmidt Weber")]);
    expect(isConfidentMatch(ranked)).toBe(false);
  });
});
