import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { getEvent } from "@/lib/config";
import { buildFollowupPrompt, isPositiveReply } from "@/lib/message/followup";

export async function POST(req: Request) {
  const apiKey = env.openaiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 501 }
    );
  }

  const body = await req.json();
  const { contactId, reply, anrede } = body as {
    contactId?: string;
    reply?: string;
    anrede?: "Du" | "Sie";
  };

  if (!contactId?.trim() || !reply?.trim()) {
    return NextResponse.json(
      { error: "contactId and reply are required" },
      { status: 400 }
    );
  }

  const event = getEvent();
  const resolvedAnrede: "Du" | "Sie" =
    anrede === "Du" || anrede === "Sie" ? anrede : "Sie";
  const systemPrompt = buildFollowupPrompt(event, reply.trim(), resolvedAnrede);

  try {
    const client = new OpenAI({ apiKey });
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generiere die Follow-up Antwort." },
      ],
    });

    const text = resp.choices[0].message.content?.trim() ?? "";
    const positive = isPositiveReply(reply.trim());

    return NextResponse.json({ text, positive });
  } catch (e) {
    console.error("[followup]", e);
    return NextResponse.json({ error: "Follow-up generation failed" }, { status: 500 });
  }
}
