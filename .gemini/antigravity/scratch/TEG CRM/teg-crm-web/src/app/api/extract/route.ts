import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { extractProfile } from "@/lib/extraction/extract";

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
  const profileText: string | undefined = body.profileText;
  if (!profileText?.trim()) {
    return NextResponse.json({ error: "profileText is required" }, { status: 400 });
  }

  try {
    const profile = await extractProfile(profileText.trim(), geminiKey, openaiKey);
    return NextResponse.json(profile);
  } catch (e) {
    console.error("[extract]", e);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
