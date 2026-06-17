import { NextResponse } from "next/server";
import { getBackendUrl, djangoToFrontendContact } from "@/lib/backend";
import { toProfileFields } from "@/lib/extraction/summary";
import type { ExtractedProfile } from "@/lib/extraction/types";
import type { Contact } from "@/lib/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const body = await req.json();
  const profile: ExtractedProfile | undefined = body.profile;
  const rawProfileText: string | undefined = body.rawProfileText;
  const backendUrl = getBackendUrl();

  // 1. Fetch existing contact from Django
  let existing: Contact;
  let rawExisting: any;
  try {
    const res = await fetch(`${backendUrl}/api/contacts/${id}/`);
    if (!res.ok) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    rawExisting = await res.json();
    existing = djangoToFrontendContact(rawExisting);
  } catch (e) {
    console.error("[contacts/[id]] Error fetching existing:", e);
    return NextResponse.json({ error: "Contact check failed" }, { status: 500 });
  }

  // 2. Build incoming fields
  let incoming: {
    jobTitle?: string;
    company?: string;
    location?: string;
    experience?: string;
    education?: string;
    personalizationSignals?: string;
    profileSummary?: string;
    about?: string;
    mutualConnections?: string;
    openToWork?: boolean;
    connectionDegree?: string;
    languages?: string;
    organizations?: string;
    certifications?: string;
    website?: string;
    keyAchievements?: string;
  };

  if (profile) {
    const f = toProfileFields(profile);
    incoming = {
      jobTitle: (body.jobTitle as string)?.trim() || f.jobTitle,
      company: f.company,
      location: f.location,
      experience: f.experience,
      education: f.education,
      personalizationSignals: f.personalizationSignals,
      profileSummary: f.profileSummary,
      about: f.about,
      mutualConnections: f.mutualConnections,
      openToWork: f.openToWork,
      connectionDegree: f.connectionDegree,
      languages: f.languages,
      organizations: f.organizations,
      certifications: f.certifications,
      website: f.website,
      keyAchievements: f.keyAchievements,
    };
  } else {
    incoming = {
      jobTitle: body.jobTitle,
      company: body.company,
      profileSummary: body.profileSummary,
    };
  }

  // 3. Merge non-destructively
  const patch: Record<string, any> = {};
  
  const mergeField = (djangoField: string, incomingValue: any, existingValue: any) => {
    if (incomingValue !== undefined && incomingValue !== null && incomingValue !== "") {
      if (!existingValue) {
        patch[djangoField] = incomingValue;
      }
    }
  };

  mergeField("job_title", incoming.jobTitle, existing.jobTitle);
  mergeField("company_name", incoming.company, existing.company);
  mergeField("location", incoming.location, existing.location);
  mergeField("experience", incoming.experience, existing.experience);
  mergeField("education", incoming.education, existing.education);
  mergeField("personalization_signals", incoming.personalizationSignals, existing.personalizationSignals);
  mergeField("profile_summary", incoming.profileSummary, existing.profileSummary);
  mergeField("about", incoming.about, existing.about);
  mergeField("mutual_connections", incoming.mutualConnections, existing.mutualConnections);
  if (incoming.openToWork && !existing.openToWork) {
    patch["open_to_work"] = true;
  }
  mergeField("connection_degree", incoming.connectionDegree, existing.connectionDegree);
  mergeField("languages", incoming.languages, existing.languages);
  mergeField("organizations", incoming.organizations, existing.organizations);
  mergeField("certifications", incoming.certifications, existing.certifications);
  mergeField("website", incoming.website, existing.website);
  mergeField("key_achievements", incoming.keyAchievements, existing.keyAchievements);

  if (rawProfileText?.trim()) {
    const today = new Date().toISOString().split("T")[0];
    const archiveHeader = `\n\n--- LinkedIn Profile Archive (${today}) ---\n`;
    patch["notes"] = (rawExisting.notes || "") + archiveHeader + rawProfileText;
  }

  const filledFields = Object.keys(patch);

  // 4. Update Django backend if there is anything to update
  if (filledFields.length > 0) {
    try {
      const res = await fetch(`${backendUrl}/api/contacts/${id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[contacts/[id]] Backend patch error:", errText);
        return NextResponse.json({ error: "Failed to update contact on backend" }, { status: 500 });
      }
    } catch (e) {
      console.error("[contacts/[id]] Network error patching contact:", e);
      return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
    }
  }

  return NextResponse.json({
    updated: filledFields.length > 0,
    archived: !!rawProfileText?.trim(),
    pageId: id,
    filledFields,
  });
}

