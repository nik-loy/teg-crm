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
  other_notes: string[];
  excluded_reposts_count: number;
  // Outreach-critical enrichment fields
  connection_degree: string;           // "1st" | "2nd" | "3rd" | "unknown"
  mutual_connections: string[];        // names from "[Name] is a mutual connection" lines
  open_to_work: boolean;              // "Open to Work" banner present
  languages: Array<{ name: string; proficiency: string }>;
  organizations: Array<{ name: string; role: string; dates: string }>;
  certifications: string[];            // up to 7 most relevant professional certs
  website: string;                     // personal/company URL from About or contact info
  key_achievements: string[];          // concrete quantified facts from the About section
}
