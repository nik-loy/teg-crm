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

/**
 * Computes a non-destructive property patch.
 * Only fills fields that are empty in the existing contact.
 * Never overwrites non-empty existing values.
 */
export function resolveMerge(
  incoming: Partial<{
    name: string;
    linkedinUrl: string;
    jobTitle: string;
    tier: string;
    pipelineStage: string;
    outreachStatus: string;
    notes: string;
  }>,
  existing: Contact
): NotionPatch {
  const patch: NotionPatch = {};

  if (incoming.name && !existing.name) patch["Name"] = propTitle(incoming.name);
  if (incoming.linkedinUrl && !existing.linkedinUrl) patch["LinkedIn URL"] = propUrl(incoming.linkedinUrl);
  if (incoming.jobTitle && !existing.jobTitle) patch["Job Title"] = richText(incoming.jobTitle);
  if (incoming.tier && !existing.tier) patch["Tier"] = propSelect(incoming.tier);
  if (incoming.pipelineStage && !existing.pipelineStage) patch["Pipeline Stage"] = propSelect(incoming.pipelineStage);
  if (incoming.outreachStatus && !existing.outreachStatus) patch["LinkedIn Outreach Status"] = propSelect(incoming.outreachStatus);
  if (incoming.notes && !existing.notes) patch["Notes"] = richText(incoming.notes);

  return patch;
}
