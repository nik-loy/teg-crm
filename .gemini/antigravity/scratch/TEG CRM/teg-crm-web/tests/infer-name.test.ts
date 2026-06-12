import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inferNameFromPaste } from "../src/lib/extraction/infer-name";

const fixture = (f: string) => readFileSync(join(__dirname, "fixtures", f), "utf-8");

describe("inferNameFromPaste", () => {
  it("reads the name from the top of a real pasted profile (Max)", () => {
    expect(inferNameFromPaste(fixture("profile-max.txt"))).toBe("Maximilian Wiese");
  });

  it("reads the name from the top of a real pasted profile (Jonas)", () => {
    expect(inferNameFromPaste(fixture("profile-jonas.txt"))).toBe("Jonas Böhrer");
  });

  it("skips UI noise lines before the name", () => {
    const text = "Message\nMore\nAnna Müller\nVP Engineering @ Siemens\nMunich, Germany · 500+ connections";
    expect(inferNameFromPaste(text)).toBe("Anna Müller");
  });

  it("does not mistake the headline (with @ or |) for the name", () => {
    const text = "Klaus Meyer\nHead of Sales @ BMW | Mobility\nMunich";
    expect(inferNameFromPaste(text)).toBe("Klaus Meyer");
  });

  it("returns empty string for blank input", () => {
    expect(inferNameFromPaste("")).toBe("");
  });
});
