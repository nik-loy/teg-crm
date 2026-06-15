import type { AppConfig, DeptResponse, Idea } from "@/types";
import {
  sendReminderToApprover,
  sendSubmitterProgressUpdate,
} from "@/lib/email";
import { setDeptResponseReminder } from "@/lib/notion";
import { getDepartment } from "./router";

export async function checkStrategyReminders(
  staleIdeas: Idea[],
  config: AppConfig
): Promise<number> {
  let count = 0;
  for (const idea of staleIdeas) {
    console.log(`[reminders] strategy reminder for idea: ${idea.id}`);
    await sendReminderToApprover(
      idea,
      config.strategyHead.email,
      config.strategyHead.name,
      "Strategy Review"
    );
    await sendSubmitterProgressUpdate(idea);
    count++;
  }
  return count;
}

// ideaMap: keyed by ideaId so we can look up full Idea data for submitter notifications
export async function checkDeptReminders(
  staleDeptResponses: DeptResponse[],
  ideaMap: Map<string, Idea>,
  config: AppConfig
): Promise<number> {
  let count = 0;
  for (const response of staleDeptResponses) {
    console.log(`[reminders] dept reminder for response: ${response.id}`);
    const dept = getDepartment(response.department);
    const idea = ideaMap.get(response.ideaId);
    if (dept && idea) {
      await sendReminderToApprover(
        idea,
        dept.teamLeadEmail,
        dept.teamLeadName,
        `Department Response (${response.department})`
      );
      await sendSubmitterProgressUpdate(idea);
    }
    const newCount = response.reminderCount + 1;
    await setDeptResponseReminder(response.id, newCount, new Date());
    count++;
  }
  return count;
}
