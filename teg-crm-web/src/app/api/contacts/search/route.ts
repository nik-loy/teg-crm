import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";
import { normalizeLinkedInUrl } from "@/app/api/contacts/route";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get("url");
  const nameParam = searchParams.get("name");

  try {
    const backendUrl = getBackendUrl();
    if (urlParam) {
      const normalized = normalizeLinkedInUrl(urlParam);
      if (!normalized) return NextResponse.json({ found: false });
      const res = await fetch(`${backendUrl}/api/contacts/?linkedin_url=${encodeURIComponent(normalized)}`);
      if (!res.ok) return NextResponse.json({ found: false });
      const data = await res.json();
      const results = Array.isArray(data) ? data : (data.results || []);
      if (results.length > 0) return NextResponse.json({ found: true, contact: results[0] });
      return NextResponse.json({ found: false });
    }
    if (nameParam) {
      const res = await fetch(`${backendUrl}/api/contacts/?name=${encodeURIComponent(nameParam)}`);
      if (!res.ok) return NextResponse.json({ found: false });
      const data = await res.json();
      const results = Array.isArray(data) ? data : (data.results || []);
      if (results.length > 0) return NextResponse.json({ found: true, pageId: String(results[0].id) });
      return NextResponse.json({ found: false });
    }
    return NextResponse.json(
      { error: "url or name param required" },
      { status: 400 }
    );
  } catch (e) {
    console.error("[contacts/search]", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
