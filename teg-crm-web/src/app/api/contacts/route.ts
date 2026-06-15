import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  findByName,
  queryAll,
  resolveMerge,
  ensureContactSchema,
  filterPatchToSchema,
  archiveRawProfile,
  type MergeInput,
} from "@/lib/notion/contacts";
import { notion, withRetry } from "@/lib/notion/client";
import { title, richText, select, url as propUrl, date, multiSelect, checkbox as checkboxProp } from "@/lib/notion/props";
import { pageToContact } from "@/lib/notion/map";
import { extractNameFromLinkedInUrl } from "@/lib/linkedin-utils";
import { toProfileFields } from "@/lib/extraction/summary";
import { buildProfileArchiveBlocks } from "@/lib/notion/profile-archive";
import type { ExtractedProfile } from "@/lib/extraction/types";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export function normalizeLinkedInUrl(raw: string): string {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!u.hostname.endsWith("linkedin.com")) return "";
    return `https://linkedin.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

const STATUS_MAP: Record<string, string> = {
  request_sent: "Request Sent",
  connected: "Connected",
  messaged: "Messaged",
};

export async function POST(req: Request) {
  const body = await req.json();
  const { name: providedName, jobTitle, tier, status, owner, notes, company, events } = body;
  const profile: ExtractedProfile | undefined = body.profile;
  const rawProfileText: string | undefined = body.rawProfileText;
  const rawUrl: string | undefined = body.url;

  // Structured fields derived from the extraction (if a profile was pasted).
  const fields = profile ? toProfileFields(profile) : null;
  const profileSummary: string | undefined = fields?.profileSummary ?? body.profileSummary;

  // Resolve the contact name from multiple sources.
  let name = providedName?.trim() || "";
  if (!name && profile?.name) name = profile.name.trim();
  if (!name && rawUrl) name = extractNameFromLinkedInUrl(rawUrl);
  if (!name) {
    return NextResponse.json(
      { error: "Cannot determine contact name. Please provide a name, LinkedIn URL, or paste a profile." },
      { status: 400 }
    );
  }

  const dbId = env.contactsDb();
  const linkedinUrl = rawUrl ? normalizeLinkedInUrl(rawUrl) : "";
  const today = new Date().toISOString().split("T")[0];

  // Non-destructive incoming patch built from the extraction.
  const incoming: MergeInput = fields
    ? {
        jobTitle: jobTitle?.trim() || fields.jobTitle,
        company: fields.company,
        location: fields.location,
        experience: fields.experience,
        education: fields.education,
        personalizationSignals: fields.personalizationSignals,
        profileSummary: fields.profileSummary,
        about: fields.about,
        mutualConnections: fields.mutualConnections,
        openToWork: fields.openToWork,
        connectionDegree: fields.connectionDegree,
        languages: fields.languages,
        organizations: fields.organizations,
        certifications: fields.certifications,
        website: fields.website,
        keyAchievements: fields.keyAchievements,
      }
    : { jobTitle, company, profileSummary };

  // 1. Dedup by URL — enrich the existing contact instead of duplicating.
  if (linkedinUrl) {
    const contacts = await queryAll(dbId, { property: "LinkedIn URL", url: { equals: linkedinUrl } });
    const existing = contacts[0];
    if (existing) {
      const patch = resolveMerge({ name, linkedinUrl, tier, ...incoming }, existing);
      const schema = await ensureContactSchema(dbId);
      const safePatch = filterPatchToSchema(patch, schema);
      if (Object.keys(safePatch).length > 0) {
        await withRetry(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          notion().pages.update({ page_id: existing.id, properties: safePatch as any })
        );
      }
      if (rawProfileText?.trim()) {
        await archiveRawProfile(existing.id, buildProfileArchiveBlocks(rawProfileText, today));
      }
      return Object.keys(safePatch).length > 0
        ? NextResponse.json({ merged: true, pageId: existing.id })
        : NextResponse.json({ existing: true, pageId: existing.id });
    }
  }

  // 2. Dedup by name (weak key — report, don't merge).
  const nameMatchId = await findByName(name.trim(), dbId);
  if (nameMatchId) {
    return NextResponse.json({ existing: true, pageId: nameMatchId });
  }

  // 3. Create a new contact.
  const baseProps: Record<string, unknown> = {
    Name: title(name.trim()),
    "Pipeline Stage": select("Awareness"),
    Source: select("LinkedIn"),
    "Last Contact Date": date(today),
    "LinkedIn Outreach Status": select(STATUS_MAP[status ?? ""] ?? "Request Sent"),
  };
  if (linkedinUrl) baseProps["LinkedIn URL"] = propUrl(linkedinUrl);
  if (tier) baseProps["Tier"] = select(tier);
  if (owner) baseProps["Outreach Owner"] = richText(owner);
  if (events && events.length > 0) baseProps["Events"] = multiSelect(events);

  // Structured fields (job title, location, experience, education, signals,
  // summary). Schema-aware: additive properties that don't exist are dropped —
  // their content still lives in Profile Summary, so nothing is lost.
  const structured: Record<string, unknown> = {};
  const jt = incoming.jobTitle;
  if (jt) structured["Job Title"] = richText(jt);
  if (incoming.location) structured["Location"] = richText(incoming.location);
  if (incoming.experience) structured["Experience"] = richText(incoming.experience);
  if (incoming.education) structured["Education"] = richText(incoming.education);
  if (incoming.personalizationSignals) structured["Personalization Signals"] = richText(incoming.personalizationSignals);
  if (profileSummary) structured["Profile Summary"] = richText(profileSummary);
  if (incoming.about) structured["About"] = richText(incoming.about);
  if (incoming.mutualConnections) structured["Mutual Connections"] = richText(incoming.mutualConnections);
  if (incoming.openToWork) structured["Open to Work"] = checkboxProp(true);
  if (incoming.connectionDegree) structured["Connection Degree"] = select(incoming.connectionDegree);
  if (incoming.languages) structured["Languages"] = richText(incoming.languages);
  if (incoming.organizations) structured["Organizations"] = richText(incoming.organizations);
  if (incoming.certifications) structured["Certifications"] = richText(incoming.certifications);
  if (incoming.website) structured["Website"] = propUrl(incoming.website);
  if (incoming.keyAchievements) structured["Key Achievements"] = richText(incoming.keyAchievements);
  // Company (and any manual note) → Notes.
  const noteText = notes || (incoming.company ? `Company: ${incoming.company}` : "");
  if (noteText) structured["Notes"] = richText(noteText);

  const schema = await ensureContactSchema(dbId);
  Object.assign(baseProps, filterPatchToSchema(structured, schema));

  const page = await withRetry(() =>
    notion().pages.create({
      parent: { database_id: dbId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: baseProps as any,
    })
  );

  if (rawProfileText?.trim()) {
    await archiveRawProfile(page.id, buildProfileArchiveBlocks(rawProfileText, today));
  }

  const contact = pageToContact(page as PageObjectResponse);
  return NextResponse.json({ created: true, pageId: page.id, notionUrl: contact.notionUrl });
}
