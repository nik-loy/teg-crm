import { NextResponse } from "next/server";
import { parseLinkedInConnections } from "@/lib/extraction/parse-connections";

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

  try {
    const result = parseLinkedInConnections(pastedText);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[connections/parse]", e);
    return NextResponse.json({
      success: false,
      connections: [],
      errors: [{ reason: "Unexpected parsing error — please try again." }],
      stats: { totalLines: 0, parsed: 0, failed: 1, duplicateDetected: 0 },
    });
  }
}
