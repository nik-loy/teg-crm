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
  events?: string[];
  // Enrichment fields for personalised outreach
  about?: string;
  mutualConnections?: string;
  openToWork?: boolean;
  connectionDegree?: string;
  languages?: string;
  organizations?: string;
  certifications?: string;
  website?: string;
  keyAchievements?: string;
}

export interface EventRecord {
  id: number;
  name: string;
  slug: string;
  date: string;
  location?: string;
  description?: string;
  luma_url?: string;
  is_active: boolean;
  outreach_prompt?: string;
  fit_scoring_prompt?: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  contact: {
    id: number;
    name: string;
    company_name: string;
    linkedin_url: string;
    job_title: string;
    profile_summary?: string;
    experience?: string;
    about?: string;
  };
  event: number;
  fit_score: number | null;
  fit_reason: string;
  attended: boolean;
  registered_at?: string;
}

export interface DraftRecord {
  id: number;
  attendance: AttendanceRecord;
  step_number: number;
  generated_text: string;
  status: "Pending" | "Approved";
  created_at: string;
  updated_at: string;
}

export interface TodayBuckets {
  replies: Contact[];
  dueFollowups: Contact[];
  staleRequests: Contact[];
  noMessage: Contact[];
}
