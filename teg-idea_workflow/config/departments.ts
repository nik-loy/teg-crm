// ─────────────────────────────────────────────────────────────────────────────
// FILL IN BEFORE DEPLOYING
//
// Replace every placeholder below with real values:
//   name / email  → actual team lead full name and TEG email address
//   leantimeProjectId → the numeric ID in the Leantime project URL
//     e.g. https://tegtime.myteg-ev.de/dashboard/show/12 → "12"
//
// The `name` field for each department MUST match the Notion select option
// EXACTLY (including capitalisation and spacing).
// ─────────────────────────────────────────────────────────────────────────────

import type { AppConfig } from "@/types";

const config: AppConfig = {
  strategyHead: {
    name: "FILL_IN: Strategy Head full name",
    email: "FILL_IN: strategy@teg-ev.de",
  },
  departments: [
    {
      id: "strategy",
      name: "Strategy",
      teamLeadName: "FILL_IN: Strategy Head full name",
      teamLeadEmail: "FILL_IN: strategy@teg-ev.de",
      leantimeProjectId: "FILL_IN",
      isStrategy: true,
    },
    {
      id: "operations",
      name: "Operations",
      teamLeadName: "FILL_IN: Operations Lead full name",
      teamLeadEmail: "FILL_IN: operations@teg-ev.de",
      leantimeProjectId: "FILL_IN",
    },
    {
      id: "marketing",
      name: "Marketing",
      teamLeadName: "FILL_IN: Marketing Lead full name",
      teamLeadEmail: "FILL_IN: marketing@teg-ev.de",
      leantimeProjectId: "FILL_IN",
    },
    {
      id: "sales",
      name: "Sales",
      teamLeadName: "FILL_IN: Sales Lead full name",
      teamLeadEmail: "FILL_IN: sales@teg-ev.de",
      leantimeProjectId: "FILL_IN",
    },
    {
      id: "administration-and-finance",
      name: "Administration and Finance",
      teamLeadName: "FILL_IN: Admin & Finance Lead full name",
      teamLeadEmail: "FILL_IN: finance@teg-ev.de",
      leantimeProjectId: "FILL_IN",
    },
    {
      id: "it",
      name: "IT",
      teamLeadName: "FILL_IN: IT Lead full name",
      teamLeadEmail: "FILL_IN: it@teg-ev.de",
      leantimeProjectId: "FILL_IN",
    },
  ],
  reminders: {
    strategyReviewHours: 48,
    deptResponseHours: 48,
    submitterUpdateHours: 72,
  },
};

export default config;
