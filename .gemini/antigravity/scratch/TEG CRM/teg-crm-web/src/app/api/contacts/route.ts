import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { findByUrl, findByName, resolveMerge, queryAll } from "@/lib/notion/contacts";
import { notion, withRetry } from "@/lib/notion/client";
import { title, richText, select, url as propUrl, date } from "@/lib/notion/props";
import { pageToContact } from "@/lib/notion/map";
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
  const { name, jobTitle, tier, status, owner } = body;
  const rawUrl: string | undefined = body.url;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const dbId = env.contactsDb();
  const linkedinUrl = rawUrl ? normalizeLinkedInUrl(rawUrl) : "";
  const today = new Date().toISOString().split("T")[0];

  // 1. Dedup by URL
  if (linkedinUrl) {
    const existingId = await findByUrl(linkedinUrl, dbId);
    if (existingId) {
      // Try to enrich empty fields
      const contacts = await queryAll(dbId, {
        property: "LinkedIn URL",
        url: { equals: linkedinUrl },
      });
      const existing = contacts[0];
      if (existing) {
        const patch = resolveMerge(
          { name, linkedinUrl, jobTitle, tier },
          existing
        );
        if (Object.keys(patch).length > 0) {
          await withRetry(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            notion().pages.update({ page_id: existingId, properties: patch as any })
          );
          return NextResponse.json({ merged: true, pageId: existingId });
        }
      }
      return NextResponse.json({ existing: true, pageId: existingId });
    }
  }

  // 2. Dedup by name (weak — just report, don't merge)
  const nameMatchId = await findByName(name.trim(), dbId);
  if (nameMatchId) {
    return NextResponse.json({ existing: true, pageId: nameMatchId });
  }

  // 3. Create new contact
  const props: Record<string, unknown> = {
    Name: title(name.trim()),
    "Pipeline Stage": select("Awareness"),
    Source: select("LinkedIn"),
    "Last Contact Date": date(today),
    "LinkedIn Outreach Status": select(STATUS_MAP[status ?? ""] ?? "Request Sent"),
  };
  if (linkedinUrl) props["LinkedIn URL"] = propUrl(linkedinUrl);
  if (jobTitle) props["Job Title"] = richText(jobTitle);
  if (tier) props["Tier"] = select(tier);
  if (owner) props["Outreach Owner"] = richText(owner);

  const page = await withRetry(() =>
    notion().pages.create({
      parent: { database_id: dbId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: props as any,
    })
  );

  const contact = pageToContact(page as PageObjectResponse);
  return NextResponse.json({
    created: true,
    pageId: page.id,
    notionUrl: contact.notionUrl,
  });
}
