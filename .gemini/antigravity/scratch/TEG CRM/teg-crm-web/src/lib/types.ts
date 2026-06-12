export type OutreachStatus =
  | "Request Sent"
  | "Connected"
  | "Messaged"
  | "No Response"
  | "Withdrawn";

export type PipelineStage =
  | "Awareness"
  | "First Attendance"
  | "Engaged"
  | "Deepening"
  | "Activated";

export interface Contact {
  id: string;
  name: string;
  linkedinUrl: string;
  jobTitle: string;
  company: string;
  companyId?: string;
  tier: string;
  pipelineStage: PipelineStage | string;
  outreachStatus: OutreachStatus | string;
  outreachOwner: string;
  lastContactDate: string;
  followUpDueDate: string;
  followUpOwner: string;
  followUpComplete: boolean;
  notes: string;
  profileSummary?: string;
  location?: string;
  experience?: string;
  education?: string;
  personalizationSignals?: string;
  notionUrl?: string;
  events?: string[];
}
