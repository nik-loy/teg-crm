import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

export async function GET() {
  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/api/contacts/stats/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[stats] Backend stats error:", errText);
      return NextResponse.json({ error: "Failed to compute stats from backend" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[stats]", e);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}

