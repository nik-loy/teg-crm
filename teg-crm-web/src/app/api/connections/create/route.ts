import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";
import type { Connection } from "@/lib/extraction/connections-types";

function extractJobTitle(headline: string): string {
  return headline.split(/\s+at\s+|\s*[@|]/)[0].trim();
}

function extractCompany(headline: string): string {
  const atMatch = headline.match(/\bat\s+([^|@\n(]+)/i);
  if (atMatch) return atMatch[1].trim();
  const atSign = headline.match(/@\s*([^|@\n(]+)/);
  if (atSign) return atSign[1].trim();
  return "";
}

export async function POST(req: Request) {
  let body: {
    connections?: Connection[];
    owner?: string;
    eventName?: string;
    outreachStatus?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { connections, owner, eventName, outreachStatus = "Connected" } = body;

  if (!Array.isArray(connections) || connections.length === 0) {
    return NextResponse.json(
      { error: "connections array is required and must be non-empty" },
      { status: 400 }
    );
  }
  if (!owner?.trim()) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }

  const validStatuses = ["Connected", "Messaged"];
  const resolvedStatus = validStatuses.includes(outreachStatus) ? outreachStatus : "Connected";

  const backendUrl = getBackendUrl();
  const today = new Date().toISOString().split("T")[0];

  const created: Array<{ name: string; pageId: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const connection of connections) {
    try {
      const searchRes = await fetch(`${backendUrl}/api/contacts/?name=${encodeURIComponent(connection.name.trim())}`);
      let existingId = null;
      if (searchRes.ok) {
        const data = await searchRes.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        if (results.length > 0) {
          existingId = results[0].id;
        }
      }

      if (existingId) {
        skipped.push({ name: connection.name, reason: "Already exists" });
        continue;
      }

      const jobTitle = connection.headline ? extractJobTitle(connection.headline) : "";
      const company = connection.headline ? extractCompany(connection.headline) : "";
      
      const payload: any = {
        name: connection.name.trim(),
        pipeline_stage: "Awareness",
        source: "LinkedIn",
        outreach_status: resolvedStatus,
        last_contact_date: connection.connectedOn || today,
        outreach_owner: owner,
        profile_summary: connection.headline,
      };
      
      if (jobTitle) payload.job_title = jobTitle;
      if (company) payload.notes = `Company: ${company}`;

      const createRes = await fetch(`${backendUrl}/api/contacts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (createRes.ok) {
        const newContact = await createRes.json();
        created.push({ name: connection.name, pageId: String(newContact.id) });
        
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
                  fit_reason: "Added from connections paste",
                }),
              });
            }
          }
        }
      } else {
        throw new Error(await createRes.text());
      }
    } catch (e) {
      errors.push({
        name: connection.name,
        reason: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    failed: errors.length,
    createdContacts: created,
    skippedContacts: skipped,
    errors,
  });
}
