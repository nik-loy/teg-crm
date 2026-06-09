import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { findByUrl, findByName, queryAll } from "@/lib/notion/contacts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get("url");
  const nameParam = searchParams.get("name");
  const dbId = env.contactsDb();

  try {
    if (urlParam) {
      const pageId = await findByUrl(urlParam, dbId);
      if (!pageId) return NextResponse.json({ found: false });
      const contacts = await queryAll(dbId, {
        property: "LinkedIn URL",
        url: { equals: urlParam },
      });
      return NextResponse.json({ found: true, contact: contacts[0] ?? null });
    }
    if (nameParam) {
      const pageId = await findByName(nameParam, dbId);
      if (!pageId) return NextResponse.json({ found: false });
      return NextResponse.json({ found: true, pageId });
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
