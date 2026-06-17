import { NextResponse } from "next/server";
import { getBackendUrl, djangoToFrontendContact } from "@/lib/backend";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") || "";
  const tier = searchParams.get("tier") || "";
  const owner = searchParams.get("owner") || "";
  const event = searchParams.get("event") || "";
  const q = searchParams.get("q") || "";

  const backendUrl = getBackendUrl();
  const url = new URL(`${backendUrl}/api/contacts/`);
  
  if (stage) url.searchParams.append("stage", stage);
  if (tier) url.searchParams.append("tier", tier);
  if (owner) url.searchParams.append("owner", owner);
  if (event) url.searchParams.append("event", event);
  if (q) url.searchParams.append("q", q);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[contacts/list] Backend returned error:", errText);
      return NextResponse.json({ error: "Failed to load contacts from backend" }, { status: 500 });
    }

    const data = await res.json();
    // Support paginated or unpaginated results
    const results = Array.isArray(data) ? data : (data.results || []);
    const contacts = results.map(djangoToFrontendContact);

    return NextResponse.json({
      contacts,
      nextCursor: null,
    });
  } catch (e) {
    console.error("[contacts/list]", e);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

