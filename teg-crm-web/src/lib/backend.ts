import type { Contact } from "./types";

export function getBackendUrl(): string {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL || "http://teg-crm:8000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}

export async function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("teg_jwt") : null;
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${getBackendUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("teg_jwt");
    // Session expired, force reload to login
    window.location.href = "/login";
  }

  return response;
}

export function djangoToFrontendContact(d: any): Contact {
  return {
    id: String(d.id),
    name: d.name || "",
    linkedinUrl: d.linkedin_url || "",
    jobTitle: d.job_title || "",
    company: d.company_name || "",
    tier: d.tier || "Tier 3",
    pipelineStage: d.pipeline_stage || "Awareness",
    outreachStatus: d.outreach_status || "",
    outreachOwner: d.outreach_owner || "",
    lastContactDate: d.last_contact_date || "",
    followUpDueDate: d.follow_up_due_date || "",
    followUpOwner: d.follow_up_owner || "",
    followUpComplete: d.follow_up_complete || false,
    notes: d.notes || "",
    profileSummary: d.profile_summary || "",
    location: d.location || "",
    experience: d.experience || "",
    education: d.education || "",
    personalizationSignals: d.personalization_signals || "",
    events: d.events || [],
    about: d.about || "",
    mutualConnections: d.mutual_connections || "",
    openToWork: d.open_to_work || false,
    connectionDegree: d.connection_degree || "",
    languages: d.languages || "",
    organizations: d.organizations || "",
    certifications: d.certifications || "",
    website: d.website || "",
    keyAchievements: d.key_achievements || "",
  };
}

export async function getTodayBuckets(owner?: string) {
  const backendUrl = getBackendUrl();
  let url = `${backendUrl}/api/contacts/`;
  if (owner) {
    url += `?owner=${encodeURIComponent(owner)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch contacts from backend");
  const data = await res.json();
  const contacts = (Array.isArray(data) ? data : (data.results || [])).map(djangoToFrontendContact);

  const buckets = {
    replies: [] as any[],
    dueFollowups: [] as any[],
    staleRequests: [] as any[],
    noMessage: [] as any[],
  };

  const today = new Date().toISOString().split("T")[0];

  for (const c of contacts) {
    if (c.outreachStatus === "Replied" && !c.followUpComplete) {
      buckets.replies.push(c);
      continue;
    }
    if (c.outreachStatus === "Messaged" && c.followUpDueDate && c.followUpDueDate <= today && !c.followUpComplete) {
      buckets.dueFollowups.push(c);
      continue;
    }
    if (c.outreachStatus === "Request Sent") {
      const sentDate = c.lastContactDate;
      if (sentDate) {
        const diff = Date.now() - new Date(sentDate).getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        if (days > 14) {
          buckets.staleRequests.push(c);
          continue;
        }
      }
    }
    if (c.outreachStatus === "Connected" || c.outreachStatus === "Accepted") {
      buckets.noMessage.push(c);
    }
  }

  return buckets;
}
