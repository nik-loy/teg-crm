import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

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

  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/api/contacts/${id}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pipeline_stage: stage }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[stage] Backend error:", errText);
      return NextResponse.json({ error: "Stage update failed on backend" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stage]", e);
    return NextResponse.json({ error: "Stage update failed" }, { status: 500 });
  }
}

