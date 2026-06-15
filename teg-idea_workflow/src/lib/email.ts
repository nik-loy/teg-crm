import { Resend } from "resend";
import { env } from "@/lib/env";
import type { Idea, Department, DeptResponse } from "@/types";

const resend = new Resend(env.RESEND_API_KEY);

function excerpt(text: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function strategyNotesBlock(strategyNotes: string | null): string {
  if (!strategyNotes) return "";
  return `
    <div style="background:#FEF9C3;border-left:4px solid #CA8A04;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
      <strong>Strategy Notes:</strong>
      <p style="margin:6px 0 0;">${strategyNotes}</p>
    </div>`;
}

function ideaSummaryBlock(idea: Idea): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748B;width:160px;">Type</td><td>${idea.submissionType}</td></tr>
      <tr><td style="padding:6px 0;color:#64748B;">Status</td><td>${idea.status}</td></tr>
      <tr><td style="padding:6px 0;color:#64748B;">Submitted by</td><td>${idea.submitterName} (${idea.submitterDepartment})</td></tr>
      <tr><td style="padding:6px 0;color:#64748B;">Priority</td><td>${idea.priority}</td></tr>
    </table>
    <p style="color:#334155;margin:0 0 16px;"><em>${excerpt(idea.description)}</em></p>
    ${strategyNotesBlock(idea.strategyNotes)}`;
}

function ctaButton(href: string, label = "Open in Notion →"): string {
  return `<a href="${href}" style="background:#0F172A;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-size:14px;font-weight:600;">${label}</a>`;
}

function wrap(title: string, body: string): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1E293B;">
  <div style="border-bottom:2px solid #0F172A;padding-bottom:12px;margin-bottom:20px;">
    <span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;">TEG e.V. — Idea Workflow</span>
    <h2 style="margin:6px 0 0;font-size:20px;">${title}</h2>
  </div>
  ${body}
  <p style="font-size:12px;color:#94A3B8;margin-top:32px;border-top:1px solid #E2E8F0;padding-top:12px;">
    This is an automated message from the TEG Idea Workflow system. Do not reply directly — use the Notion link above.
  </p>
</div>`;
}

async function send(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  const toList = Array.isArray(to) ? to : [to];
  console.log(`[email] sending: "${subject}" to: ${toList.join(", ")}`);
  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      ...(env.REPLY_TO_EMAIL ? { replyTo: env.REPLY_TO_EMAIL } : {}),
      to: toList,
      subject,
      html,
    });
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${toList.join(", ")}:`, err);
    throw err;
  }
}

// 1. New submission → Strategy Head
export async function sendNewSubmissionToStrategy(
  idea: Idea,
  strategyHead: { name: string; email: string }
): Promise<void> {
  const subject = `New idea pending your review: ${idea.title}`;
  const html = wrap("New Idea Awaiting Your Review", `
    <p>Hi ${strategyHead.name},</p>
    <p>A new idea has been submitted and is waiting for your approval.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <p><strong>Next action:</strong> Open the idea in Notion and set the status to <em>Strategy Approved</em> or <em>Strategy Rejected</em> (add Strategy Notes if rejecting).</p>
    <br>${ctaButton(idea.notionUrl)}
  `);
  await send(strategyHead.email, subject, html);
}

// 2. Dept routing (Club Initiative) → Dept lead
export async function sendDeptRoutingEmail(
  idea: Idea,
  dept: Department
): Promise<void> {
  const subject = `New assignment for ${dept.name}: ${idea.title}`;
  const html = wrap(`New Assignment — ${dept.name}`, `
    <p>Hi ${dept.teamLeadName},</p>
    <p>The strategy team has approved a Club Initiative and assigned it to <strong>${dept.name}</strong> for review.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <p><strong>Next action:</strong> Open the department response row in Notion and set the status to <em>Accepted</em> or <em>Declined</em>.</p>
    <br>${ctaButton(idea.notionUrl)}
  `);
  await send(dept.teamLeadEmail, subject, html);
}

// 3. Inter-dept request → Responsible dept lead
export async function sendInterdeptRequestToDept(
  idea: Idea,
  responsibleDept: Department
): Promise<void> {
  const subject = `New request assigned to ${responsibleDept.name}: ${idea.title}`;
  const html = wrap(`Inter-Department Request — ${responsibleDept.name}`, `
    <p>Hi ${responsibleDept.teamLeadName},</p>
    <p>An inter-department request has been routed to <strong>${responsibleDept.name}</strong> for action.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <p><strong>Next action:</strong> Review the request in Notion and update the department response status to <em>Accepted</em> or <em>Pushed Back</em>.</p>
    <br>${ctaButton(idea.notionUrl)}
  `);
  await send(responsibleDept.teamLeadEmail, subject, html);
}

// 4. Inter-dept request FYI → Strategy Head
export async function sendInterdeptFYIToStrategy(
  idea: Idea,
  strategyHead: { name: string; email: string }
): Promise<void> {
  const subject = `FYI: Inter-dept request in progress: ${idea.title}`;
  const html = wrap("FYI: Inter-Department Request Initiated", `
    <p>Hi ${strategyHead.name},</p>
    <p>This is a courtesy notification. An inter-department request has been submitted and routed to the responsible department automatically — no action is required from you unless an issue arises.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <p>You will receive further notifications if the department pushes back or declines.</p>
    <br>${ctaButton(idea.notionUrl)}
  `);
  await send(strategyHead.email, subject, html);
}

// 5. Strategy rejected → Submitter
export async function sendRejectionToSubmitter(idea: Idea): Promise<void> {
  const subject = `Update on your idea: ${idea.title}`;
  const html = wrap("Your Idea Was Not Approved", `
    <p>Hi ${idea.submitterName},</p>
    <p>Thank you for submitting your idea. After review, the Strategy team has decided not to move it forward at this time.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <p>You can view the full feedback and Strategy Notes by opening your idea in Notion. If you have questions, please reach out to the Strategy Head directly.</p>
    <br>${ctaButton(idea.notionUrl, "View Feedback in Notion →")}
  `);
  await send(idea.submitterEmail, subject, html);
}

// 6. Dept declined (Club Initiative) → Strategy Head
export async function sendDeptDeclinedToStrategy(
  idea: Idea,
  response: DeptResponse,
  strategyHead: { name: string; email: string }
): Promise<void> {
  const subject = `${response.department} declined assignment — review needed: ${idea.title}`;
  const html = wrap("Department Declined — Your Review Required", `
    <p>Hi ${strategyHead.name},</p>
    <p><strong>${response.department}</strong> has declined their assignment on the following Club Initiative. The idea has been returned to strategy for review.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    ${response.declineReason ? `<div style="background:#FEE2E2;border-left:4px solid #DC2626;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;"><strong>Decline Reason:</strong><p style="margin:6px 0 0;">${response.declineReason}</p></div>` : ""}
    ${response.deptNotes ? `<p><strong>Department Notes:</strong> ${response.deptNotes}</p>` : ""}
    <p><strong>Next action:</strong> Open the idea in Notion and decide how to proceed — you may reassign it, update scope, or close the idea.</p>
    <br>${ctaButton(idea.notionUrl)}
  `);
  await send(strategyHead.email, subject, html);
}

// 7. Inter-dept pushback FYI → Strategy Head
export async function sendInterdeptPushbackFYIToStrategy(
  idea: Idea,
  response: DeptResponse,
  strategyHead: { name: string; email: string }
): Promise<void> {
  const subject = `FYI: ${response.department} pushed back on request: ${idea.title}`;
  const html = wrap("FYI: Department Pushed Back on Request", `
    <p>Hi ${strategyHead.name},</p>
    <p><strong>${response.department}</strong> has pushed back on an inter-department request. The submitting department has been notified and must take action.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    ${response.declineReason ? `<div style="background:#FEF3C7;border-left:4px solid #D97706;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;"><strong>Pushback Reason:</strong><p style="margin:6px 0 0;">${response.declineReason}</p></div>` : ""}
    ${response.deptNotes ? `<p><strong>Department Notes:</strong> ${response.deptNotes}</p>` : ""}
    <p>No action is required from you at this time unless escalation is needed.</p>
    <br>${ctaButton(idea.notionUrl)}
  `);
  await send(strategyHead.email, subject, html);
}

// 8. Inter-dept pushback → Submitter + Submitter's dept head
export async function sendInterdeptPushbackToSubmitter(
  idea: Idea,
  response: DeptResponse,
  submitterDeptHead: { name: string; email: string }
): Promise<void> {
  const subject = `Your request needs your attention: ${idea.title}`;
  const html = wrap("Action Required: Department Pushed Back", `
    <p>Hi ${idea.submitterName},</p>
    <p><strong>${response.department}</strong> has pushed back on your inter-department request and requires clarification or changes before they can proceed.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    ${response.declineReason ? `<div style="background:#FEF3C7;border-left:4px solid #D97706;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;"><strong>Pushback Reason:</strong><p style="margin:6px 0 0;">${response.declineReason}</p></div>` : ""}
    ${response.deptNotes ? `<p><strong>Department Notes:</strong> ${response.deptNotes}</p>` : ""}
    <p><strong>Next action:</strong> Review the pushback reason, update your idea details in Notion if needed, and contact the ${response.department} lead to resolve the issue.</p>
    <br>${ctaButton(idea.notionUrl, "Open Your Request in Notion →")}
  `);
  await send([idea.submitterEmail, submitterDeptHead.email], subject, html);
}

// 9. Reminder → Any approver/reviewer
export async function sendReminderToApprover(
  idea: Idea,
  recipientEmail: string,
  recipientName: string,
  stuckAt: string
): Promise<void> {
  const subject = `Reminder: action required on ${idea.title}`;
  const html = wrap("Reminder: Action Required", `
    <p>Hi ${recipientName},</p>
    <p>This is a friendly reminder that the following idea is waiting on your input and has not progressed recently.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
      <strong>Stuck at:</strong> ${stuckAt}
    </div>
    <p><strong>Next action:</strong> Please open the idea in Notion and complete the required action as soon as possible to keep the workflow moving.</p>
    <br>${ctaButton(idea.notionUrl)}
  `);
  await send(recipientEmail, subject, html);
}

// 10. Progress update → Submitter
export async function sendSubmitterProgressUpdate(idea: Idea): Promise<void> {
  const subject = `Your idea is still in progress: ${idea.title}`;
  const html = wrap("Progress Update on Your Idea", `
    <p>Hi ${idea.submitterName},</p>
    <p>We want to keep you in the loop — your idea is still being processed and has not been forgotten.</p>
    <h3 style="margin:0 0 8px;">${idea.title}</h3>
    ${ideaSummaryBlock(idea)}
    <p>You'll receive another update once the status changes. If you have urgent questions, feel free to follow up with the Strategy team directly.</p>
    <br>${ctaButton(idea.notionUrl, "View Your Idea in Notion →")}
  `);
  await send(idea.submitterEmail, subject, html);
}
