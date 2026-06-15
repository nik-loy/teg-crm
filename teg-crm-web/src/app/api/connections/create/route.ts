import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import { title, richText, select, date, multiSelect } from "@/lib/notion/props";
import { findByName } from "@/lib/notion/contacts";
import type { Connection } from "@/lib/extraction/connections-types";

function extractJobTitle(headline: string): string {
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
  let body: {
    connections?: Connection[];
    owner?: string;
    eventName?: string;
    outreachStatus?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { connections, owner, eventName, outreachStatus = "Connected" } = body;

  if (!Array.isArray(connections) || connections.length === 0) {
    return NextResponse.json(
      { error: "connections array is required and must be non-empty" },
      { status: 400 }
    );
  }
  if (!owner?.trim()) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }

  const validStatuses = ["Connected", "Messaged"];
  const resolvedStatus = validStatuses.includes(outreachStatus) ? outreachStatus : "Connected";

  const dbId = env.contactsDb();
  const today = new Date().toISOString().split("T")[0];

  const created: Array<{ name: string; pageId: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const connection of connections) {
    try {
      const existingId = await withRetry(() => findByName(connection.name, dbId));
      if (existingId) {
        skipped.push({ name: connection.name, reason: "Already exists" });
        await sleep(350);
        continue;
      }

      const props: Record<string, unknown> = {
        Name: title(connection.name),
        "Pipeline Stage": select("Awareness"),
        Source: select("LinkedIn"),
        "LinkedIn Outreach Status": select(resolvedStatus),
        "Last Contact Date": date(connection.connectedOn || today),
        "Contact Source": select("Connections Paste"),
      };

      if (owner) props["Outreach Owner"] = richText(owner);

      if (connection.headline) {
        props["Profile Summary"] = richText(connection.headline);
        const jobTitle = extractJobTitle(connection.headline);
        if (jobTitle) props["Job Title"] = richText(jobTitle);
        const company = extractCompany(connection.headline);
        if (company) props["Notes"] = richText(`Company: ${company}`);
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

      created.push({ name: connection.name, pageId: page.id });
      await sleep(350);
    } catch (e) {
      errors.push({
        name: connection.name,
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
