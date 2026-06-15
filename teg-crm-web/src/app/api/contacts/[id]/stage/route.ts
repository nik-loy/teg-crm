import { NextResponse } from "next/server";
import { notion, withRetry } from "@/lib/notion/client";
import { select } from "@/lib/notion/props";

const VALID_STAGES = [
  "Awareness",
  "First Attendance",
  "Engaged",
  "Deepening",
  "Activated",
];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const stage: string | undefined = body.stage;

  if (!stage || !VALID_STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `stage must be one of: ${VALID_STAGES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await withRetry(() =>
      notion().pages.update({
        page_id: id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: { "Pipeline Stage": select(stage) } as any,
      })
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stage]", e);
    return NextResponse.json({ error: "Stage update failed" }, { status: 500 });
  }
}
