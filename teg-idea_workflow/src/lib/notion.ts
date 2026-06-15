import { Client, isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { env } from "@/lib/env";
import type { Idea, IdeaStatus, DeptResponse, DeptResponseStatus, DepartmentName } from "@/types/index";

// ─── Property name constants ──────────────────────────────────────────────────
const PI = {
  NAME: "Name", SUBMITTER_NAME: "Submitter Name", SUBMITTER_EMAIL: "Submitter Email",
  SUBMITTER_DEPT: "Submitter Department", SUBMISSION_TYPE: "Submission Type",
  CATEGORY: "Category", DESCRIPTION: "Description", GOAL: "Goal",
  SUCCESS_CRITERIA: "Success Criteria", DEPTS_NEEDED: "Departments Needed",
  RESPONSIBLE_DEPT: "Responsible Department", PROPOSED_TIMELINE: "Proposed Timeline",
  PRIORITY: "Priority", INSPIRATION: "Inspiration References",
  PROPOSED_OWNER: "Proposed Owner", RISKS: "Risks Concerns",
  DEPENDENCIES: "Dependencies", STATUS: "Status", STRATEGY_NOTES: "Strategy Notes",
  SUBMITTED_AT: "Submitted At", LAST_PROCESSED_AT: "Last Processed At",
  LEANTIME_TICKET_IDS: "Leantime Ticket IDs",
} as const;

const PR = {
  NAME: "Name", IDEA: "Idea", DEPARTMENT: "Department",
  DEPT_LEAD_EMAIL: "Department Lead Email", STATUS: "Status",
  DECLINE_REASON: "Decline Reason", DEPT_NOTES: "Dept Notes",
  RESPONSE_DATE: "Response Date", PROCESSED_AT: "Processed At",
  LEANTIME_TICKET_ID: "Leantime Ticket ID", REMINDER_COUNT: "Reminder Count",
  LAST_REMINDER_AT: "Last Reminder At",
} as const;

// ─── Client ───────────────────────────────────────────────────────────────────
const notion = new Client({ auth: env.NOTION_API_KEY });

// ─── Typed property accessors ─────────────────────────────────────────────────
type Props = PageObjectResponse["properties"];

function rt(p: Props, key: string): string | null {
  const v = p[key]; return v?.type === "rich_text" ? (v.rich_text[0]?.plain_text ?? null) : null;
}
function title(p: Props, key: string): string {
  const v = p[key]; return v?.type === "title" ? (v.title[0]?.plain_text ?? "") : "";
}
function sel(p: Props, key: string): string | null {
  const v = p[key]; return v?.type === "select" ? (v.select?.name ?? null) : null;
}
function multiSel(p: Props, key: string): string[] {
  const v = p[key]; return v?.type === "multi_select" ? v.multi_select.map((s) => s.name) : [];
}
function dateVal(p: Props, key: string): string | null {
  const v = p[key]; return v?.type === "date" ? (v.date?.start ?? null) : null;
}
function emailVal(p: Props, key: string): string {
  const v = p[key]; return v?.type === "email" ? (v.email ?? "") : "";
}
function numVal(p: Props, key: string): number {
  const v = p[key]; return v?.type === "number" ? (v.number ?? 0) : 0;
}
function pageUrl(id: string): string {
  return `https://www.notion.so/${id.replace(/-/g, "")}`;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseIdea(page: PageObjectResponse): Idea {
  const p = page.properties;
  return {
    id: page.id,
    title: title(p, PI.NAME),
    submitterName: rt(p, PI.SUBMITTER_NAME) ?? "",
    submitterEmail: emailVal(p, PI.SUBMITTER_EMAIL),
    submitterDepartment: sel(p, PI.SUBMITTER_DEPT) as DepartmentName,
    submissionType: (sel(p, PI.SUBMISSION_TYPE) ?? "Club Initiative") as Idea["submissionType"],
    category: sel(p, PI.CATEGORY) ?? "",
    description: rt(p, PI.DESCRIPTION) ?? "",
    goal: rt(p, PI.GOAL) ?? "",
    successCriteria: rt(p, PI.SUCCESS_CRITERIA) ?? "",
    departmentsNeeded: multiSel(p, PI.DEPTS_NEEDED) as DepartmentName[],
    responsibleDepartment: sel(p, PI.RESPONSIBLE_DEPT) as DepartmentName | null,
    proposedTimeline: dateVal(p, PI.PROPOSED_TIMELINE),
    priority: (sel(p, PI.PRIORITY) ?? "Medium") as Idea["priority"],
    inspirationReferences: rt(p, PI.INSPIRATION),
    proposedOwner: rt(p, PI.PROPOSED_OWNER),
    risksConcerns: rt(p, PI.RISKS),
    dependencies: rt(p, PI.DEPENDENCIES),
    status: (sel(p, PI.STATUS) ?? "Draft") as IdeaStatus,
    strategyNotes: rt(p, PI.STRATEGY_NOTES),
    submittedAt: dateVal(p, PI.SUBMITTED_AT),
    lastProcessedAt: dateVal(p, PI.LAST_PROCESSED_AT),
    leantimeTicketIds: rt(p, PI.LEANTIME_TICKET_IDS),
    notionUrl: pageUrl(page.id),
  };
}

function parseDeptResponse(page: PageObjectResponse): DeptResponse {
  const p = page.properties;
  const rel = p[PR.IDEA];
  const ideaId = rel?.type === "relation" ? (rel.relation[0]?.id ?? "") : "";
  return {
    id: page.id,
    name: title(p, PR.NAME),
    ideaId,
    ideaTitle: "",
    department: sel(p, PR.DEPARTMENT) as DepartmentName,
    departmentLeadEmail: emailVal(p, PR.DEPT_LEAD_EMAIL),
    status: (sel(p, PR.STATUS) ?? "Pending") as DeptResponseStatus,
    declineReason: rt(p, PR.DECLINE_REASON),
    deptNotes: rt(p, PR.DEPT_NOTES),
    responseDate: dateVal(p, PR.RESPONSE_DATE),
    processedAt: dateVal(p, PR.PROCESSED_AT),
    leantimeTicketId: rt(p, PR.LEANTIME_TICKET_ID),
    reminderCount: numVal(p, PR.REMINDER_COUNT),
    lastReminderAt: dateVal(p, PR.LAST_REMINDER_AT),
  };
}

// ─── Query helpers ────────────────────────────────────────────────────────────
type Filter = Parameters<Client["databases"]["query"]>[0]["filter"];

async function queryAll(databaseId: string, filter: Filter) {
  const pages = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pages.filter(isFullPage);
}

async function queryIdeas(filter: Filter): Promise<Idea[]> {
  return (await queryAll(env.NOTION_IDEAS_DB_ID, filter)).map(parseIdea);
}

async function queryDeptResponses(filter: Filter): Promise<DeptResponse[]> {
  return (await queryAll(env.NOTION_DEPT_RESPONSES_DB_ID, filter)).map(parseDeptResponse);
}

// ─── Read functions ───────────────────────────────────────────────────────────
export async function getDraftIdeas(): Promise<Idea[]> {
  console.log("[notion] getDraftIdeas");
  try { return await queryIdeas({ property: PI.STATUS, select: { equals: "Draft" } }); }
  catch (err) { console.error("[notion] getDraftIdeas failed:", err); throw err; }
}

export async function getIdeasAwaitingStrategyReview(): Promise<Idea[]> {
  console.log("[notion] getIdeasAwaitingStrategyReview");
  try { return await queryIdeas({ property: PI.STATUS, select: { equals: "Awaiting Strategy Review" } }); }
  catch (err) { console.error("[notion] getIdeasAwaitingStrategyReview failed:", err); throw err; }
}

export async function getStrategyApprovedIdeas(): Promise<Idea[]> {
  console.log("[notion] getStrategyApprovedIdeas");
  try {
    return await queryIdeas({ and: [
      { property: PI.STATUS, select: { equals: "Strategy Approved" } },
      { property: PI.LAST_PROCESSED_AT, date: { is_empty: true } },
    ]});
  } catch (err) { console.error("[notion] getStrategyApprovedIdeas failed:", err); throw err; }
}

export async function getStrategyRejectedIdeas(): Promise<Idea[]> {
  console.log("[notion] getStrategyRejectedIdeas");
  try {
    return await queryIdeas({ and: [
      { property: PI.STATUS, select: { equals: "Strategy Rejected" } },
      { property: PI.LAST_PROCESSED_AT, date: { is_empty: true } },
    ]});
  } catch (err) { console.error("[notion] getStrategyRejectedIdeas failed:", err); throw err; }
}

export async function getUnprocessedDeptResponses(): Promise<DeptResponse[]> {
  console.log("[notion] getUnprocessedDeptResponses");
  try {
    return await queryDeptResponses({ and: [
      { property: PR.STATUS, select: { does_not_equal: "Pending" } },
      { property: PR.PROCESSED_AT, date: { is_empty: true } },
    ]});
  } catch (err) { console.error("[notion] getUnprocessedDeptResponses failed:", err); throw err; }
}

export async function getStaleDeptResponses(hours: number): Promise<DeptResponse[]> {
  console.log(`[notion] getStaleDeptResponses (>${hours}h)`);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  try {
    return await queryDeptResponses({ and: [
      { property: PR.STATUS, select: { equals: "Pending" } },
      { or: [
        { property: PR.LAST_REMINDER_AT, date: { is_empty: true } },
        { property: PR.LAST_REMINDER_AT, date: { before: cutoff } },
      ]},
    ]});
  } catch (err) { console.error("[notion] getStaleDeptResponses failed:", err); throw err; }
}

export async function getStaleStrategyReviews(hours: number): Promise<Idea[]> {
  console.log(`[notion] getStaleStrategyReviews (>${hours}h)`);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  try {
    return await queryIdeas({ and: [
      { property: PI.STATUS, select: { equals: "Awaiting Strategy Review" } },
      { property: PI.SUBMITTED_AT, date: { before: cutoff } },
    ]});
  } catch (err) { console.error("[notion] getStaleStrategyReviews failed:", err); throw err; }
}

// ─── Write functions ──────────────────────────────────────────────────────────
export async function updateIdeaStatus(
  ideaId: string, status: IdeaStatus, extraProps?: Record<string, unknown>
): Promise<void> {
  console.log(`[notion] updateIdeaStatus: ${ideaId} → ${status}`);
  try {
    await notion.pages.update({ page_id: ideaId, properties: {
      [PI.STATUS]: { select: { name: status } }, ...extraProps,
    }});
  } catch (err) { console.error("[notion] updateIdeaStatus failed:", err); throw err; }
}

export async function setIdeaLastProcessed(ideaId: string): Promise<void> {
  console.log(`[notion] setIdeaLastProcessed: ${ideaId}`);
  try {
    await notion.pages.update({ page_id: ideaId, properties: {
      [PI.LAST_PROCESSED_AT]: { date: { start: new Date().toISOString() } },
    }});
  } catch (err) { console.error("[notion] setIdeaLastProcessed failed:", err); throw err; }
}

export async function setIdeaSubmittedAt(ideaId: string, date: Date): Promise<void> {
  console.log(`[notion] setIdeaSubmittedAt: ${ideaId}`);
  try {
    await notion.pages.update({ page_id: ideaId, properties: {
      [PI.SUBMITTED_AT]: { date: { start: date.toISOString() } },
    }});
  } catch (err) { console.error("[notion] setIdeaSubmittedAt failed:", err); throw err; }
}

export async function createDeptResponseRow(
  ideaId: string, ideaTitle: string, deptName: DepartmentName, deptLeadEmail: string
): Promise<string> {
  console.log(`[notion] createDeptResponseRow: ${ideaTitle} → ${deptName}`);
  try {
    const page = await notion.pages.create({
      parent: { database_id: env.NOTION_DEPT_RESPONSES_DB_ID },
      properties: {
        [PR.NAME]: { title: [{ text: { content: `${ideaTitle} — ${deptName}` } }] },
        [PR.IDEA]: { relation: [{ id: ideaId }] },
        [PR.DEPARTMENT]: { select: { name: deptName } },
        [PR.DEPT_LEAD_EMAIL]: { email: deptLeadEmail },
        [PR.STATUS]: { select: { name: "Pending" } },
        [PR.REMINDER_COUNT]: { number: 0 },
      },
    });
    return page.id;
  } catch (err) { console.error("[notion] createDeptResponseRow failed:", err); throw err; }
}

export async function updateDeptResponseStatus(
  responseId: string, status: DeptResponseStatus, processedAt: Date
): Promise<void> {
  console.log(`[notion] updateDeptResponseStatus: ${responseId} → ${status}`);
  try {
    await notion.pages.update({ page_id: responseId, properties: {
      [PR.STATUS]: { select: { name: status } },
      [PR.PROCESSED_AT]: { date: { start: processedAt.toISOString() } },
    }});
  } catch (err) { console.error("[notion] updateDeptResponseStatus failed:", err); throw err; }
}

export async function setDeptResponseLeantime(responseId: string, ticketId: string): Promise<void> {
  console.log(`[notion] setDeptResponseLeantime: ${responseId} → ticket ${ticketId}`);
  try {
    await notion.pages.update({ page_id: responseId, properties: {
      [PR.LEANTIME_TICKET_ID]: { rich_text: [{ text: { content: ticketId } }] },
    }});
  } catch (err) { console.error("[notion] setDeptResponseLeantime failed:", err); throw err; }
}

export async function setDeptResponseReminder(
  responseId: string, count: number, lastAt: Date
): Promise<void> {
  console.log(`[notion] setDeptResponseReminder: ${responseId} count=${count}`);
  try {
    await notion.pages.update({ page_id: responseId, properties: {
      [PR.REMINDER_COUNT]: { number: count },
      [PR.LAST_REMINDER_AT]: { date: { start: lastAt.toISOString() } },
    }});
  } catch (err) { console.error("[notion] setDeptResponseReminder failed:", err); throw err; }
}

export async function getIdeaById(ideaId: string): Promise<Idea | null> {
  console.log(`[notion] getIdeaById: ${ideaId}`);
  try {
    const page = await notion.pages.retrieve({ page_id: ideaId });
    return isFullPage(page) ? parseIdea(page) : null;
  } catch (err) { console.error("[notion] getIdeaById failed:", err); return null; }
}

export async function getDeptResponsesForIdea(ideaId: string): Promise<DeptResponse[]> {
  console.log(`[notion] getDeptResponsesForIdea: ${ideaId}`);
  try {
    return await queryDeptResponses({
      property: PR.IDEA,
      relation: { contains: ideaId },
    });
  } catch (err) { console.error("[notion] getDeptResponsesForIdea failed:", err); throw err; }
}

export async function setIdeaLeantimeIds(ideaId: string, ticketIds: string[]): Promise<void> {
  console.log(`[notion] setIdeaLeantimeIds: ${ideaId} → [${ticketIds.join(", ")}]`);
  try {
    await notion.pages.update({ page_id: ideaId, properties: {
      [PI.LEANTIME_TICKET_IDS]: { rich_text: [{ text: { content: ticketIds.join(", ") } }] },
    }});
  } catch (err) { console.error("[notion] setIdeaLeantimeIds failed:", err); throw err; }
}
