import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "../src/lib/auth";

describe("auth cookie", () => {
  it("round-trips a valid session", () => {
    const token = signSession("secret123");
    expect(verifySession(token, "secret123")).toBe(true);
  });
  it("rejects a tampered token", () => {
    const token = signSession("secret123");
    expect(verifySession(token + "x", "secret123")).toBe(false);
  });
  it("rejects under a different secret", () => {
    const token = signSession("secret123");
    expect(verifySession(token, "other")).toBe(false);
  });
});
