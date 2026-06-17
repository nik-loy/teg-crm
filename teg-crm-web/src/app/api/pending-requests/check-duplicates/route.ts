import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

export async function POST(req: Request) {
  let body: { names?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const names = body.names;
  if (!Array.isArray(names) || names.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  let authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    const cookieHeader = req.headers.get("cookie");
    const match = cookieHeader?.match(/(?:^|;)\s*teg_jwt\s*=\s*([^;]+)/);
    if (match) {
      authHeader = `Bearer ${match[1]}`;
    }
  }
  console.log("[pending-requests/check-duplicates] authHeader:", authHeader ? `${authHeader.substring(0, 20)}...` : "null");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const backendUrl = getBackendUrl();
  try {
    // Fetch all contacts from Django backend
    const res = await fetch(`${backendUrl}/api/contacts/`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      console.error("[pending-requests/check-duplicates] Backend error:", await res.text());
      return NextResponse.json({ duplicates: [] });
    }

    const data = await res.json();
    const allContacts = Array.isArray(data) ? data : (data.results || []);

    const nameMap = new Map<string, { owner?: string; pageId: string }>(
      allContacts.map((c: any) => [
        c.name.toLowerCase().trim(),
        { owner: c.outreach_owner, pageId: String(c.id) },
      ])
    );

    const duplicates = names
      .filter((n) => nameMap.has(n.toLowerCase().trim()))
      .map((n) => {
        const match = nameMap.get(n.toLowerCase().trim())!;
        return { name: n, owner: match.owner, pageId: match.pageId };
      });

    return NextResponse.json({ duplicates });
  } catch (e) {
    console.error("[pending-requests/check-duplicates]", e);
    // Non-fatal: return empty so the UI still works if this call fails
    return NextResponse.json({ duplicates: [] });
  }
}

