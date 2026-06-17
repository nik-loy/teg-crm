import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

export async function POST(req: Request) {
  const body = await req.json();
  const profileText: string | undefined = body.profileText;
  if (!profileText?.trim()) {
    return NextResponse.json({ error: "profileText is required" }, { status: 400 });
  }

  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/api/contacts/extract_profile/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileText: profileText.trim() }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Backend extraction failed: ${errText}` }, { status: res.status });
    }
    const profile = await res.json();
    return NextResponse.json(profile);
  } catch (e) {
    console.error("[extract]", e);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
