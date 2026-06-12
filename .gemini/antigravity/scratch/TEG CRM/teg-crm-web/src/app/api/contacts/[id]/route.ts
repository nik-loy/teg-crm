import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  resolveMerge,
  ensureContactSchema,
  filterPatchToSchema,
  archiveRawProfile,
  type MergeInput,
} from "@/lib/notion/contacts";
import { notion, withRetry } from "@/lib/notion/client";
import { pageToContact } from "@/lib/notion/map";
import { toProfileFields } from "@/lib/extraction/summary";
import { buildProfileArchiveBlocks } from "@/lib/notion/profile-archive";
import type { ExtractedProfile } from "@/lib/extraction/types";
import type { Contact } from "@/lib/types";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pageId } = await params;
  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  const body = await req.json();
  const profile: ExtractedProfile | undefined = body.profile;
  const rawProfileText: string | undefined = body.rawProfileText;
  const dbId = env.contactsDb();

  // Fetch the existing contact (direct retrieve — pageId is the Notion page id).
  let existing: Contact;
  try {
    const page = (await withRetry(() =>
      notion().pages.retrieve({ page_id: pageId })
    )) as PageObjectResponse;
    existing = pageToContact(page);
  } catch {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Build the non-destructive incoming patch.
  let incoming: MergeInput;
  if (profile) {
    const f = toProfileFields(profile);
    incoming = {
      jobTitle: (body.jobTitle as string)?.trim() || f.jobTitle,
      company: f.company,
      location: f.location,
      experience: f.experience,
      education: f.education,
      personalizationSignals: f.personalizationSignals,
      profileSummary: f.profileSummary,
    };
  } else {
    // Legacy / manual path.
    incoming = {
      jobTitle: body.jobTitle,
      company: body.company,
      profileSummary: body.profileSummary,
    };
  }

  const patch = resolveMerge(incoming, existing);
  const schema = await ensureContactSchema(dbId);
  const safePatch = filterPatchToSchema(patch, schema);
  const filledFields = Object.keys(safePatch);

  if (filledFields.length > 0) {
    await withRetry(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notion().pages.update({ page_id: pageId, properties: safePatch as any })
    );
  }

  // Verbatim archive of the full paste to the page body — nothing is ever lost.
  let archived = false;
  if (rawProfileText?.trim()) {
    const today = new Date().toISOString().split("T")[0];
    await archiveRawProfile(pageId, buildProfileArchiveBlocks(rawProfileText, today));
    archived = true;
  }

  return NextResponse.json({
    updated: filledFields.length > 0,
    archived,
    pageId,
    filledFields,
  });
}
