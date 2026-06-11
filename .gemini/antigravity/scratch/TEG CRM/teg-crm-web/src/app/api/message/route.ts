import { NextResponse } from "next/server";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import { pageToContact } from "@/lib/notion/map";
import { generateMessage } from "@/lib/message/generate";

export async function POST(req: Request) {
  const geminiKey = env.geminiKey();
  const openaiKey = env.openaiKey();

  if (!geminiKey && !openaiKey) {
    return NextResponse.json(
      { error: "No AI provider configured — set GEMINI_API_KEY or OPENAI_API_KEY" },
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
    const page = await withRetry(() =>
      notion().pages.retrieve({ page_id: contactId.trim() })
    );
    contact = pageToContact(page as PageObjectResponse);
  } catch {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  try {
    const result = await generateMessage(
      contact,
      profileText?.trim() ?? "",
      owner?.trim() ?? "",
      geminiKey,
      openaiKey
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[message]", e);
    return NextResponse.json({ error: "Message generation failed" }, { status: 500 });
  }
}
