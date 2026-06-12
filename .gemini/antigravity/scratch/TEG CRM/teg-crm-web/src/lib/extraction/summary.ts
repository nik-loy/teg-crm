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
      return e.dates ? `${head} (${e.dates})` : head;
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
  push("LOCATION", p.location);
  push("INDUSTRY", p.industry);
  push("SENIORITY", p.seniority_estimate);
  pushBlock("ABOUT", p.about);

  const exp = renderExperience(p.experience);
  pushBlock("EXPERIENCE", exp);

  const edu = renderEducation(p.education);
  pushBlock("EDUCATION", edu);

  push("SKILLS", p.skills.join(" · "));
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
  };
}
