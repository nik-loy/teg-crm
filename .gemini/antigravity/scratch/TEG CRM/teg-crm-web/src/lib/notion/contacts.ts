import type { QueryDatabaseParameters } from "@notionhq/client/build/src/api-endpoints";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion, withRetry } from "./client";
import { pageToContact } from "./map";
import type { Contact } from "../types";
import { title as propTitle, richText, select as propSelect, url as propUrl } from "./props";

const STALE_REQUEST_DAYS = parseInt(process.env.STALE_REQUEST_DAYS ?? "5", 10);

export async function queryAll(
  dbId: string,
  filter?: QueryDatabaseParameters["filter"]
): Promise<Contact[]> {
  const contacts: Contact[] = [];
  let cursor: string | undefined;
  do {
    const res = await withRetry(() =>
      notion().databases.query({
        database_id: dbId,
        filter,
        start_cursor: cursor,
        page_size: 100,
      })
    );
    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        contacts.push(pageToContact(page as PageObjectResponse));
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return contacts;
}

export interface TodayBuckets {
  noMessage: Contact[];       // Connected, not yet Messaged
  staleRequests: Contact[];   // Request Sent > STALE_REQUEST_DAYS old
  dueFollowups: Contact[];    // Follow-Up Due Date <= today AND not complete
  replies: Contact[];         // has a Notes value containing "reply:" (v1 signal)
}

export async function getTodayBuckets(dbId: string, owner?: string): Promise<TodayBuckets> {
  const today = new Date().toISOString().split("T")[0];

  // Bucket 1: Connected (no message sent yet)
  const noMessage = await queryAll(dbId, {
    property: "LinkedIn Outreach Status",
    select: { equals: "Connected" },
  });

  // Bucket 2: Request Sent — filter by age client-side (Notion can't filter created_time)
  const requestSent = await queryAll(dbId, {
    property: "LinkedIn Outreach Status",
    select: { equals: "Request Sent" },
  });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_REQUEST_DAYS);
  const staleRequests = requestSent.filter((c) => {
    if (!c.lastContactDate) return true; // no date = never followed up = always stale
    return new Date(c.lastContactDate) < cutoff;
  });

  // Bucket 3: Due follow-ups
  const dueFollowups = await queryAll(dbId, {
    and: [
      { property: "Follow-Up Due Date", date: { on_or_before: today } },
      { property: "Follow-Up Complete", checkbox: { equals: false } },
    ],
  });

  // Bucket 4: Replies — v1: contacts with a Notes value that includes "reply:"
  const replies = await queryAll(dbId, {
    property: "Notes",
    rich_text: { contains: "reply:" },
  });

  // Apply owner filter if provided
  const byOwner = (contacts: Contact[]) =>
    owner
      ? contacts.filter((c) =>
          c.outreachOwner.toLowerCase().includes(owner.toLowerCase())
        )
      : contacts;

  return {
    noMessage: byOwner(noMessage),
    staleRequests: byOwner(staleRequests),
    dueFollowups: byOwner(dueFollowups),
    replies: byOwner(replies),
  };
}

/**
 * Finds a contact by exact LinkedIn URL match.
 * Returns the Notion page id, or undefined if not found.
 */
export async function findByUrl(linkedinUrl: string, dbId: string): Promise<string | undefined> {
  const results = await queryAll(dbId, {
    property: "LinkedIn URL",
    url: { equals: linkedinUrl },
  });
  return results[0]?.id;
}

/**
 * Finds a contact by case-insensitive name match.
 * Returns the Notion page id, or undefined if not found.
 * Weak key — use only when LinkedIn URL is not available.
 */
export async function findByName(name: string, dbId: string): Promise<string | undefined> {
  const needle = name.toLowerCase();
  const results = await queryAll(dbId, {
    property: "Name",
    title: { contains: name },
  });
  const match = results.find((c) => c.name.toLowerCase() === needle);
  return match?.id;
}

type NotionPatch = Record<string, unknown>;

export type MergeInput = Partial<{
  name: string;
  linkedinUrl: string;
  jobTitle: string;
  company: string;
  profileSummary: string;
  location: string;
  experience: string;
  education: string;
  personalizationSignals: string;
  tier: string;
  pipelineStage: string;
  outreachStatus: string;
  notes: string;
}>;

/**
 * Computes a non-destructive property patch.
 * Only fills fields that are EMPTY in the existing contact; never overwrites a
 * value already present.  May reference additive properties (Location,
 * Experience, Education, Personalization Signals) — `filterPatchToSchema` then
 * drops any whose Notion property doesn't exist, and the content is preserved
 * in the lossless Profile Summary regardless.
 */
export function resolveMerge(incoming: MergeInput, existing: Contact): NotionPatch {
  const patch: NotionPatch = {};

  if (incoming.name && !existing.name) patch["Name"] = propTitle(incoming.name);
  if (incoming.linkedinUrl && !existing.linkedinUrl) patch["LinkedIn URL"] = propUrl(incoming.linkedinUrl);
  if (incoming.jobTitle && !existing.jobTitle) patch["Job Title"] = richText(incoming.jobTitle);
  // Company → Notes, only if Notes is empty (don't clobber an existing note);
  // company is also captured losslessly in Profile Summary.
  if (incoming.company && !existing.notes) patch["Notes"] = richText(`Company: ${incoming.company}`);
  if (incoming.location && !existing.location) patch["Location"] = richText(incoming.location);
  if (incoming.experience && !existing.experience) patch["Experience"] = richText(incoming.experience);
  if (incoming.education && !existing.education) patch["Education"] = richText(incoming.education);
  if (incoming.personalizationSignals && !existing.personalizationSignals)
    patch["Personalization Signals"] = richText(incoming.personalizationSignals);
  // Gating fixed: was checking `!existing.notes` (wrong field).
  if (incoming.profileSummary && !existing.profileSummary) patch["Profile Summary"] = richText(incoming.profileSummary);
  if (incoming.tier && !existing.tier) patch["Tier"] = propSelect(incoming.tier);
  if (incoming.pipelineStage && !existing.pipelineStage) patch["Pipeline Stage"] = propSelect(incoming.pipelineStage);
  if (incoming.outreachStatus && !existing.outreachStatus) patch["LinkedIn Outreach Status"] = propSelect(incoming.outreachStatus);
  if (incoming.notes && !existing.notes) patch["Notes"] = richText(incoming.notes);

  return patch;
}

// Cache the Contacts DB property set per process so we read the schema at most
// once.  Used to skip writes to additive properties that haven't been added to
// the Notion DB (their content still lands in Profile Summary — nothing lost).
const schemaCache = new Map<string, Set<string>>();

export async function getContactSchema(dbId: string): Promise<Set<string>> {
  const cached = schemaCache.get(dbId);
  if (cached) return cached;
  const db = await withRetry(() => notion().databases.retrieve({ database_id: dbId }));
  const props = new Set(
    Object.keys((db as { properties?: Record<string, unknown> }).properties ?? {})
  );
  schemaCache.set(dbId, props);
  return props;
}

/** Drops patch keys whose Notion property doesn't exist in the DB schema. */
export function filterPatchToSchema(patch: NotionPatch, props: Set<string>): NotionPatch {
  const out: NotionPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (props.has(key)) out[key] = value;
  }
  return out;
}

// Additive rich-text fields the enrichment flow relies on. Auto-created on first
// save so Experience/Education become real Notion columns and the lossless
// Profile Summary always has a home. Adding empty columns is non-destructive and
// reversible; if the integration can't update the schema this is a no-op and
// content still falls back to Profile Summary / the raw page-body archive.
export const ADDITIVE_CONTACT_FIELDS = [
  "Location",
  "Experience",
  "Education",
  "Personalization Signals",
  "Profile Summary",
] as const;

export async function ensureContactSchema(dbId: string): Promise<Set<string>> {
  const props = await getContactSchema(dbId);
  const missing = ADDITIVE_CONTACT_FIELDS.filter((p) => !props.has(p));
  if (missing.length === 0) return props;
  try {
    const toAdd: Record<string, unknown> = {};
    for (const p of missing) toAdd[p] = { rich_text: {} };
    await withRetry(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notion().databases.update({ database_id: dbId, properties: toAdd as any })
    );
    for (const p of missing) props.add(p);
    schemaCache.set(dbId, props);
  } catch (e) {
    console.error(
      "[ensureContactSchema] could not auto-create fields (falling back to Profile Summary):",
      e instanceof Error ? e.message : e
    );
  }
  return props;
}

/** Appends verbatim raw-paste blocks to a contact's Notion page body. */
export async function archiveRawProfile(pageId: string, blocks: unknown[]): Promise<void> {
  if (!blocks.length) return;
  await withRetry(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notion().blocks.children.append({ block_id: pageId, children: blocks as any })
  );
}
