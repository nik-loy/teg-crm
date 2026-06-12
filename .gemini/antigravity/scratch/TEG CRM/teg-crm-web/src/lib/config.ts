import eventData from "../../config/event.json";
import teamData from "../../config/team.json";
import eventsRegistryData from "../../config/events-registry.json";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Speaker {
  name: string;
  company: string;
}

export interface AgendaItem {
  time: string;
  title: string;
}

export interface MessageExample {
  label: string;
  text: string;
}

export interface FollowupExample {
  trigger: string;
  response: string;
  sie_variant: string;
}

export interface EventConfig {
  name: string;
  date: string;
  location: string;
  luma_url: string;
  intern_companies: string[];
  speakers: Speaker[];
  agenda: AgendaItem[];
  risk_tiers: Record<string, string>;
  personalization_keywords: string[];
  opening_lines: { du: string[]; sie: string[] };
  closing_lines: { du: string[]; sie: string[] };
  message_examples: MessageExample[];
  followup_examples: FollowupExample[];
}

export interface TeamMember {
  notion_id: string;
  name: string;
  email: string;
  utm_source: string;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Returns the event configuration object. */
export function getEvent(): EventConfig {
  return eventData as EventConfig;
}

/**
 * Returns the list of selectable event names from the central registry.
 *
 * To add a new event for the entire CRM, append its name to
 * `config/events-registry.json`. No code changes required.
 */
export function getEventsRegistry(): string[] {
  return eventsRegistryData as string[];
}

/** Returns all team members. */
export function getTeam(): TeamMember[] {
  return teamData as TeamMember[];
}

/**
 * Looks up a team member by name (case-insensitive) and returns their
 * utm_source. Falls back to "utm" if no match is found.
 */
export function utmFor(name: string): string {
  const needle = name.toLowerCase();
  const member = getTeam().find((m) => m.name.toLowerCase() === needle);
  if (!member) console.warn(`utmFor: no team member named "${name}" — falling back to "utm"`);
  return member?.utm_source ?? "utm";
}

/** Companies excluded from outreach by default. */
export const DEFAULT_BLACKLIST: string[] = [
  "Netlight",
  "Oliver Wyman",
  "Accenture",
];

/**
 * Returns the deduplicated blacklist, merging DEFAULT_BLACKLIST with any
 * additional companies specified in the OUTREACH_BLACKLIST_COMPANIES env var
 * (comma-separated).
 */
export function getBlacklist(): string[] {
  const envRaw = process.env.OUTREACH_BLACKLIST_COMPANIES ?? "";
  const fromEnv = envRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_BLACKLIST, ...fromEnv])];
}
