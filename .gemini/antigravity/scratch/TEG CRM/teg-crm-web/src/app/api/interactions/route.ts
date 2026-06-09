import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import { title, richText, select, date, relation } from "@/lib/notion/props";

export async function POST(req: Request) {
  const body = await req.json();
  const { contactId, summary, type, nextAction } = body as {
    contactId?: string;
    summary?: string;
    type?: string;
    nextAction?: string;
  };

  if (!contactId?.trim() || !summary?.trim()) {
    return NextResponse.json(
      { error: "contactId and summary are required" },
      { status: 400 }
    );
  }

  const interactionsDb = env.interactionsDb();
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Create Interaction page
    await withRetry(() =>
      notion().pages.create({
        parent: { database_id: interactionsDb },
        properties: {
          Summary: title(summary.trim()),
          Contact: relation(contactId.trim()),
          Date: date(today),
          Type: select(type ?? "LinkedIn Message"),
          ...(nextAction?.trim() ? { "Next Action": richText(nextAction.trim()) } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
    );

    // 2. Set Last Contact Date + flip status to Messaged
    await withRetry(() =>
      notion().pages.update({
        page_id: contactId.trim(),
        properties: {
          "Last Contact Date": date(today),
          "LinkedIn Outreach Status": select("Messaged"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[interactions]", e);
    return NextResponse.json({ error: "Failed to log interaction" }, { status: 500 });
  }
}
