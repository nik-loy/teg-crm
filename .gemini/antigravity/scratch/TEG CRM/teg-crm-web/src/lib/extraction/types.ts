export interface ExtractedProfile {
  name: string;
  headline: string;
  current_title: string;
  current_company: string;
  location: string;
  industry: string;
  seniority_estimate: string;
  education: Array<{ school: string; degree: string; years: string }>;
  experience: Array<{ title: string; company: string; dates: string; current: boolean }>;
  skills: string[];
  authored_posts: Array<{ summary: string; topics: string[] }>;
  personalization_signals: string[];
  about: string;
  excluded_reposts_count: number;
}
