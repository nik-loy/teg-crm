import type { ExtractedProfile } from "./types";

/**
 * Renders the structured extraction into the strings the CRM stores.
 *
 * `renderExperience` / `renderEducation` feed the dedicated (crucial) Notion
 * fields.  `renderSummary` produces the full `Profile Summary` — a clean,
 * repost-free, LOSSLESS mirror of every authored field (so messaging sees
 * everything useful, and nothing is lost even if the dedicated columns don't
 * exist in the Notion schema).
 */

export function renderExperience(exp: ExtractedProfile["experience"]): string {
  return exp
    .map((e) => {
      const head = [e.title, e.company].filter(Boolean).join(" · ");
      const dated = e.dates ? `${head} (${e.dates})` : head;
      return e.current ? `${dated} [current]` : dated;
    })
    .filter(Boolean)
    .join("\n");
}

export function renderEducation(edu: ExtractedProfile["education"]): string {
  return edu
    .map((e) => {
      const head = [e.school, e.degree].filter(Boolean).join(" · ");
      return e.years ? `${head} (${e.years})` : head;
    })
    .filter(Boolean)
    .join("\n");
}

export function renderSignals(p: ExtractedProfile): string {
  return p.personalization_signals.join(", ");
}

export function renderLanguages(langs: ExtractedProfile["languages"]): string {
  return langs.map((l) => `${l.name} (${l.proficiency})`).join(", ");
}

export function renderOrganizations(orgs: ExtractedProfile["organizations"]): string {
  return orgs
    .map((o) => {
      const parts = [o.name];
      if (o.role) parts.push(`(${o.role})`);
      if (o.dates) parts.push(o.dates);
      return parts.join(" ");
    })
    .join("; ");
}

/** Full clean Profile Summary — lossless mirror of all authored content. */
export function renderSummary(p: ExtractedProfile): string {
  const sections: string[] = [];
  const push = (label: string, body: string) => {
    if (body && body.trim()) sections.push(`${label}: ${body}`.trim());
  };
  const pushBlock = (label: string, body: string) => {
    if (body && body.trim()) sections.push(`${label}:\n${body}`);
  };

  push("HEADLINE", p.headline);

  // Outreach context — placed near the top so the message generator sees it prominently
  if (p.connection_degree && p.connection_degree !== "unknown")
    push("CONNECTION", `${p.connection_degree} degree`);
  if (p.mutual_connections.length)
    push("MUTUAL CONNECTIONS", p.mutual_connections.join(", "));
  if (p.open_to_work)
    push("OPEN TO WORK", "Yes — actively seeking new role");

  push("LOCATION", p.location);
  push("INDUSTRY", p.industry);
  push("SENIORITY", p.seniority_estimate);
  pushBlock("ABOUT", p.about);

  const exp = renderExperience(p.experience);
  pushBlock("EXPERIENCE", exp);

  const edu = renderEducation(p.education);
  pushBlock("EDUCATION", edu);

  push("SKILLS", p.skills.join(" · "));

  const langs = renderLanguages(p.languages);
  if (langs) push("LANGUAGES", langs);

  if (p.certifications.length) push("CERTIFICATIONS", p.certifications.join(" · "));

  const orgs = renderOrganizations(p.organizations);
  if (orgs) push("ORGANIZATIONS", orgs);

  if (p.key_achievements.length)
    pushBlock("KEY ACHIEVEMENTS", p.key_achievements.map((a) => `- ${a}`).join("\n"));

  if (p.website) push("WEBSITE", p.website);

  push("SIGNALS", renderSignals(p));

  if (p.authored_posts.length) {
    const posts = p.authored_posts
      .map((a) => `- ${a.summary}${a.topics?.length ? ` [${a.topics.join(", ")}]` : ""}`)
      .join("\n");
    pushBlock("AUTHORED POSTS", posts);
  }

  if (p.other_notes?.length) {
    pushBlock("OTHER", p.other_notes.map((n) => `- ${n}`).join("\n"));
  }

  return sections.join("\n\n");
}

/** The bundle of strings a save route writes to Notion. */
export interface ProfileFields {
  jobTitle: string;
  company: string;
  location: string;
  experience: string;
  education: string;
  personalizationSignals: string;
  profileSummary: string;
  about: string;
  mutualConnections: string;
  openToWork: boolean;
  connectionDegree: string;
  languages: string;
  organizations: string;
  certifications: string;
  website: string;
  keyAchievements: string;
}

export function toProfileFields(p: ExtractedProfile): ProfileFields {
  return {
    jobTitle: p.current_title,
    company: p.current_company,
    location: p.location,
    experience: renderExperience(p.experience),
    education: renderEducation(p.education),
    personalizationSignals: renderSignals(p),
    profileSummary: renderSummary(p),
    about: p.about,
    mutualConnections: p.mutual_connections.join(", "),
    openToWork: p.open_to_work,
    connectionDegree: p.connection_degree,
    languages: renderLanguages(p.languages),
    organizations: renderOrganizations(p.organizations),
    certifications: p.certifications.join(", "),
    website: p.website,
    keyAchievements: p.key_achievements.join(" · "),
  };
}
