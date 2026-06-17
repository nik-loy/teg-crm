import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

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

  const backendUrl = getBackendUrl();
  const today = new Date().toISOString().split("T")[0];

  try {
    const existingRes = await fetch(`${backendUrl}/api/contacts/${contactId.trim()}/`);
    if (!existingRes.ok) throw new Error("Contact not found");
    const existing = await existingRes.json();

    const noteLine = `[Interaction: ${type ?? "LinkedIn Message"}] ${summary.trim()} - Next Action: ${nextAction?.trim() || "None"}\n`;
    
    await fetch(`${backendUrl}/api/contacts/${contactId.trim()}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_contact_date: today,
        outreach_status: "Messaged",
        notes: (existing.notes || "") + "\n" + noteLine,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[interactions]", e);
    return NextResponse.json({ error: "Failed to log interaction" }, { status: 500 });
  }
}
