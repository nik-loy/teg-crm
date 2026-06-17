import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

export async function POST(req: Request) {
  let body: { names?: string[]; owner?: string; eventName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { names, owner, eventName } = body;

  if (!Array.isArray(names) || names.length === 0) {
    return NextResponse.json(
      { error: "names array is required and must be non-empty" },
      { status: 400 }
    );
  }
  if (!owner?.trim()) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }

  const backendUrl = getBackendUrl();
  const today = new Date().toISOString().split("T")[0];

  const updated: string[] = [];
  const createdMinimal: string[] = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const name of names) {
    try {
      const searchRes = await fetch(`${backendUrl}/api/contacts/?name=${encodeURIComponent(name.trim())}`);
      let existingId = null;
      if (searchRes.ok) {
        const data = await searchRes.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        if (results.length > 0) {
          existingId = results[0].id;
        }
      }

      if (existingId) {
        const patchRes = await fetch(`${backendUrl}/api/contacts/${existingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outreach_status: "Messaged",
            last_contact_date: today,
          }),
        });
        if (patchRes.ok) {
          updated.push(name);
          
          if (eventName) {
            // Check event and attendance
            const eventRes = await fetch(`${backendUrl}/api/events/?q=${encodeURIComponent(eventName)}`);
            if (eventRes.ok) {
              const eventData = await eventRes.json();
              const eventResults = Array.isArray(eventData) ? eventData : (eventData.results || []);
              if (eventResults.length > 0) {
                await fetch(`${backendUrl}/api/attendances/`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contact: existingId,
                    event: eventResults[0].id,
                    fit_score: 3,
                    fit_reason: "Added from messages paste",
                  }),
                });
              }
            }
          }
        } else {
          throw new Error(await patchRes.text());
        }
      } else {
        const createRes = await fetch(`${backendUrl}/api/contacts/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            pipeline_stage: "Awareness",
            source: "LinkedIn",
            outreach_status: "Messaged",
            last_contact_date: today,
            outreach_owner: owner,
          }),
        });

        if (createRes.ok) {
          const newContact = await createRes.json();
          createdMinimal.push(name);

          if (eventName) {
            const eventRes = await fetch(`${backendUrl}/api/events/?q=${encodeURIComponent(eventName)}`);
            if (eventRes.ok) {
              const eventData = await eventRes.json();
              const eventResults = Array.isArray(eventData) ? eventData : (eventData.results || []);
              if (eventResults.length > 0) {
                await fetch(`${backendUrl}/api/attendances/`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contact: newContact.id,
                    event: eventResults[0].id,
                    fit_score: 3,
                    fit_reason: "Added from messages paste",
                  }),
                });
              }
            }
          }
        } else {
          throw new Error(await createRes.text());
        }
      }
    } catch (e) {
      errors.push({
        name,
        reason: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    updated: updated.length,
    created: createdMinimal.length,
    createdMinimal,
    failed: errors.length,
    errors,
  });
}
