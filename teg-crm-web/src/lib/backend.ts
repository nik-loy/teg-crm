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
    followUpOwner: d.follow_up_owner ? d.follow_up_owner.name : "",
    followUpOwnerId: d.follow_up_owner ? String(d.follow_up_owner.id) : undefined,
    followUpComplete: !!d.follow_up_complete,
    rating: d.rating ? {
      score: d.rating.score,
      reason: d.rating.reason
    } : undefined
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
    if (!c.followUpComplete) {
      buckets.dueFollowups.push(c);
    } else {
      buckets.noMessage.push(c);
    }
  }

  return buckets;
}
