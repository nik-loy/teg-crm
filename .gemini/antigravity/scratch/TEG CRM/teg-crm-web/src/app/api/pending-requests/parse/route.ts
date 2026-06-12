import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { parsePendingRequests } from "@/lib/extraction/parse-pending-requests";

export async function POST(req: Request) {
  let body: { pastedText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pastedText = body.pastedText?.trim();
  if (!pastedText) {
    return NextResponse.json({ error: "pastedText is required" }, { status: 400 });
  }

  // Pure-text parsing by default — zero cost, no rate limits, no API key required.
  // The Gemini fallback is OFF unless PENDING_REQUESTS_AI_FALLBACK=1 is set in the
  // environment. There is no OpenAI path at all (removed to eliminate quota/429 errors).
  const allowAiFallback = process.env.PENDING_REQUESTS_AI_FALLBACK === "1";
  const geminiKey = env.geminiKey();

  try {
    const result = await parsePendingRequests(pastedText, { geminiKey, allowAiFallback });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[pending-requests/parse]", e);
    // Return a well-formed (cost-free) result the UI can render, never an API error.
    return NextResponse.json({
      success: false,
      requests: [],
      errors: [{ reason: "Unexpected parsing error — please try again." }],
      stats: { totalLines: 0, parsed: 0, failed: 1, duplicateDetected: 0 },
    });
  }
}
