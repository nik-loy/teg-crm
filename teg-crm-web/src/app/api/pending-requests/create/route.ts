import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import { title, richText, select, date, multiSelect } from "@/lib/notion/props";
import { findByName } from "@/lib/notion/contacts";
import type { PendingRequest } from "@/lib/extraction/pending-requests-types";

function extractJobTitle(headline: string): string {
  // "Director Strategic Accounts at Snowflake | Ex-BCG" → "Director Strategic Accounts"
  // "Agentic AI @ Personio | Founding CEO" → "Agentic AI"
  return headline.split(/\s+at\s+|\s*[@|]/)[0].trim();
}

function extractCompany(headline: string): string {
  const atMatch = headline.match(/\bat\s+([^|@\n(]+)/i);
  if (atMatch) return atMatch[1].trim();
  const atSign = headline.match(/@\s*([^|@\n(]+)/);
  if (atSign) return atSign[1].trim();
  return "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  let body: { requests?: PendingRequest[]; owner?: string; eventName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requests, owner, eventName } = body;

  if (!Array.isArray(requests) || requests.length === 0) {
    return NextResponse.json(
      { error: "requests array is required and must be non-empty" },
      { status: 400 }
    );
  }
  if (!owner?.trim()) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }

  const dbId = env.contactsDb();
  const today = new Date().toISOString().split("T")[0];

  const created: Array<{ name: string; pageId: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const request of requests) {
    try {
      const existingId = await withRetry(() => findByName(request.name, dbId));
      if (existingId) {
        skipped.push({ name: request.name, reason: "Already exists" });
        await sleep(350);
        continue;
      }

      const props: Record<string, unknown> = {
        Name: title(request.name),
        "Pipeline Stage": select("Awareness"),
        Source: select("LinkedIn"),
        "LinkedIn Outreach Status": select("Request Sent"),
        "Last Contact Date": date(today),
        "Contact Source": select("Pending Requests Paste"),
      };

      if (owner) props["Outreach Owner"] = richText(owner);

      if (request.headline) {
        props["Profile Summary"] = richText(request.headline);
        const jobTitle = extractJobTitle(request.headline);
        if (jobTitle) props["Job Title"] = richText(jobTitle);
        const company = extractCompany(request.headline);
        if (company) props["Notes"] = richText(`Company: ${company}`);
      }

      if (request.sentDate) {
        props["Request Sent Date"] = date(request.sentDate);
      }

      if (eventName) {
        props["Events"] = multiSelect([eventName]);
      }

      const page = await withRetry(() =>
        notion().pages.create({
          parent: { database_id: dbId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          properties: props as any,
        })
      );

      created.push({ name: request.name, pageId: page.id });
      await sleep(350);
    } catch (e) {
      errors.push({
        name: request.name,
        reason: e instanceof Error ? e.message : "Unknown error",
      });
      await sleep(350);
    }
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    failed: errors.length,
    createdContacts: created,
    skippedContacts: skipped,
    errors,
  });
}
