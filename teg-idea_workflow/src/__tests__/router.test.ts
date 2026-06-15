import type { Department, DepartmentName, Idea } from "@/types";
import {
  isClubInitiative,
  isInterdeptRequest,
  getDeptLeadEmail,
  getRoutingDepartments,
  getSubmitterDeptHead,
} from "@/core/router";
import config from "../../config/departments";

// Helper: look up a dept's configured email by name
const cfgEmail = (name: string) =>
  config.departments.find((d) => d.name === name)?.teamLeadEmail ?? "";
const cfgName = (name: string) =>
  config.departments.find((d) => d.name === name)?.teamLeadName ?? "";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeIdea(overrides?: Partial<Idea>): Idea {
  return {
    id: "idea-1",
    title: "Test Idea",
    submitterName: "Alice",
    submitterEmail: "alice@teg-ev.de",
    submitterDepartment: "Marketing",
    submissionType: "Club Initiative",
    category: "Events",
    description: "A test description",
    goal: "A test goal",
    successCriteria: "Some criteria",
    departmentsNeeded: ["Operations", "IT"],
    responsibleDepartment: null,
    proposedTimeline: null,
    priority: "Medium",
    inspirationReferences: null,
    proposedOwner: null,
    risksConcerns: null,
    dependencies: null,
    status: "Draft",
    strategyNotes: null,
    submittedAt: null,
    lastProcessedAt: null,
    leantimeTicketIds: null,
    notionUrl: "https://notion.so/test",
    ...overrides,
  };
}

// ─── isClubInitiative ─────────────────────────────────────────────────────────

describe("isClubInitiative", () => {
  it("returns true when submissionType is 'Club Initiative'", () => {
    const idea = makeIdea({ submissionType: "Club Initiative" });
    expect(isClubInitiative(idea)).toBe(true);
  });

  it("returns false when submissionType is 'Inter-dept Request'", () => {
    const idea = makeIdea({ submissionType: "Inter-dept Request" });
    expect(isClubInitiative(idea)).toBe(false);
  });
});

// ─── isInterdeptRequest ───────────────────────────────────────────────────────

describe("isInterdeptRequest", () => {
  it("returns true when submissionType is 'Inter-dept Request'", () => {
    const idea = makeIdea({ submissionType: "Inter-dept Request" });
    expect(isInterdeptRequest(idea)).toBe(true);
  });

  it("returns false when submissionType is 'Club Initiative'", () => {
    const idea = makeIdea({ submissionType: "Club Initiative" });
    expect(isInterdeptRequest(idea)).toBe(false);
  });
});

// ─── getDeptLeadEmail ─────────────────────────────────────────────────────────

describe("getDeptLeadEmail", () => {
  it("returns the correct email for a known department", () => {
    expect(getDeptLeadEmail("Operations")).toBe(cfgEmail("Operations"));
  });

  it("returns the correct email for IT", () => {
    expect(getDeptLeadEmail("IT")).toBe(cfgEmail("IT"));
  });

  it("returns the correct email for Marketing", () => {
    expect(getDeptLeadEmail("Marketing")).toBe(cfgEmail("Marketing"));
  });

  it("returns the correct email for Strategy", () => {
    expect(getDeptLeadEmail("Strategy")).toBe(cfgEmail("Strategy"));
  });

  it("returns undefined for an unknown department name cast as DepartmentName", () => {
    // Force an unknown value through the type to exercise the undefined path
    const result = getDeptLeadEmail("Unknown Department" as DepartmentName);
    expect(result).toBeUndefined();
  });
});

// ─── getRoutingDepartments ────────────────────────────────────────────────────

describe("getRoutingDepartments", () => {
  describe("Club Initiative", () => {
    it("returns Department objects for every dept listed in departmentsNeeded", () => {
      const idea = makeIdea({
        submissionType: "Club Initiative",
        departmentsNeeded: ["Operations", "IT"],
      });

      const result = getRoutingDepartments(idea);

      expect(result).toHaveLength(2);
      const names = result.map((d) => d.name);
      expect(names).toContain("Operations");
      expect(names).toContain("IT");
    });

    it("returns a single department when only one dept is needed", () => {
      const idea = makeIdea({
        submissionType: "Club Initiative",
        departmentsNeeded: ["Sales"],
      });

      const result = getRoutingDepartments(idea);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Sales");
    });

    it("returns an empty array when departmentsNeeded is empty", () => {
      const idea = makeIdea({
        submissionType: "Club Initiative",
        departmentsNeeded: [],
      });

      const result = getRoutingDepartments(idea);

      expect(result).toHaveLength(0);
    });

    it("returns full Department objects (not just names)", () => {
      const idea = makeIdea({
        submissionType: "Club Initiative",
        departmentsNeeded: ["Marketing"],
      });

      const [dept] = getRoutingDepartments(idea);

      expect(dept).toMatchObject<Partial<Department>>({
        name: "Marketing",
        teamLeadEmail: cfgEmail("Marketing"),
        teamLeadName: cfgName("Marketing"),
      });
    });
  });

  describe("Inter-dept Request", () => {
    it("returns only the responsibleDepartment, ignoring departmentsNeeded", () => {
      const idea = makeIdea({
        submissionType: "Inter-dept Request",
        responsibleDepartment: "IT",
        departmentsNeeded: ["Operations", "Sales"],
      });

      const result = getRoutingDepartments(idea);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("IT");
    });

    it("returns an empty array when responsibleDepartment is null", () => {
      const idea = makeIdea({
        submissionType: "Inter-dept Request",
        responsibleDepartment: null,
      });

      const result = getRoutingDepartments(idea);

      expect(result).toHaveLength(0);
    });

    it("returns the full Department object for the responsible department", () => {
      const idea = makeIdea({
        submissionType: "Inter-dept Request",
        responsibleDepartment: "Administration and Finance",
        departmentsNeeded: [],
      });

      const [dept] = getRoutingDepartments(idea);

      expect(dept).toMatchObject<Partial<Department>>({
        name: "Administration and Finance",
        teamLeadEmail: cfgEmail("Administration and Finance"),
      });
    });
  });
});

// ─── getSubmitterDeptHead ─────────────────────────────────────────────────────

describe("getSubmitterDeptHead", () => {
  it("returns the department object for a known non-strategy department", () => {
    const result = getSubmitterDeptHead("Marketing");
    expect(result).toBeDefined();
    expect(result?.name).toBe("Marketing");
    expect(result?.isStrategy).toBeFalsy();
  });

  it("returns undefined for the Strategy department (isStrategy flag)", () => {
    const result = getSubmitterDeptHead("Strategy");
    expect(result).toBeUndefined();
  });
});
