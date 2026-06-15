export type IdeaStatus =
  | "Draft"
  | "Awaiting Strategy Review"
  | "Strategy Approved"
  | "Strategy Rejected"
  | "Routing"
  | "Partially Acknowledged"
  | "Fully Acknowledged"
  | "Returned to Strategy"
  | "Completed";

export type DeptResponseStatus = "Pending" | "Accepted" | "Declined" | "Pushed Back";

export type SubmissionType = "Club Initiative" | "Inter-dept Request";

export type DepartmentName =
  | "Strategy"
  | "Operations"
  | "Marketing"
  | "Sales"
  | "Administration and Finance"
  | "IT";

export interface Idea {
  id: string;
  title: string;
  submitterName: string;
  submitterEmail: string;
  submitterDepartment: DepartmentName;
  submissionType: SubmissionType;
  category: string;
  description: string;
  goal: string;
  successCriteria: string;
  departmentsNeeded: DepartmentName[];
  responsibleDepartment: DepartmentName | null;
  proposedTimeline: string | null;
  priority: "Low" | "Medium" | "High" | "Critical";
  inspirationReferences: string | null;
  proposedOwner: string | null;
  risksConcerns: string | null;
  dependencies: string | null;
  status: IdeaStatus;
  strategyNotes: string | null;
  submittedAt: string | null;
  lastProcessedAt: string | null;
  leantimeTicketIds: string | null;
  notionUrl: string;
}

export interface DeptResponse {
  id: string;
  name: string;
  ideaId: string;
  ideaTitle: string;
  department: DepartmentName;
  departmentLeadEmail: string;
  status: DeptResponseStatus;
  declineReason: string | null;
  deptNotes: string | null;
  responseDate: string | null;
  processedAt: string | null;
  leantimeTicketId: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
}

export interface Department {
  id: string;
  name: DepartmentName;
  teamLeadName: string;
  teamLeadEmail: string;
  leantimeProjectId: string;
  isStrategy?: boolean;
}

export interface AppConfig {
  strategyHead: {
    name: string;
    email: string;
  };
  departments: Department[];
  reminders: {
    strategyReviewHours: number;
    deptResponseHours: number;
    submitterUpdateHours: number;
  };
}

export interface ProcessingResult {
  draftsProcessed: number;
  decisionsProcessed: number;
  responsesProcessed: number;
  remindersProcessed: number;
  errors: string[];
  durationMs: number;
}

export interface LeantimeTicketParams {
  projectId: string;
  headline: string;
  description: string;
  type?: string;
  dateToFinish?: string;
}
