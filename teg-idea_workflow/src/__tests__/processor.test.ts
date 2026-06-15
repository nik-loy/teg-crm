import type { Idea, DeptResponse, DepartmentName } from "@/types";

// ─── Mock all external modules before any imports ─────────────────────────────
// env must be mocked first to prevent Zod validation from running at module load
jest.mock("@/lib/env", () => ({
  env: {
    NOTION_API_KEY: "test-key",
    NOTION_IDEAS_DB_ID: "test-ideas-db",
    NOTION_DEPT_RESPONSES_DB_ID: "test-responses-db",
    CRON_SECRET: "test-secret",
    RESEND_API_KEY: "test-resend-key",
    FROM_EMAIL: "test@example.com",
    REPLY_TO_EMAIL: "reply@example.com",
    LEANTIME_URL: "https://leantime.example.com",
    LEANTIME_API_KEY: "test-leantime-key",
    APP_URL: "https://app.example.com",
  },
}));
jest.mock("@/lib/notion");
jest.mock("@/lib/email");
jest.mock("@/lib/leantime");

import * as notionLib from "@/lib/notion";
import * as emailLib from "@/lib/email";
import * as leantimeLib from "@/lib/leantime";

import {
  processNewDrafts,
  processStrategyDecisions,
  processDeptResponses,
} from "@/core/processor";
import config from "../../config/departments";

const cfgEmail = (name: string) =>
  config.departments.find((d) => d.name === name)?.teamLeadEmail ?? "";
const cfgName = (name: string) =>
  config.departments.find((d) => d.name === name)?.teamLeadName ?? "";

// ─── Typed mock aliases ───────────────────────────────────────────────────────
const mockGetDraftIdeas = notionLib.getDraftIdeas as jest.MockedFunction<
  typeof notionLib.getDraftIdeas
>;
const mockGetStrategyApprovedIdeas =
  notionLib.getStrategyApprovedIdeas as jest.MockedFunction<
    typeof notionLib.getStrategyApprovedIdeas
  >;
const mockGetStrategyRejectedIdeas =
  notionLib.getStrategyRejectedIdeas as jest.MockedFunction<
    typeof notionLib.getStrategyRejectedIdeas
  >;
const mockGetUnprocessedDeptResponses =
  notionLib.getUnprocessedDeptResponses as jest.MockedFunction<
    typeof notionLib.getUnprocessedDeptResponses
  >;
const mockGetIdeaById = notionLib.getIdeaById as jest.MockedFunction<
  typeof notionLib.getIdeaById
>;
const mockGetDeptResponsesForIdea =
  notionLib.getDeptResponsesForIdea as jest.MockedFunction<
    typeof notionLib.getDeptResponsesForIdea
  >;
const mockUpdateIdeaStatus = notionLib.updateIdeaStatus as jest.MockedFunction<
  typeof notionLib.updateIdeaStatus
>;
const mockSetIdeaLastProcessed =
  notionLib.setIdeaLastProcessed as jest.MockedFunction<
    typeof notionLib.setIdeaLastProcessed
  >;
const mockSetIdeaSubmittedAt =
  notionLib.setIdeaSubmittedAt as jest.MockedFunction<
    typeof notionLib.setIdeaSubmittedAt
  >;
const mockCreateDeptResponseRow =
  notionLib.createDeptResponseRow as jest.MockedFunction<
    typeof notionLib.createDeptResponseRow
  >;
const mockUpdateDeptResponseStatus =
  notionLib.updateDeptResponseStatus as jest.MockedFunction<
    typeof notionLib.updateDeptResponseStatus
  >;
const mockSetDeptResponseLeantime =
  notionLib.setDeptResponseLeantime as jest.MockedFunction<
    typeof notionLib.setDeptResponseLeantime
  >;
const mockSetIdeaLeantimeIds =
  notionLib.setIdeaLeantimeIds as jest.MockedFunction<
    typeof notionLib.setIdeaLeantimeIds
  >;

const mockSendNewSubmissionToStrategy =
  emailLib.sendNewSubmissionToStrategy as jest.MockedFunction<
    typeof emailLib.sendNewSubmissionToStrategy
  >;
const mockSendDeptRoutingEmail =
  emailLib.sendDeptRoutingEmail as jest.MockedFunction<
    typeof emailLib.sendDeptRoutingEmail
  >;
const mockSendInterdeptRequestToDept =
  emailLib.sendInterdeptRequestToDept as jest.MockedFunction<
    typeof emailLib.sendInterdeptRequestToDept
  >;
const mockSendInterdeptFYIToStrategy =
  emailLib.sendInterdeptFYIToStrategy as jest.MockedFunction<
    typeof emailLib.sendInterdeptFYIToStrategy
  >;
const mockSendRejectionToSubmitter =
  emailLib.sendRejectionToSubmitter as jest.MockedFunction<
    typeof emailLib.sendRejectionToSubmitter
  >;
const mockSendDeptDeclinedToStrategy =
  emailLib.sendDeptDeclinedToStrategy as jest.MockedFunction<
    typeof emailLib.sendDeptDeclinedToStrategy
  >;
const mockSendInterdeptPushbackFYIToStrategy =
  emailLib.sendInterdeptPushbackFYIToStrategy as jest.MockedFunction<
    typeof emailLib.sendInterdeptPushbackFYIToStrategy
  >;
const mockSendInterdeptPushbackToSubmitter =
  emailLib.sendInterdeptPushbackToSubmitter as jest.MockedFunction<
    typeof emailLib.sendInterdeptPushbackToSubmitter
  >;

const mockCreateClubInitiativeTicket =
  leantimeLib.createClubInitiativeTicket as jest.MockedFunction<
    typeof leantimeLib.createClubInitiativeTicket
  >;
const mockCreateInterdeptTicket =
  leantimeLib.createInterdeptTicket as jest.MockedFunction<
    typeof leantimeLib.createInterdeptTicket
  >;

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

function makeDeptResponse(overrides?: Partial<DeptResponse>): DeptResponse {
  return {
    id: "response-1",
    name: "Test Idea — Operations",
    ideaId: "idea-1",
    ideaTitle: "Test Idea",
    department: "Operations",
    departmentLeadEmail: cfgEmail("Operations"),
    status: "Pending",
    declineReason: null,
    deptNotes: null,
    responseDate: null,
    processedAt: null,
    leantimeTicketId: null,
    reminderCount: 0,
    lastReminderAt: null,
    ...overrides,
  };
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default all void-returning notion writes to resolve successfully
  mockUpdateIdeaStatus.mockResolvedValue(undefined);
  mockSetIdeaLastProcessed.mockResolvedValue(undefined);
  mockSetIdeaSubmittedAt.mockResolvedValue(undefined);
  mockCreateDeptResponseRow.mockResolvedValue("response-row-id");
  mockUpdateDeptResponseStatus.mockResolvedValue(undefined);
  mockSetDeptResponseLeantime.mockResolvedValue(undefined);
  mockSetIdeaLeantimeIds.mockResolvedValue(undefined);

  // Default all email sends to resolve successfully
  mockSendNewSubmissionToStrategy.mockResolvedValue(undefined);
  mockSendDeptRoutingEmail.mockResolvedValue(undefined);
  mockSendInterdeptRequestToDept.mockResolvedValue(undefined);
  mockSendInterdeptFYIToStrategy.mockResolvedValue(undefined);
  mockSendRejectionToSubmitter.mockResolvedValue(undefined);
  mockSendDeptDeclinedToStrategy.mockResolvedValue(undefined);
  mockSendInterdeptPushbackFYIToStrategy.mockResolvedValue(undefined);
  mockSendInterdeptPushbackToSubmitter.mockResolvedValue(undefined);
});

// ─── processNewDrafts ─────────────────────────────────────────────────────────

describe("processNewDrafts", () => {
  it("sets submittedAt, transitions status to Awaiting Strategy Review, emails strategy, and sets lastProcessed", async () => {
    const idea = makeIdea();
    mockGetDraftIdeas.mockResolvedValue([idea]);

    const count = await processNewDrafts();

    expect(mockSetIdeaSubmittedAt).toHaveBeenCalledWith(idea.id, expect.any(Date));
    expect(mockUpdateIdeaStatus).toHaveBeenCalledWith(idea.id, "Awaiting Strategy Review");
    expect(mockSendNewSubmissionToStrategy).toHaveBeenCalledWith(
      idea,
      expect.objectContaining({ email: config.strategyHead.email })
    );
    expect(mockSetIdeaLastProcessed).toHaveBeenCalledWith(idea.id);
    expect(count).toBe(1);
  });

  it("calls each operation in the correct order via sequential awaits", async () => {
    const idea = makeIdea();
    mockGetDraftIdeas.mockResolvedValue([idea]);
    const callOrder: string[] = [];
    mockSetIdeaSubmittedAt.mockImplementation(async () => { callOrder.push("setSubmittedAt"); });
    mockUpdateIdeaStatus.mockImplementation(async () => { callOrder.push("updateStatus"); });
    mockSendNewSubmissionToStrategy.mockImplementation(async () => { callOrder.push("sendEmail"); });
    mockSetIdeaLastProcessed.mockImplementation(async () => { callOrder.push("setLastProcessed"); });

    await processNewDrafts();

    expect(callOrder).toEqual(["setSubmittedAt", "updateStatus", "sendEmail", "setLastProcessed"]);
  });

  it("does nothing and returns 0 when there are no draft ideas", async () => {
    mockGetDraftIdeas.mockResolvedValue([]);

    const count = await processNewDrafts();

    expect(mockSetIdeaSubmittedAt).not.toHaveBeenCalled();
    expect(mockUpdateIdeaStatus).not.toHaveBeenCalled();
    expect(mockSendNewSubmissionToStrategy).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it("processes multiple drafts and returns the correct count", async () => {
    const ideas = [makeIdea({ id: "idea-1" }), makeIdea({ id: "idea-2" })];
    mockGetDraftIdeas.mockResolvedValue(ideas);

    const count = await processNewDrafts();

    expect(mockSetIdeaSubmittedAt).toHaveBeenCalledTimes(2);
    expect(count).toBe(2);
  });
});

// ─── processStrategyDecisions — Club Initiative ───────────────────────────────

describe("processStrategyDecisions — Club Initiative — Strategy Approved", () => {
  it("creates dept response rows for each department needed", async () => {
    const idea = makeIdea({
      id: "idea-ci-1",
      submissionType: "Club Initiative",
      status: "Strategy Approved",
      departmentsNeeded: ["Operations", "IT"],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockCreateDeptResponseRow).toHaveBeenCalledTimes(2);
    expect(mockCreateDeptResponseRow).toHaveBeenCalledWith(
      idea.id,
      idea.title,
      "Operations",
      cfgEmail("Operations")
    );
    expect(mockCreateDeptResponseRow).toHaveBeenCalledWith(
      idea.id,
      idea.title,
      "IT",
      cfgEmail("IT")
    );
  });

  it("updates idea status to Routing", async () => {
    const idea = makeIdea({
      submissionType: "Club Initiative",
      status: "Strategy Approved",
      departmentsNeeded: ["Operations"],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockUpdateIdeaStatus).toHaveBeenCalledWith(idea.id, "Routing");
  });

  it("sends a routing email to each assigned department", async () => {
    const idea = makeIdea({
      submissionType: "Club Initiative",
      status: "Strategy Approved",
      departmentsNeeded: ["Operations", "IT"],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockSendDeptRoutingEmail).toHaveBeenCalledTimes(2);
    expect(mockSendDeptRoutingEmail).toHaveBeenCalledWith(
      idea,
      expect.objectContaining({ name: "Operations" })
    );
    expect(mockSendDeptRoutingEmail).toHaveBeenCalledWith(
      idea,
      expect.objectContaining({ name: "IT" })
    );
  });

  it("sets lastProcessed on the idea and returns count 1", async () => {
    const idea = makeIdea({
      submissionType: "Club Initiative",
      status: "Strategy Approved",
      departmentsNeeded: ["Operations"],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    const count = await processStrategyDecisions();

    expect(mockSetIdeaLastProcessed).toHaveBeenCalledWith(idea.id);
    expect(count).toBe(1);
  });

  it("does NOT send inter-dept emails for a Club Initiative", async () => {
    const idea = makeIdea({
      submissionType: "Club Initiative",
      status: "Strategy Approved",
      departmentsNeeded: ["Operations"],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockSendInterdeptRequestToDept).not.toHaveBeenCalled();
    expect(mockSendInterdeptFYIToStrategy).not.toHaveBeenCalled();
  });
});

// ─── processStrategyDecisions — Club Initiative — Strategy Rejected ───────────

describe("processStrategyDecisions — Strategy Rejected", () => {
  it("sends rejection email to submitter and sets lastProcessed", async () => {
    const idea = makeIdea({ status: "Strategy Rejected" });
    mockGetStrategyApprovedIdeas.mockResolvedValue([]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([idea]);

    const count = await processStrategyDecisions();

    expect(mockSendRejectionToSubmitter).toHaveBeenCalledWith(idea);
    expect(mockSetIdeaLastProcessed).toHaveBeenCalledWith(idea.id);
    expect(count).toBe(1);
  });

  it("does NOT create dept response rows when rejected", async () => {
    const idea = makeIdea({ status: "Strategy Rejected" });
    mockGetStrategyApprovedIdeas.mockResolvedValue([]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([idea]);

    await processStrategyDecisions();

    expect(mockCreateDeptResponseRow).not.toHaveBeenCalled();
  });
});

// ─── processStrategyDecisions — Inter-dept Request — Strategy Approved ────────

describe("processStrategyDecisions — Inter-dept Request — Strategy Approved", () => {
  it("creates exactly one dept response row for the responsible department", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      status: "Strategy Approved",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockCreateDeptResponseRow).toHaveBeenCalledTimes(1);
    expect(mockCreateDeptResponseRow).toHaveBeenCalledWith(
      idea.id,
      idea.title,
      "IT",
      cfgEmail("IT")
    );
  });

  it("updates idea status to Routing", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      status: "Strategy Approved",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockUpdateIdeaStatus).toHaveBeenCalledWith(idea.id, "Routing");
  });

  it("sends both the inter-dept request email AND the FYI to strategy simultaneously", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      status: "Strategy Approved",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockSendInterdeptRequestToDept).toHaveBeenCalledWith(
      idea,
      expect.objectContaining({ name: "IT" })
    );
    expect(mockSendInterdeptFYIToStrategy).toHaveBeenCalledWith(
      idea,
      expect.objectContaining({ email: config.strategyHead.email })
    );
  });

  it("does NOT send dept routing (Club Initiative) email for inter-dept ideas", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      status: "Strategy Approved",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    mockGetStrategyApprovedIdeas.mockResolvedValue([idea]);
    mockGetStrategyRejectedIdeas.mockResolvedValue([]);

    await processStrategyDecisions();

    expect(mockSendDeptRoutingEmail).not.toHaveBeenCalled();
  });
});

// ─── processDeptResponses — Club Initiative — Accepted ───────────────────────

describe("processDeptResponses — Club Initiative — Accepted", () => {
  it("creates a Leantime ticket and writes the ticket ID back to the response row", async () => {
    const idea = makeIdea({
      submissionType: "Club Initiative",
      departmentsNeeded: ["Operations", "IT"],
    });
    const response = makeDeptResponse({
      ideaId: idea.id,
      department: "Operations",
      status: "Accepted",
    });
    const otherResponse = makeDeptResponse({
      id: "response-2",
      department: "IT",
      status: "Accepted",
    });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);
    mockGetDeptResponsesForIdea.mockResolvedValue([response, otherResponse]);
    mockCreateClubInitiativeTicket.mockResolvedValue("ticket-42");

    await processDeptResponses();

    expect(mockCreateClubInitiativeTicket).toHaveBeenCalledWith(
      idea,
      expect.objectContaining({ name: "Operations" })
    );
    expect(mockSetDeptResponseLeantime).toHaveBeenCalledWith(response.id, "ticket-42");
  });

  it("sets idea status to 'Fully Acknowledged' when all other responses are Accepted", async () => {
    const idea = makeIdea({
      submissionType: "Club Initiative",
      departmentsNeeded: ["Operations", "IT"],
    });
    const response = makeDeptResponse({ ideaId: idea.id, department: "Operations", status: "Accepted" });
    const otherAccepted = makeDeptResponse({ id: "response-2", department: "IT", status: "Accepted" });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);
    mockGetDeptResponsesForIdea.mockResolvedValue([response, otherAccepted]);
    mockCreateClubInitiativeTicket.mockResolvedValue("ticket-1");

    await processDeptResponses();

    expect(mockUpdateIdeaStatus).toHaveBeenCalledWith(idea.id, "Fully Acknowledged");
  });

  it("sets idea status to 'Partially Acknowledged' when some responses are still pending", async () => {
    const idea = makeIdea({
      submissionType: "Club Initiative",
      departmentsNeeded: ["Operations", "IT"],
    });
    const response = makeDeptResponse({ ideaId: idea.id, department: "Operations", status: "Accepted" });
    const stillPending = makeDeptResponse({ id: "response-2", department: "IT", status: "Pending" });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);
    mockGetDeptResponsesForIdea.mockResolvedValue([response, stillPending]);
    mockCreateClubInitiativeTicket.mockResolvedValue("ticket-1");

    await processDeptResponses();

    expect(mockUpdateIdeaStatus).toHaveBeenCalledWith(idea.id, "Partially Acknowledged");
  });

  it("writes accumulated ticket IDs back to the idea row after all responses", async () => {
    const idea = makeIdea({ submissionType: "Club Initiative", departmentsNeeded: ["Operations"] });
    const response = makeDeptResponse({ ideaId: idea.id, department: "Operations", status: "Accepted" });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);
    mockGetDeptResponsesForIdea.mockResolvedValue([response]);
    mockCreateClubInitiativeTicket.mockResolvedValue("ticket-99");

    await processDeptResponses();

    expect(mockSetIdeaLeantimeIds).toHaveBeenCalledWith(idea.id, ["ticket-99"]);
  });

  it("marks the response row as processed with updateDeptResponseStatus", async () => {
    const idea = makeIdea({ submissionType: "Club Initiative", departmentsNeeded: ["Operations"] });
    const response = makeDeptResponse({ ideaId: idea.id, department: "Operations", status: "Accepted" });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);
    mockGetDeptResponsesForIdea.mockResolvedValue([response]);
    mockCreateClubInitiativeTicket.mockResolvedValue("ticket-1");

    await processDeptResponses();

    expect(mockUpdateDeptResponseStatus).toHaveBeenCalledWith(
      response.id,
      "Accepted",
      expect.any(Date)
    );
  });
});

// ─── processDeptResponses — Club Initiative — Declined ───────────────────────

describe("processDeptResponses — Club Initiative — Declined", () => {
  it("sets idea status to 'Returned to Strategy' and emails strategy when decline reason is present", async () => {
    const idea = makeIdea({ submissionType: "Club Initiative" });
    const response = makeDeptResponse({
      ideaId: idea.id,
      department: "Operations",
      status: "Declined",
      declineReason: "Out of budget",
    });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);

    await processDeptResponses();

    expect(mockUpdateIdeaStatus).toHaveBeenCalledWith(idea.id, "Returned to Strategy");
    expect(mockSendDeptDeclinedToStrategy).toHaveBeenCalledWith(
      idea,
      response,
      expect.objectContaining({ email: config.strategyHead.email })
    );
  });

  it("skips processing silently when there is no decline reason", async () => {
    const idea = makeIdea({ submissionType: "Club Initiative" });
    const response = makeDeptResponse({
      ideaId: idea.id,
      department: "Operations",
      status: "Declined",
      declineReason: null,
    });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);

    await processDeptResponses();

    expect(mockUpdateIdeaStatus).not.toHaveBeenCalled();
    expect(mockSendDeptDeclinedToStrategy).not.toHaveBeenCalled();
    // The response row is also NOT marked as processed when skipped
    expect(mockUpdateDeptResponseStatus).not.toHaveBeenCalled();
  });
});

// ─── processDeptResponses — Inter-dept Request — Pushed Back ─────────────────

describe("processDeptResponses — Inter-dept Request — Pushed Back", () => {
  it("sends FYI to strategy AND pushback notification to submitter/dept head when reason is present", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      submitterDepartment: "Marketing",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    const response = makeDeptResponse({
      ideaId: idea.id,
      department: "IT",
      status: "Pushed Back",
      declineReason: "Needs more detail",
    });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);

    await processDeptResponses();

    expect(mockSendInterdeptPushbackFYIToStrategy).toHaveBeenCalledWith(
      idea,
      response,
      expect.objectContaining({ email: config.strategyHead.email })
    );
    expect(mockSendInterdeptPushbackToSubmitter).toHaveBeenCalledWith(
      idea,
      response,
      expect.objectContaining({ name: cfgName("Marketing") })
    );
  });

  it("does NOT update idea status to 'Returned to Strategy' for inter-dept pushbacks", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      submitterDepartment: "Marketing",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    const response = makeDeptResponse({
      ideaId: idea.id,
      department: "IT",
      status: "Pushed Back",
      declineReason: "Needs more detail",
    });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);

    await processDeptResponses();

    expect(mockUpdateIdeaStatus).not.toHaveBeenCalledWith(
      idea.id,
      "Returned to Strategy"
    );
  });

  it("skips silently when there is no pushback reason", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      submitterDepartment: "Marketing",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    const response = makeDeptResponse({
      ideaId: idea.id,
      department: "IT",
      status: "Pushed Back",
      declineReason: null,
    });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);

    await processDeptResponses();

    expect(mockSendInterdeptPushbackFYIToStrategy).not.toHaveBeenCalled();
    expect(mockSendInterdeptPushbackToSubmitter).not.toHaveBeenCalled();
    expect(mockUpdateDeptResponseStatus).not.toHaveBeenCalled();
  });

  it("creates an inter-dept Leantime ticket (not a club initiative ticket) on Accepted", async () => {
    const idea = makeIdea({
      submissionType: "Inter-dept Request",
      submitterDepartment: "Marketing",
      responsibleDepartment: "IT",
      departmentsNeeded: [],
    });
    const response = makeDeptResponse({
      ideaId: idea.id,
      department: "IT",
      status: "Accepted",
    });

    mockGetUnprocessedDeptResponses.mockResolvedValue([response]);
    mockGetIdeaById.mockResolvedValue(idea);
    mockGetDeptResponsesForIdea.mockResolvedValue([response]);
    mockCreateInterdeptTicket.mockResolvedValue("ticket-interdept-7");

    await processDeptResponses();

    expect(mockCreateInterdeptTicket).toHaveBeenCalledWith(
      idea,
      expect.objectContaining({ name: "IT" }),
      "Marketing"
    );
    expect(mockCreateClubInitiativeTicket).not.toHaveBeenCalled();
  });

  it("returns 0 when there are no unprocessed responses", async () => {
    mockGetUnprocessedDeptResponses.mockResolvedValue([]);

    const count = await processDeptResponses();

    expect(count).toBe(0);
    expect(mockGetIdeaById).not.toHaveBeenCalled();
  });
});
