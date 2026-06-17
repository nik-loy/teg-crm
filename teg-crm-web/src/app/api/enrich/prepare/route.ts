import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { extractProfile } from "@/lib/extraction/extract";
import { inferNameFromPaste } from "@/lib/extraction/infer-name";
import { getBackendUrl, djangoToFrontendContact } from "@/lib/backend";
import { rankCandidates, isConfidentMatch, scoreMatch } from "@/lib/match/match";
import type { Contact } from "@/lib/types";
import type { ExtractedProfile } from "@/lib/extraction/types";

export async function POST(req: Request) {
  const body = await req.json();
  const profileText: string | undefined = body.profileText;
  if (!profileText?.trim()) {
    return NextResponse.json({ error: "profileText is required" }, { status: 400 });
  }

  let profile: ExtractedProfile = {
    name: "",
    headline: "",
    current_title: "",
    current_company: "",
    location: "",
    industry: "",
    seniority_estimate: "",
    education: [],
    experience: [],
    skills: [],
    authored_posts: [],
    personalization_signals: [],
    about: "",
    other_notes: [],
    excluded_reposts_count: 0,
    connection_degree: "",
    mutual_connections: [],
    open_to_work: false,
    languages: [],
    organizations: [],
    certifications: [],
    website: "",
    key_achievements: [],
  };

  try {
    const backendUrl = getBackendUrl();
    const extractRes = await fetch(`${backendUrl}/api/contacts/extract_profile/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileText: profileText.trim() }),
    });
    if (extractRes.ok) {
      profile = await extractRes.json();
    } else {
      console.error("[prepare/extract] Backend error:", await extractRes.text());
    }
  } catch (e) {
    console.error("[prepare/extract]", e);
  }

  const heuristicName = inferNameFromPaste(profileText);
  const inferredName = (profile.name?.trim() || heuristicName).trim();
  const nameConfident =
    !!profile.name && !!heuristicName
      ? scoreMatch(profile.name, heuristicName).score >= 0.9
      : !!inferredName;

  const backendUrl = getBackendUrl();
  const tokens = inferredName.split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1] ?? "";
  const first = tokens[0] ?? "";
  const found = new Map<string, Contact>();
  
  try {
    if (last) {
      const res = await fetch(`${backendUrl}/api/contacts/?q=${encodeURIComponent(last)}`);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        for (const c of results) found.set(String(c.id), djangoToFrontendContact(c));
      }
    }
    if (first && first !== last && found.size === 0) {
      const res = await fetch(`${backendUrl}/api/contacts/?q=${encodeURIComponent(first)}`);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        for (const c of results) found.set(String(c.id), djangoToFrontendContact(c));
      }
    }
  } catch (e) {
    console.error("[prepare/match]", e);
  }

  const candidates = rankCandidates(inferredName, [...found.values()]);

  return NextResponse.json({
    profile,
    inferredName,
    nameConfident,
    candidates,
    confident: isConfidentMatch(candidates),
  });
}
