import { describe, it, expect } from "vitest";
import { normalizeName, nameTokens, stripDiacritics } from "../src/lib/match/normalize";

describe("stripDiacritics", () => {
  it("folds German umlauts and ß", () => {
    expect(stripDiacritics("Müller")).toBe("Muller");
    expect(stripDiacritics("Böhrer")).toBe("Bohrer");
    expect(stripDiacritics("Weiß")).toBe("Weiss");
  });
});

describe("normalizeName", () => {
  it("lowercases and folds diacritics", () => {
    expect(normalizeName("Anna Müller")).toBe("anna muller");
  });

  it("strips leading academic titles (including repeated)", () => {
    expect(normalizeName("Dr. Anna Müller")).toBe("anna muller");
    expect(normalizeName("Prof. Dr. Hans Weber")).toBe("hans weber");
    expect(normalizeName("Dipl.-Ing. Klaus Meyer")).toBe("klaus meyer");
  });

  it("strips trailing post-nominal credentials", () => {
    expect(normalizeName("Jonas Böhrer, PhD")).toBe("jonas bohrer");
    expect(normalizeName("Maria Schmidt MBA")).toBe("maria schmidt");
  });

  it("strips pronoun parentheticals and emojis/ticks", () => {
    expect(normalizeName("Anna Müller (she/her)")).toBe("anna muller");
    expect(normalizeName("Anna Müller ✓")).toBe("anna muller");
    expect(normalizeName("Anna 🚀 Müller")).toBe("anna muller");
  });

  it("returns empty for blank input", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("nameTokens", () => {
  it("extracts first and last, ignoring middle names", () => {
    const t = nameTokens("Anna Maria Müller");
    expect(t.first).toBe("anna");
    expect(t.last).toBe("muller");
    expect(t.all).toEqual(["anna", "maria", "muller"]);
  });

  it("splits hyphenated names", () => {
    const t = nameTokens("Anna-Lena Schmidt");
    expect(t.all).toEqual(["anna", "lena", "schmidt"]);
    expect(t.last).toBe("schmidt");
  });
});
