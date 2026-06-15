import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { queryAll } from "@/lib/notion/contacts";

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

  try {
    const dbId = env.contactsDb();
    // Fetch all contacts once, do in-memory matching — efficient for small CRM DBs
    const allContacts = await queryAll(dbId);

    const nameMap = new Map(
      allContacts.map((c) => [
        c.name.toLowerCase().trim(),
        { owner: c.outreachOwner, pageId: c.id },
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
