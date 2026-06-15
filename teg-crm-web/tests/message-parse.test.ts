import { describe, it, expect } from "vitest";
import { parseFit, parseAnrede, parseSeniority, parseVariants } from "../src/lib/message/parse";

// Recorded fixture: a realistic 3-variant LLM response in the expected format
const FIXTURE = `**Fit-Rating:** 4/5
Starker AI-Consulting-Fokus bei Deloitte, thematisch sehr nah an der Konferenz.
**Senioritäts-Check:**
Consultant-Level, unbedenklich.
**Template:** Extern
Deloitte ist nicht unter den bestätigten Intern-Firmen.
**Ansprache:** Du
Lockerer LinkedIn-Auftritt, Junior-bis-Mid-Level.
**Variante 1 — Posts:**
Hey Max, danke fürs Vernetzen! Hab gesehen, dass du viel über Agentic AI und Enterprise AI schreibst. Wir machen am 10.6. in München eine AI-Consulting-Konferenz mit Speakern u.a. von McKinsey, BCG und IBM. Könnte gut passen. Falls spannend: [LINK] VG Finn
**Variante 2 — Rolle:**
Hey Max, danke fürs Vernetzen! Mit deinem Fokus auf Digital Transformation bei Deloitte dachte ich direkt an unsere AI Consulting Conference am 10.6. in München. Kleines Format, Speaker u.a. von McKinsey, BCG und IBM. Falls du reinschauen willst: [LINK] VG Finn
**Variante 3 — Event-Format:**
Hey Max, danke fürs Vernetzen! Wir machen am 10.6. in München eine kleine AI-Consulting-Konferenz — Panels, Case Studies und Hands-on Workshops. Könnte gut zu deinem Beratungsfokus passen. Falls spannend: [LINK] VG Finn
—`;

describe("parseFit", () => {
  it("extracts integer fit rating", () => {
    expect(parseFit(FIXTURE)).toBe(4);
  });

  it("returns 0 when not found", () => {
    expect(parseFit("no rating here")).toBe(0);
  });
});

describe("parseAnrede", () => {
  it("extracts Du from fixture", () => {
    expect(parseAnrede(FIXTURE)).toBe("Du");
  });

  it("extracts Sie when present", () => {
    const sie = FIXTURE.replace("**Ansprache:** Du", "**Ansprache:** Sie");
    expect(parseAnrede(sie)).toBe("Sie");
  });

  it("defaults to Sie when not found", () => {
    expect(parseAnrede("no anrede")).toBe("Sie");
  });
});

describe("parseSeniority", () => {
  it("extracts first seniority line", () => {
    expect(parseSeniority(FIXTURE)).toBe("Consultant-Level, unbedenklich.");
  });

  it("returns — when not found", () => {
    expect(parseSeniority("no seniority")).toBe("—");
  });
});

describe("parseVariants", () => {
  it("returns exactly 3 variants from fixture", () => {
    const variants = parseVariants(FIXTURE);
    expect(variants).toHaveLength(3);
  });

  it("extracts angle labels correctly", () => {
    const variants = parseVariants(FIXTURE);
    expect(variants[0].angle).toBe("Posts");
    expect(variants[1].angle).toBe("Rolle");
    expect(variants[2].angle).toBe("Event-Format");
  });

  it("extracts non-empty text for each variant", () => {
    const variants = parseVariants(FIXTURE);
    for (const v of variants) {
      expect(v.text.length).toBeGreaterThan(0);
    }
  });

  it("each variant text is within 500 chars", () => {
    const variants = parseVariants(FIXTURE);
    for (const v of variants) {
      expect(v.text.length).toBeLessThanOrEqual(500);
    }
  });

  it("returns empty array when no variants present", () => {
    expect(parseVariants("no variants")).toHaveLength(0);
  });

  it("variant text does not include the angle header line", () => {
    const variants = parseVariants(FIXTURE);
    for (const v of variants) {
      expect(v.text).not.toMatch(/\*\*Variante/);
    }
  });
});
