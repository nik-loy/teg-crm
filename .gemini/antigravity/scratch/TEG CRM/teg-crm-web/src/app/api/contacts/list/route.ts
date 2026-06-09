import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import { pageToContact } from "@/lib/notion/map";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

type PropertyFilter =
  | { property: string; select: { equals: string } }
  | { property: string; rich_text: { contains: string } }
  | { property: string; title: { contains: string } };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") || "";
  const tier = searchParams.get("tier") || "";
  const owner = searchParams.get("owner") || "";
  const q = searchParams.get("q") || "";
  const cursor = searchParams.get("cursor") || undefined;

  const dbId = env.contactsDb();

  const filters: PropertyFilter[] = [];

  if (stage) {
    filters.push({ property: "Pipeline Stage", select: { equals: stage } });
  }
  if (tier) {
    filters.push({ property: "Tier", select: { equals: tier } });
  }
  if (owner) {
    filters.push({ property: "Outreach Owner", rich_text: { contains: owner } });
  }
  if (q) {
    filters.push({ property: "Name", title: { contains: q } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any =
    filters.length === 0
      ? undefined
      : filters.length === 1
      ? filters[0]
      : { and: filters };

  try {
    const res = await withRetry(() =>
      notion().databases.query({
        database_id: dbId,
        filter,
        sorts: [{ property: "Last Contact Date", direction: "descending" }],
        page_size: 50,
        start_cursor: cursor,
      })
    );

    const contacts = res.results
      .filter((p) => p.object === "page" && "properties" in p)
      .map((p) => pageToContact(p as PageObjectResponse));

    return NextResponse.json({
      contacts,
      nextCursor: res.has_more ? res.next_cursor : null,
    });
  } catch (e) {
    console.error("[contacts/list]", e);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}
