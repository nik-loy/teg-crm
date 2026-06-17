import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

const FIELD_MAP: Record<string, string> = {
  "Tier": "tier",
  "LinkedIn Outreach Status": "outreach_status",
  "Outreach Owner": "outreach_owner",
  "Notes": "notes",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { property, value }: { property?: string; value?: string } = body;

  if (!property || !FIELD_MAP[property]) {
    return NextResponse.json(
      { error: `property must be one of: ${Object.keys(FIELD_MAP).join(", ")}` },
      { status: 400 }
    );
  }
  if (value === undefined || value === null) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const fieldName = FIELD_MAP[property];
  const backendUrl = getBackendUrl();

  try {
    const res = await fetch(`${backendUrl}/api/contacts/${id}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [fieldName]: value }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[contacts/update] Backend error:", errText);
      return NextResponse.json({ error: "Update failed on backend" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contacts/update]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

