import { NextResponse } from "next/server";
import { getBackendUrl, djangoToFrontendContact } from "@/lib/backend";
import { extractNameFromLinkedInUrl } from "@/lib/linkedin-utils";
import { toProfileFields } from "@/lib/extraction/summary";
import type { ExtractedProfile } from "@/lib/extraction/types";
import type { Contact } from "@/lib/types";

export function normalizeLinkedInUrl(raw: string): string {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!u.hostname.endsWith("linkedin.com")) return "";
    return `https://linkedin.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

const STATUS_MAP: Record<string, string> = {
  request_sent: "Request Sent",
  connected: "Connected",
  messaged: "Messaged",
};

export async function POST(req: Request) {
  const body = await req.json();
  const { name: providedName, jobTitle, tier, status, owner, notes, company, events } = body;
  const profile: ExtractedProfile | undefined = body.profile;
  const rawProfileText: string | undefined = body.rawProfileText;
  const rawUrl: string | undefined = body.url;

  // Structured fields derived from the extraction (if a profile was pasted).
  const fields = profile ? toProfileFields(profile) : null;
  const profileSummary: string | undefined = fields?.profileSummary ?? body.profileSummary;

  // Resolve the contact name from multiple sources.
  let name = providedName?.trim() || "";
  if (!name && profile?.name) name = profile.name.trim();
  if (!name && rawUrl) name = extractNameFromLinkedInUrl(rawUrl);
  if (!name) {
    return NextResponse.json(
      { error: "Cannot determine contact name. Please provide a name, LinkedIn URL, or paste a profile." },
      { status: 400 }
    );
  }

  const linkedinUrl = rawUrl ? normalizeLinkedInUrl(rawUrl) : "";
  const today = new Date().toISOString().split("T")[0];
  const backendUrl = getBackendUrl();

  // Non-destructive incoming patch built from the extraction.
  const incoming: Record<string, any> = fields
    ? {
        job_title: jobTitle?.trim() || fields.jobTitle,
        company_name: fields.company,
        location: fields.location,
        experience: fields.experience,
        education: fields.education,
        personalization_signals: fields.personalizationSignals,
        profile_summary: fields.profileSummary,
        about: fields.about,
        mutual_connections: fields.mutualConnections,
        open_to_work: fields.openToWork,
        connection_degree: fields.connectionDegree,
        languages: fields.languages,
        organizations: fields.organizations,
        certifications: fields.certifications,
        website: fields.website,
        key_achievements: fields.keyAchievements,
      }
    : {
        job_title: jobTitle,
        company_name: company,
        profile_summary: profileSummary,
      };

  // 1. Dedup by URL — enrich the existing contact instead of duplicating.
  if (linkedinUrl) {
    try {
      const searchRes = await fetch(`${backendUrl}/api/contacts/?linkedin_url=${encodeURIComponent(linkedinUrl)}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = Array.isArray(searchData) ? searchData : (searchData.results || []);
        const existingRaw = results[0];
        if (existingRaw) {
          const existing = djangoToFrontendContact(existingRaw);
          const patch: Record<string, any> = {};

          const mergeField = (djangoField: string, incomingValue: any, existingValue: any) => {
            if (incomingValue !== undefined && incomingValue !== null && incomingValue !== "") {
              if (!existingValue) {
                patch[djangoField] = incomingValue;
              }
            }
          };

          mergeField("name", name, existing.name);
          mergeField("job_title", incoming.job_title, existing.jobTitle);
          mergeField("company_name", incoming.company_name, existing.company);
          mergeField("location", incoming.location, existing.location);
          mergeField("experience", incoming.experience, existing.experience);
          mergeField("education", incoming.education, existing.education);
          mergeField("personalization_signals", incoming.personalization_signals, existing.personalizationSignals);
          mergeField("profile_summary", incoming.profile_summary, existing.profileSummary);
          mergeField("about", incoming.about, existing.about);
          mergeField("mutual_connections", incoming.mutual_connections, existing.mutualConnections);
          if (incoming.open_to_work && !existing.openToWork) {
            patch["open_to_work"] = true;
          }
          mergeField("connection_degree", incoming.connection_degree, existing.connectionDegree);
          mergeField("languages", incoming.languages, existing.languages);
          mergeField("organizations", incoming.organizations, existing.organizations);
          mergeField("certifications", incoming.certifications, existing.certifications);
          mergeField("website", incoming.website, existing.website);
          mergeField("key_achievements", incoming.key_achievements, existing.keyAchievements);

          if (tier && !existing.tier) patch["tier"] = tier;

          if (rawProfileText?.trim()) {
            const archiveHeader = `\n\n--- LinkedIn Profile Archive (${today}) ---\n`;
            patch["notes"] = (existingRaw.notes || "") + archiveHeader + rawProfileText;
          }

          if (Object.keys(patch).length > 0) {
            const updateRes = await fetch(`${backendUrl}/api/contacts/${existing.id}/`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch),
            });
            if (!updateRes.ok) {
              console.error("[contacts/post] Merge failed:", await updateRes.text());
            }
          }

          return NextResponse.json({ merged: true, pageId: existing.id });
        }
      }
    } catch (e) {
      console.error("[contacts/post] Error deduping by URL:", e);
    }
  }

  // 2. Dedup by name (weak key — report, don't merge).
  if (name) {
    try {
      const nameRes = await fetch(`${backendUrl}/api/contacts/?name=${encodeURIComponent(name.trim())}`);
      if (nameRes.ok) {
        const nameData = await nameRes.json();
        const results = Array.isArray(nameData) ? nameData : (nameData.results || []);
        const nameMatch = results[0];
        if (nameMatch) {
          return NextResponse.json({ existing: true, pageId: String(nameMatch.id) });
        }
      }
    } catch (e) {
      console.error("[contacts/post] Error deduping by name:", e);
    }
  }

  // 3. Create a new contact.
  const payload: Record<string, any> = {
    name: name.trim(),
    pipeline_stage: "Awareness",
    source: "LinkedIn",
    last_contact_date: today,
    outreach_status: STATUS_MAP[status ?? ""] ?? "Request Sent",
    ...incoming,
  };

  if (linkedinUrl) payload.linkedin_url = linkedinUrl;
  if (tier) payload.tier = tier;
  if (owner) payload.outreach_owner = owner;
  
  // Note/company mapping
  const noteText = notes || (incoming.company_name ? `Company: ${incoming.company_name}` : "");
  if (noteText) payload.notes = noteText;

  if (rawProfileText?.trim()) {
    const archiveHeader = `\n\n--- LinkedIn Profile Archive (${today}) ---\n`;
    payload.notes = (payload.notes || "") + archiveHeader + rawProfileText;
  }

  try {
    const createRes = await fetch(`${backendUrl}/api/contacts/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("[contacts/post] Create error:", errText);
      return NextResponse.json({ error: "Failed to create contact on backend" }, { status: 500 });
    }

    const newContact = await createRes.json();

    // If there were events associated with the contact creation, let's log the attendance
    if (events && events.length > 0) {
      for (const eventName of events) {
        try {
          // Find the event by name/slug to link attendance
          const eventRes = await fetch(`${backendUrl}/api/events/?q=${encodeURIComponent(eventName)}`);
          if (eventRes.ok) {
            const eventData = await eventRes.json();
            const eventResults = Array.isArray(eventData) ? eventData : (eventData.results || []);
            const matchedEvent = eventResults[0];
            if (matchedEvent) {
              await fetch(`${backendUrl}/api/attendances/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contact: newContact.id,
                  event: matchedEvent.id,
                  fit_score: 3, // default fit score
                  fit_reason: "Initial import",
                }),
              });
            }
          }
        } catch (err) {
          console.error("[contacts/post] Error creating attendance:", err);
        }
      }
    }

    return NextResponse.json({ created: true, pageId: String(newContact.id), notionUrl: "" });
  } catch (e) {
    console.error("[contacts/post] Create request error:", e);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}

