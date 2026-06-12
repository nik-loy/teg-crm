import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { queryAll, resolveMerge } from "@/lib/notion/contacts";
import { notion, withRetry } from "@/lib/notion/client";
import { richText } from "@/lib/notion/props";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pageId = id;
  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  const body = await req.json();
  const { jobTitle, company, profileSummary } = body;

  const dbId = env.contactsDb();

  // Fetch the existing contact
  const contacts = await queryAll(dbId, {
    property: "id",
    rich_text: { equals: pageId },
  });

  if (contacts.length === 0) {
    // Try direct fetch
    try {
      const page = (await withRetry(() =>
        notion().pages.retrieve({ page_id: pageId })
      )) as PageObjectResponse;

      const patch: Record<string, unknown> = {};
      if (jobTitle) patch["Job Title"] = richText(jobTitle);
      if (company) patch["Company"] = richText(company);
      if (profileSummary) patch["Profile Summary"] = richText(profileSummary);

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ updated: false, message: "No fields to update" });
      }

      await withRetry(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notion().pages.update({ page_id: pageId, properties: patch as any })
      );

      return NextResponse.json({ updated: true, pageId });
    } catch {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
  }

  const existing = contacts[0];
  const patch = resolveMerge(
    {
      jobTitle,
      company,
      profileSummary,
    },
    existing
  );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ updated: false, message: "No fields to update" });
  }

  await withRetry(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notion().pages.update({ page_id: pageId, properties: patch as any })
  );

  return NextResponse.json({ updated: true, pageId });
}
