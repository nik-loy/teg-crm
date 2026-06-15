import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Contact } from "../types";

type Props = PageObjectResponse["properties"];

function getText(props: Props, key: string): string {
  const p = props[key];
  if (!p) return "";
  if (p.type === "title") return p.title[0]?.plain_text ?? "";
  if (p.type === "rich_text") return p.rich_text.map((t) => t.plain_text).join("");
  if (p.type === "url") return p.url ?? "";
  if (p.type === "select") return p.select?.name ?? "";
  if (p.type === "date") return p.date?.start ?? "";
  if (p.type === "people") {
    const person = p.people[0] as { name?: string } | undefined;
    return person?.name ?? "";
  }
  return "";
}

export function pageToContact(page: PageObjectResponse): Contact {
  const p = page.properties;
  const companyProp = p["Company"];
  const relationId =
    companyProp?.type === "relation" && companyProp.relation.length > 0
      ? companyProp.relation[0].id
      : undefined;

  const followUpProp = p["Follow-Up Complete"];
  const followUpComplete =
    followUpProp?.type === "checkbox" ? followUpProp.checkbox : false;

  const eventsProp = p["Events"];
  const events =
    eventsProp?.type === "multi_select"
      ? eventsProp.multi_select.map((o) => o.name)
      : [];

  const openToWorkProp = p["Open to Work"];
  const openToWork =
    openToWorkProp?.type === "checkbox" ? openToWorkProp.checkbox : false;

  return {
    id: page.id,
    name: getText(p, "Name"),
    linkedinUrl: getText(p, "LinkedIn URL"),
    jobTitle: getText(p, "Job Title"),
    company: "",
    companyId: relationId,
    tier: getText(p, "Tier"),
    pipelineStage: getText(p, "Pipeline Stage"),
    outreachStatus: getText(p, "LinkedIn Outreach Status"),
    outreachOwner: getText(p, "Outreach Owner"),
    lastContactDate: getText(p, "Last Contact Date"),
    followUpDueDate: getText(p, "Follow-Up Due Date"),
    followUpOwner: getText(p, "Follow-Up Owner"),
    followUpComplete,
    notes: getText(p, "Notes"),
    profileSummary: getText(p, "Profile Summary"),
    location: getText(p, "Location"),
    experience: getText(p, "Experience"),
    education: getText(p, "Education"),
    personalizationSignals: getText(p, "Personalization Signals"),
    notionUrl: page.url,
    events: events.length > 0 ? events : undefined,
    // Enrichment fields — return "" / false when property doesn't exist in schema yet.
    about: getText(p, "About"),
    mutualConnections: getText(p, "Mutual Connections"),
    openToWork,
    connectionDegree: getText(p, "Connection Degree"),
    languages: getText(p, "Languages"),
    organizations: getText(p, "Organizations"),
    certifications: getText(p, "Certifications"),
    website: getText(p, "Website"),
    keyAchievements: getText(p, "Key Achievements"),
  };
}
