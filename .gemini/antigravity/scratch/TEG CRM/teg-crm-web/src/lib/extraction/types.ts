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
  /** Catch-all for any relevant AUTHORED info that fits no dedicated field
   *  (languages, certifications, awards, volunteering, publications) — ensures
   *  nothing useful from the paste is dropped. */
  other_notes: string[];
  excluded_reposts_count: number;
}
