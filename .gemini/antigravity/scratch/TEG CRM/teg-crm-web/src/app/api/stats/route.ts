import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { notion, withRetry } from "@/lib/notion/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

function prop(page: PageObjectResponse, key: string): unknown {
  return (page.properties as Record<string, unknown>)[key];
}

function selectName(val: unknown): string | null {
  const v = val as { select?: { name?: string } } | null;
  return v?.select?.name ?? null;
}

export async function GET() {
  const dbId = env.contactsDb();

  const byStage: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const newByMonth: Record<string, number> = {};

  let cursor: string | undefined;
  let total = 0;

  try {
    do {
      const res = await withRetry(() =>
        notion().databases.query({
          database_id: dbId,
          page_size: 100,
          start_cursor: cursor,
        })
      );

      for (const page of res.results) {
        if (page.object !== "page" || !("properties" in page)) continue;
        const p = page as PageObjectResponse;
        total += 1;

        const stage = selectName(prop(p, "Pipeline Stage"));
        if (stage) byStage[stage] = (byStage[stage] ?? 0) + 1;

        const tier = selectName(prop(p, "Tier"));
        if (tier) byTier[tier] = (byTier[tier] ?? 0) + 1;

        const source = selectName(prop(p, "Source"));
        if (source) bySource[source] = (bySource[source] ?? 0) + 1;

        const status = selectName(prop(p, "LinkedIn Outreach Status"));
        if (status) byStatus[status] = (byStatus[status] ?? 0) + 1;

        // Month bucket from page created_time
        const created: string = (p as { created_time: string }).created_time ?? "";
        if (created) {
          const month = created.slice(0, 7);
          newByMonth[month] = (newByMonth[month] ?? 0) + 1;
        }
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return NextResponse.json({
      total,
      byStage,
      byTier,
      bySource,
      byStatus,
      newByMonth: Object.fromEntries(
        Object.entries(newByMonth).sort(([a], [b]) => a.localeCompare(b))
      ),
    });
  } catch (e) {
    console.error("[stats]", e);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
