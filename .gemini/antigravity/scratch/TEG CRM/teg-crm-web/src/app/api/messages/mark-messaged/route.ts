import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import { title, richText, select, date, multiSelect } from "@/lib/notion/props";
import { queryAll } from "@/lib/notion/contacts";
import type { Contact } from "@/lib/types";

async function findContactByName(name: string, dbId: string): Promise<Contact | undefined> {
  const needle = name.toLowerCase();
  const results = await withRetry(() =>
    queryAll(dbId, {
      property: "Name",
      title: { contains: name },
    })
  );
  return results.find((c) => c.name.toLowerCase() === needle);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  let body: { names?: string[]; owner?: string; eventName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { names, owner, eventName } = body;

  if (!Array.isArray(names) || names.length === 0) {
    return NextResponse.json(
      { error: "names array is required and must be non-empty" },
      { status: 400 }
    );
  }
  if (!owner?.trim()) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }

  const dbId = env.contactsDb();
  const today = new Date().toISOString().split("T")[0];

  const updated: string[] = [];
  const createdMinimal: string[] = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const name of names) {
    try {
      const contact = await findContactByName(name, dbId);

      if (contact) {
        // Update existing contact: set Messaged status, refresh date, append event.
        const existingEvents = contact.events ?? [];
        const mergedEvents =
          eventName && !existingEvents.includes(eventName)
            ? [...existingEvents, eventName]
            : existingEvents;

        const updateProps: Record<string, unknown> = {
          "LinkedIn Outreach Status": select("Messaged"),
          "Last Contact Date": date(today),
        };
        if (mergedEvents.length > 0) {
          updateProps["Events"] = multiSelect(mergedEvents);
        }

        await withRetry(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          notion().pages.update({ page_id: contact.id, properties: updateProps as any })
        );
        updated.push(name);
      } else {
        // Create minimal contact — flagged so the UI can warn the rep.
        const createProps: Record<string, unknown> = {
          Name: title(name),
          "Pipeline Stage": select("Awareness"),
          Source: select("LinkedIn"),
          "LinkedIn Outreach Status": select("Messaged"),
          "Last Contact Date": date(today),
          "Contact Source": select("Messages Paste"),
        };
        if (owner) createProps["Outreach Owner"] = richText(owner);
        if (eventName) createProps["Events"] = multiSelect([eventName]);

        await withRetry(() =>
          notion().pages.create({
            parent: { database_id: dbId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            properties: createProps as any,
          })
        );
        createdMinimal.push(name);
      }

      await sleep(350); // respect Notion 3 req/s rate limit
    } catch (e) {
      errors.push({
        name,
        reason: e instanceof Error ? e.message : "Unknown error",
      });
      await sleep(350);
    }
  }

  return NextResponse.json({
    updated: updated.length,
    created: createdMinimal.length,
    createdMinimal,
    failed: errors.length,
    errors,
  });
}
