import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getBackendUrl, djangoToFrontendContact } from "@/lib/backend";
import { generateMessage } from "@/lib/message/generate";

export async function POST(req: Request) {
  const geminiKey = env.geminiKey();

  if (!geminiKey) {
    return NextResponse.json(
      { error: "No AI provider configured — set GEMINI_API_KEY" },
      { status: 501 }
    );
  }

  const body = await req.json();
  const { contactId, profileText, owner } = body as {
    contactId?: string;
    profileText?: string;
    owner?: string;
  };

  if (!contactId?.trim()) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  let contact;
  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/contacts/${contactId.trim()}/`);
    if (!res.ok) throw new Error("Contact not found");
    const djangoContact = await res.json();
    contact = djangoToFrontendContact(djangoContact);
  } catch {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Reuse the profile captured at enrich time when the rep doesn't paste one,
  // so the same clean, repost-free profile drives messaging (no double paste).
  const effectiveProfile = profileText?.trim() || contact.profileSummary?.trim() || "";

  try {
    const result = await generateMessage(
      contact,
      effectiveProfile,
      owner?.trim() ?? "",
      geminiKey
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[message]", e);
    return NextResponse.json({ error: "Message generation failed" }, { status: 500 });
  }
}
