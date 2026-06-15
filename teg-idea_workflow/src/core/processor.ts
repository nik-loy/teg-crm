import config from "../../config/departments";
import type { ProcessingResult } from "@/types";
import {
  getDraftIdeas,
  getStrategyApprovedIdeas,
  getStrategyRejectedIdeas,
  getUnprocessedDeptResponses,
  getIdeaById,
  getDeptResponsesForIdea,
  getStaleStrategyReviews,
  getStaleDeptResponses,
  updateIdeaStatus,
  setIdeaLastProcessed,
  setIdeaSubmittedAt,
  createDeptResponseRow,
  updateDeptResponseStatus,
  setDeptResponseLeantime,
  setIdeaLeantimeIds,
} from "@/lib/notion";
import {
  sendNewSubmissionToStrategy,
  sendDeptRoutingEmail,
  sendInterdeptRequestToDept,
  sendInterdeptFYIToStrategy,
  sendRejectionToSubmitter,
  sendDeptDeclinedToStrategy,
  sendInterdeptPushbackFYIToStrategy,
  sendInterdeptPushbackToSubmitter,
} from "@/lib/email";
import { createClubInitiativeTicket, createInterdeptTicket } from "@/lib/leantime";
import { isClubInitiative, isInterdeptRequest, getRoutingDepartments, getSubmitterDeptHead } from "./router";
import { checkStrategyReminders, checkDeptReminders } from "./reminders";

export async function processNewDrafts(): Promise<number> {
  const ideas = await getDraftIdeas();
  let count = 0;
  for (const idea of ideas) {
    console.log("[cron] processing draft idea:", idea.id);
    try {
      await setIdeaSubmittedAt(idea.id, new Date());
      await updateIdeaStatus(idea.id, "Awaiting Strategy Review");
      await sendNewSubmissionToStrategy(idea, config.strategyHead);
      await setIdeaLastProcessed(idea.id);
      count++;
    } catch (err) {
      console.error("[cron] failed to process draft:", idea.id, err);
    }
  }
  return count;
}

export async function processStrategyDecisions(): Promise<number> {
  const [approved, rejected] = await Promise.all([
    getStrategyApprovedIdeas(),
    getStrategyRejectedIdeas(),
  ]);
  let count = 0;

  for (const idea of approved) {
    console.log("[cron] processing strategy-approved idea:", idea.id);
    try {
      const depts = getRoutingDepartments(idea);
      for (const dept of depts) {
        await createDeptResponseRow(idea.id, idea.title, dept.name, dept.teamLeadEmail);
      }
      await updateIdeaStatus(idea.id, "Routing");

      if (isClubInitiative(idea)) {
        for (const dept of depts) {
          await sendDeptRoutingEmail(idea, dept);
        }
      } else if (isInterdeptRequest(idea)) {
        if (!depts[0]) {
          console.error("[cron] inter-dept idea has no responsible dept — skipping:", idea.id);
          continue;
        }
        await Promise.all([
          sendInterdeptRequestToDept(idea, depts[0]),
          sendInterdeptFYIToStrategy(idea, config.strategyHead),
        ]);
      }
      await setIdeaLastProcessed(idea.id);
      count++;
    } catch (err) {
      console.error("[cron] failed to process approved idea:", idea.id, err);
    }
  }

  for (const idea of rejected) {
    console.log("[cron] processing strategy-rejected idea:", idea.id);
    try {
      await sendRejectionToSubmitter(idea);
      await setIdeaLastProcessed(idea.id);
      count++;
    } catch (err) {
      console.error("[cron] failed to process rejected idea:", idea.id, err);
    }
  }

  return count;
}

export async function processDeptResponses(): Promise<number> {
  const responses = await getUnprocessedDeptResponses();
  let count = 0;
  // Track ticket IDs per idea for bulk write-back
  const ideaTickets = new Map<string, string[]>();

  for (const response of responses) {
    console.log("[cron] processing dept response:", response.id, "status:", response.status);
    try {
      const idea = await getIdeaById(response.ideaId);
      if (!idea) { console.error("[cron] idea not found for response:", response.id); continue; }

      if (response.status === "Accepted") {
        let ticketId: string | null = null;
        if (isClubInitiative(idea)) {
          const dept = getRoutingDepartments(idea).find((d) => d.name === response.department);
          if (dept) ticketId = await createClubInitiativeTicket(idea, dept);
        } else {
          const dependentDept = idea.submitterDepartment;
          const responsibleDept = getRoutingDepartments(idea)[0];
          if (responsibleDept) ticketId = await createInterdeptTicket(idea, responsibleDept, dependentDept);
        }

        if (ticketId) {
          await setDeptResponseLeantime(response.id, ticketId);
          const existing = ideaTickets.get(idea.id) ?? [];
          ideaTickets.set(idea.id, [...existing, ticketId]);
        }

        const allResponses = await getDeptResponsesForIdea(idea.id);
        const allAccepted = allResponses
          .filter((r) => r.id !== response.id)
          .every((r) => r.status === "Accepted");
        const newIdeaStatus = allAccepted ? "Fully Acknowledged" : "Partially Acknowledged";
        await updateIdeaStatus(idea.id, newIdeaStatus);

      } else if (response.status === "Declined" || response.status === "Pushed Back") {
        if (!response.declineReason) {
          console.log("[cron] skipping response with no decline reason:", response.id);
          continue;
        }
        if (isClubInitiative(idea)) {
          await updateIdeaStatus(idea.id, "Returned to Strategy");
          await sendDeptDeclinedToStrategy(idea, response, config.strategyHead);
        } else {
          const submitterDeptHead = getSubmitterDeptHead(idea.submitterDepartment);
          if (submitterDeptHead) {
            await Promise.all([
              sendInterdeptPushbackFYIToStrategy(idea, response, config.strategyHead),
              sendInterdeptPushbackToSubmitter(idea, response, { name: submitterDeptHead.teamLeadName, email: submitterDeptHead.teamLeadEmail }),
            ]);
          }
        }
      }

      await updateDeptResponseStatus(response.id, response.status, new Date());
      count++;
    } catch (err) {
      console.error("[cron] failed to process dept response:", response.id, err);
    }
  }

  // Write all ticket IDs back to idea rows
  for (const [ideaId, tickets] of Array.from(ideaTickets.entries())) {
    try { await setIdeaLeantimeIds(ideaId, tickets); }
    catch (err) { console.error("[cron] failed to write leantime IDs for idea:", ideaId, err); }
  }

  return count;
}

export async function processReminders(): Promise<number> {
  const { strategyReviewHours, deptResponseHours } = config.reminders;
  const [staleStrategyIdeas, staleDeptResponses] = await Promise.all([
    getStaleStrategyReviews(strategyReviewHours),
    getStaleDeptResponses(deptResponseHours),
  ]);

  // Fetch the full idea for each stale dept response so reminders can email the submitter
  const ideaMap = new Map<string, import("@/types").Idea>(
    staleStrategyIdeas.map((i) => [i.id, i])
  );
  for (const r of staleDeptResponses) {
    if (!ideaMap.has(r.ideaId)) {
      const idea = await getIdeaById(r.ideaId);
      if (idea) ideaMap.set(r.ideaId, idea);
    }
  }

  const [s, d] = await Promise.all([
    checkStrategyReminders(staleStrategyIdeas, config),
    checkDeptReminders(staleDeptResponses, ideaMap, config),
  ]);
  return s + d;
}
