import { describe, it, expect } from "vitest";
import { djangoToFrontendContact } from "../src/lib/backend";

describe("Frontend Basic Tests", () => {
  it("should pass a basic test", () => {
    expect(true).toBe(true);
  });

  it("should map contact correctly without obsolete fields", () => {
    const raw = {
      id: 1,
      name: "John Doe",
      follow_up_owner: { id: 2, name: "Alice" },
      follow_up_complete: true,
      rating: { score: 4, reason: "Good" }
    };
    const c = djangoToFrontendContact(raw);
    expect(c.id).toBe("1");
    expect(c.name).toBe("John Doe");
    expect(c.followUpOwner).toBe("Alice");
    expect(c.followUpOwnerId).toBe("2");
    expect(c.followUpComplete).toBe(true);
    expect(c.rating?.score).toBe(4);
    expect(c.rating?.reason).toBe("Good");
    // Should not have lastContactDate
    expect((c as any).lastContactDate).toBeUndefined();
  });
});
