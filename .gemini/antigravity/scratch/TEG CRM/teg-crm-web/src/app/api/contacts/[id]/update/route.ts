import { NextResponse } from "next/server";
import { notion, withRetry } from "@/lib/notion/client";
import { select, richText } from "@/lib/notion/props";

const ALLOWED_PROPERTIES = new Set([
  "Tier",
  "LinkedIn Outreach Status",
  "Outreach Owner",
  "Notes",
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { property, value }: { property?: string; value?: string } = body;

  if (!property || !ALLOWED_PROPERTIES.has(property)) {
    return NextResponse.json(
      { error: `property must be one of: ${[...ALLOWED_PROPERTIES].join(", ")}` },
      { status: 400 }
    );
  }
  if (value === undefined || value === null) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const selectProps = new Set(["Tier", "LinkedIn Outreach Status"]);
  const notionValue = selectProps.has(property) ? select(value) : richText(value);

  try {
    await withRetry(() =>
      notion().pages.update({
        page_id: id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: { [property]: notionValue } as any,
      })
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contacts/update]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
