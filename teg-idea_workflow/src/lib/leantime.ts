import { env } from "@/lib/env";
import type { Idea, Department } from "@/types";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { id?: string | number; [key: string]: unknown };
  error?: { code: number; message: string };
}

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<JsonRpcResponse | null> {
  const url = `${env.LEANTIME_URL}/api/jsonrpc/`;
  const body = JSON.stringify({ jsonrpc: "2.0", method, id: 1, params });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.LEANTIME_API_KEY,
      },
      body,
    });
  } catch (err) {
    console.log("[leantime] network error:", err);
    return null;
  }

  if (!response.ok) {
    console.log("[leantime] HTTP error:", response.status, response.statusText);
    return null;
  }

  try {
    return (await response.json()) as JsonRpcResponse;
  } catch (err) {
    console.log("[leantime] failed to parse JSON response:", err);
    return null;
  }
}

function buildBaseDescription(idea: Idea): string {
  return [
    `Idea Title: ${idea.title}`,
    `Submission Type: ${idea.submissionType}`,
    `Priority: ${idea.priority}`,
    `Submitter: ${idea.submitterName} (${idea.submitterDepartment})`,
    "",
    "Description:",
    idea.description,
    "",
    "Goal:",
    idea.goal,
    "",
    "Success Criteria:",
    idea.successCriteria,
    "",
    ...(idea.strategyNotes
      ? ["Strategy Notes:", idea.strategyNotes, ""]
      : []),
    `Notion Link: ${idea.notionUrl}`,
  ].join("\n");
}

async function createTicket(
  projectId: string,
  headline: string,
  description: string,
  dateToFinish?: string
): Promise<string | null> {
  const today = new Date().toISOString().split("T")[0];

  const rpc = await rpcCall("leantime.rpc.Tickets.addTicket", {
    values: {
      projectId,
      headline,
      description,
      type: "task",
      status: "0",
      dateToFinish: dateToFinish ?? today,
    },
  });

  if (!rpc) return null;

  if (rpc.error) {
    console.log("[leantime] JSON-RPC error:", rpc.error.code, rpc.error.message);
    return null;
  }

  const id = rpc.result?.id;
  if (id === undefined || id === null) {
    console.log("[leantime] unexpected response — no id in result:", rpc.result);
    return null;
  }

  return String(id);
}

export async function createClubInitiativeTicket(
  idea: Idea,
  dept: Department
): Promise<string | null> {
  console.log(`[leantime] creating ticket for: ${idea.title} / dept: ${dept.name}`);

  const headline = `[TEG] ${idea.title}`;
  const description = buildBaseDescription(idea);

  return createTicket(dept.leantimeProjectId, headline, description, idea.proposedTimeline ?? undefined);
}

export async function createInterdeptTicket(
  idea: Idea,
  responsibleDept: Department,
  dependentDeptName: string
): Promise<string | null> {
  console.log(
    `[leantime] creating inter-dept ticket for: ${idea.title} / responsible: ${responsibleDept.name} / requested by: ${dependentDeptName}`
  );

  const headline = `[TEG] ${idea.title}`;
  const description = `${buildBaseDescription(idea)}\nRequested by: ${dependentDeptName}`;

  return createTicket(responsibleDept.leantimeProjectId, headline, description, idea.proposedTimeline ?? undefined);
}
