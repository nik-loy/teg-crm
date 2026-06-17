import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";
import type { PendingRequest } from "@/lib/extraction/pending-requests-types";

function extractJobTitle(headline: string): string {
  // "Director Strategic Accounts at Snowflake | Ex-BCG" → "Director Strategic Accounts"
  // "Agentic AI @ Personio | Founding CEO" → "Agentic AI"
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
  let body: { requests?: PendingRequest[]; owner?: string; eventName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requests, owner, eventName } = body;

  if (!Array.isArray(requests) || requests.length === 0) {
    return NextResponse.json(
      { error: "requests array is required and must be non-empty" },
      { status: 400 }
    );
  }
  if (!owner?.trim()) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const backendUrl = getBackendUrl();
  let authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    const cookieHeader = req.headers.get("cookie");
    const match = cookieHeader?.match(/(?:^|;)\s*teg_jwt\s*=\s*([^;]+)/);
    if (match) {
      authHeader = `Bearer ${match[1]}`;
    }
  }
  console.log("[pending-requests/create] authHeader:", authHeader ? `${authHeader.substring(0, 20)}...` : "null");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const created: Array<{ name: string; pageId: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const request of requests) {
    try {
      // 1. Check if name already exists in Django
      const searchRes = await fetch(`${backendUrl}/api/contacts/?name=${encodeURIComponent(request.name)}`, {
        headers,
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = Array.isArray(searchData) ? searchData : (searchData.results || []);
        if (results.length > 0) {
          skipped.push({ name: request.name, reason: "Already exists" });
          continue;
        }
      }

      // 2. Build payload and create contact
      const payload: Record<string, any> = {
        name: request.name,
        pipeline_stage: "Awareness",
        source: "LinkedIn",
        outreach_status: "Request Sent",
        last_contact_date: today,
        outreach_owner: owner,
      };

      if (request.headline) {
        payload.profile_summary = request.headline;
        const jobTitle = extractJobTitle(request.headline);
        if (jobTitle) payload.job_title = jobTitle;
        const company = extractCompany(request.headline);
        if (company) payload.notes = `Company: ${company}`;
      }

      const createRes = await fetch(`${backendUrl}/api/contacts/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        errors.push({ name: request.name, reason: `Backend failed: ${errText}` });
        continue;
      }

      const newContact = await createRes.json();
      created.push({ name: request.name, pageId: String(newContact.id) });

      // Link event attendance if eventName is specified
      if (eventName) {
        try {
          const eventRes = await fetch(`${backendUrl}/api/events/?q=${encodeURIComponent(eventName)}`, {
            headers,
          });
          if (eventRes.ok) {
            const eventData = await eventRes.json();
            const eventResults = Array.isArray(eventData) ? eventData : (eventData.results || []);
            const matchedEvent = eventResults[0];
            if (matchedEvent) {
              await fetch(`${backendUrl}/api/attendances/`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  contact: newContact.id,
                  event: matchedEvent.id,
                  fit_score: 3,
                  fit_reason: "Imported via pending connection requests",
                }),
              });
            }
          }
        } catch (err) {
          console.error("[pending-requests/create] Error creating attendance:", err);
        }
      }
    } catch (e) {
      errors.push({
        name: request.name,
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
