import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";
import { getEvent } from "@/lib/config";
import { buildFollowupPrompt, isPositiveReply } from "@/lib/message/followup";

async function generateFollowupWithGemini(
  systemPrompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    console.log("[followup/gemini] Calling gemini-2.0-flash...");
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });
    const response = await model.generateContent("Generiere die Follow-up Antwort.");
    const text = response.response.text().trim();
    console.log("[followup/gemini] Success");
    return text;
  } catch (e) {
    console.error("[followup/gemini] Error:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function POST(req: Request) {
  const geminiKey = env.geminiKey();

  if (!geminiKey) {
    return NextResponse.json(
      { error: "No AI provider configured — set GEMINI_API_KEY" },
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
    let text: string | null = null;

    if (geminiKey) {
      text = await generateFollowupWithGemini(systemPrompt, geminiKey);
    }

    if (text === null) {
      throw new Error("All AI providers failed");
    }

    const positive = isPositiveReply(reply.trim());
    return NextResponse.json({ text, positive });
  } catch (e) {
    console.error("[followup]", e);
    return NextResponse.json({ error: "Follow-up generation failed" }, { status: 500 });
  }
}
