"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OwnerSelect } from "@/components/OwnerSelect";
import { cn } from "@/lib/utils";
import { Loader2, ExternalLink, CheckCircle2, Circle, UserPlus, Search } from "lucide-react";
import type { Contact } from "@/lib/types";
import type { ExtractedProfile } from "@/lib/extraction/types";
import { toProfileFields } from "@/lib/extraction/summary";

/* ================================================================== */
/* Types                                                                */
/* ================================================================== */
interface Candidate {
  contact: Contact;
  score: number;
  reason: string;
}

interface PrepareData {
  profile: ExtractedProfile;
  inferredName: string;
  nameConfident: boolean;
  candidates: Candidate[];
  confident: boolean;
}

type SubmitResult =
  | { type: "created"; pageId: string; notionUrl?: string }
  | { type: "merged"; pageId: string }
  | { type: "updated"; pageId: string; filledFields: string[]; archived: boolean }
  | { type: "existing"; pageId: string }
  | { type: "error"; message: string };

/* ================================================================== */
/* Field helpers                                                         */
/* ================================================================== */
function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-1">
      {children}
    </label>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 appearance-none cursor-pointer"
    >
      {children}
    </select>
  );
}

/* ================================================================== */
/* Result card                                                           */
/* ================================================================== */
function ResultCard({ result }: { result: SubmitResult }) {
  if (result.type === "error") {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-4">
          <p className="text-sm font-medium text-destructive">Error</p>
          <p className="text-xs text-muted-foreground mt-1">{result.message}</p>
        </CardContent>
      </Card>
    );
  }
  if (result.type === "created") {
    return (
      <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-900/10">
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">Contact added to Notion</p>
          {result.notionUrl && (
            <a href={result.notionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline mt-1">
              Open in Notion <ExternalLink className="size-3" />
            </a>
          )}
        </CardContent>
      </Card>
    );
  }
  if (result.type === "updated" || result.type === "merged") {
    const filled = result.type === "updated" ? result.filledFields : [];
    return (
      <Card className="border-blue-500/50 bg-blue-50/30 dark:bg-blue-900/10">
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Contact enriched</p>
          {filled.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-1">Filled: {filled.join(", ")}.</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">All structured fields were already set.</p>
          )}
          {result.type === "updated" && result.archived && (
            <p className="text-xs text-muted-foreground mt-1">Full profile archived to the Notion page.</p>
          )}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10">
      <CardContent className="pt-4">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Already exists</p>
        <p className="text-xs text-muted-foreground mt-1">This contact is already in Notion (page {result.pageId.slice(0, 8)}…).</p>
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* Fields-to-fill preview (enrich)                                       */
/* ================================================================== */
function FieldsPreview({ profile, contact }: { profile: ExtractedProfile; contact: Contact }) {
  const f = toProfileFields(profile);
  const rows: { label: string; incoming: string; existing?: string }[] = [
    { label: "Job Title", incoming: f.jobTitle, existing: contact.jobTitle },
    { label: "Location", incoming: f.location, existing: contact.location },
    { label: "Experience", incoming: profile.experience.length ? `${profile.experience.length} role(s)` : "", existing: contact.experience },
    { label: "Education", incoming: profile.education.length ? `${profile.education.length} school(s)` : "", existing: contact.education },
    { label: "Signals", incoming: f.personalizationSignals, existing: contact.personalizationSignals },
    { label: "Profile Summary", incoming: f.profileSummary ? "full profile" : "", existing: contact.profileSummary },
  ];
  const visible = rows.filter((r) => r.incoming);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground mb-1">Will fill empty fields:</p>
      {visible.map((r) => {
        const willFill = !r.existing?.trim();
        return (
          <div key={r.label} className="flex items-start gap-2 text-xs">
            {willFill ? (
              <Circle className="size-3.5 mt-0.5 text-green-600 shrink-0" />
            ) : (
              <CheckCircle2 className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
            )}
            <span className={cn("min-w-[5.5rem] font-medium", willFill ? "text-foreground" : "text-muted-foreground line-through")}>
              {r.label}
            </span>
            <span className={cn("flex-1 truncate", willFill ? "text-muted-foreground" : "text-muted-foreground/60")}>
              {willFill ? r.incoming : "already set — kept"}
            </span>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground/70 pt-1">
        The complete pasted profile is also archived verbatim to the Notion page — nothing is lost.
      </p>
    </div>
  );
}

/* ================================================================== */
/* Main form                                                             */
/* ================================================================== */
function AddContactForm() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") ?? "";
  const nameParam = searchParams.get("name") ?? "";

  // Paste + prepare
  const [profileText, setProfileText] = useState("");
  const [prepState, setPrepState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [prepError, setPrepError] = useState("");
  const [prep, setPrep] = useState<PrepareData | null>(null);

  // Selection
  const [selected, setSelected] = useState<Contact | null>(null);
  // Explicit "create new" path. Opens immediately for the bookmarklet (URL/name
  // pre-filled), otherwise the paste box drives the flow.
  const [creating, setCreating] = useState(Boolean(urlParam || nameParam));

  // Create-form fields (pre-filled from extraction)
  const [name, setName] = useState(nameParam);
  const [linkedinUrl, setLinkedinUrl] = useState(urlParam);
  const [jobTitle, setJobTitle] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("connected");
  const [owner, setOwner] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const [events, setEvents] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingEvents(false);
      }
    }
    fetchEvents();
  }, []);

  /* -------- Paste → prepare (debounced) -------- */
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handlePaste(text: string) {
    setProfileText(text);
    setResult(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (!text.trim() || text.trim().length < 30) {
      setPrepState("idle");
      setPrep(null);
      setSelected(null);
      setCreating(false);
      return;
    }
    setPrepState("loading");
    debounce.current = setTimeout(() => runPrepare(text), 600);
  }

  async function runPrepare(text: string) {
    try {
      const res = await fetch("/api/enrich/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileText: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPrepError(data.error ?? "Could not read the profile.");
        setPrepState("error");
        return;
      }
      const data = (await res.json()) as PrepareData;
      setPrep(data);
      setPrepState("ready");

      // Pre-fill create-form fields from the extraction.
      const f = toProfileFields(data.profile);
      if (!nameParam) setName(data.inferredName);
      setJobTitle(f.jobTitle);

      // Auto-select on a confident unique match.
      if (data.confident && data.candidates[0]) {
        setSelected(data.candidates[0].contact);
        setCreating(false);
      } else {
        setSelected(null);
        setCreating(false);
      }
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : "Network error");
      setPrepState("error");
    }
  }

  function chooseCreate() {
    setCreating(true);
    setSelected(null);
    if (prep && !name) setName(prep.inferredName);
  }

  /* -------- Save: enrich -------- */
  async function saveEnrich() {
    if (!selected || !prep) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/contacts/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: prep.profile, rawProfileText: profileText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: "error", message: data.error ?? "Request failed" });
        return;
      }
      setResult({ type: "updated", pageId: data.pageId, filledFields: data.filledFields ?? [], archived: !!data.archived });
      resetAll();
    } catch (e) {
      setResult({ type: "error", message: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  /* -------- Save: create -------- */
  async function saveCreate() {
    if (!name.trim() && !linkedinUrl.trim()) {
      alert("Please provide a name or LinkedIn URL.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: linkedinUrl.trim() || undefined,
          name: name.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          tier: tier || undefined,
          status,
          owner: owner.trim() || undefined,
          events: selectedEvents.length > 0 ? selectedEvents : undefined,
          profile: prep?.profile,
          rawProfileText: profileText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: "error", message: data.error ?? "Request failed" });
        return;
      }
      if (data.created) setResult({ type: "created", pageId: data.pageId, notionUrl: data.notionUrl });
      else if (data.merged) setResult({ type: "merged", pageId: data.pageId });
      else if (data.existing) setResult({ type: "existing", pageId: data.pageId });
      else setResult({ type: "error", message: "Unexpected response" });
      resetAll();
    } catch (e) {
      setResult({ type: "error", message: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setProfileText("");
    setPrep(null);
    setPrepState("idle");
    setSelected(null);
    setCreating(false);
    setName(nameParam);
    setLinkedinUrl(urlParam);
    setJobTitle("");
    setTier("");
    setSelectedEvents([]);
  }

  function toggleEvent(eventName: string) {
    setSelectedEvents((prev) =>
      prev.includes(eventName) ? prev.filter((e) => e !== eventName) : [...prev, eventName]
    );
  }

  const fields = prep ? toProfileFields(prep.profile) : null;

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Add or Enrich Contact</h1>

      {/* PASTE BOX — the single entry point */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Paste the LinkedIn profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            id="profileText"
            rows={8}
            autoFocus
            placeholder="Open the contact's LinkedIn profile, select all (Ctrl+A), copy, and paste here. We'll find the contact and extract their experience, education and more."
            value={profileText}
            onChange={(e) => handlePaste(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
          />
          {prepState === "loading" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Reading profile &amp; finding the contact…
            </p>
          )}
          {prepState === "error" && (
            <p className="text-xs text-destructive">{prepError}</p>
          )}
        </CardContent>
      </Card>

      {/* MATCH RESULT */}
      {prepState === "ready" && prep && !creating && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {selected ? (
              /* ---- confident / chosen match ---- */
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-green-600" />
                      <p className="text-sm font-semibold">{selected.name}</p>
                    </div>
                    {(selected.jobTitle || selected.company) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[selected.jobTitle, selected.company].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {prep.candidates[0] && prep.candidates[0].contact.id === selected.id && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {Math.round(prep.candidates[0].score * 100)}% — {prep.candidates[0].reason}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelected(null)}>
                    change
                  </Button>
                </div>

                <FieldsPreview profile={prep.profile} contact={selected} />

                <Button onClick={saveEnrich} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Save enrichment
                </Button>
              </>
            ) : (
              /* ---- picker (ambiguous / low-confidence / none) ---- */
              <>
                <div className="flex items-center gap-1.5 text-sm">
                  <Search className="size-4 text-muted-foreground" />
                  <span className="font-medium">
                    {prep.candidates.length > 0
                      ? `Is this ${prep.inferredName}?`
                      : `No existing contact found for “${prep.inferredName}”`}
                  </span>
                </div>

                {prep.candidates.length > 0 && (
                  <div className="space-y-1.5">
                    {prep.candidates.map((c) => (
                      <button
                        key={c.contact.id}
                        onClick={() => setSelected(c.contact)}
                        className="w-full text-left p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{c.contact.name}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {Math.round(c.score * 100)}% · {c.reason}
                          </span>
                        </div>
                        {(c.contact.jobTitle || c.contact.company) && (
                          <p className="text-xs text-muted-foreground">
                            {[c.contact.jobTitle, c.contact.company].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <Button variant="outline" onClick={chooseCreate} className="w-full">
                  <UserPlus className="size-4 mr-2" />
                  Create new contact{prep.inferredName ? ` — ${prep.inferredName}` : ""}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* CREATE NEW FORM */}
      {creating && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields && (
              <p className="text-xs text-muted-foreground">
                Extracted: {prep?.profile.experience.length ?? 0} role(s), {prep?.profile.education.length ?? 0} school(s)
                {fields.location ? ` · ${fields.location}` : ""} — all saved with the contact.
              </p>
            )}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input id="linkedinUrl" type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/username" />
            </div>
            <div>
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Software Engineer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tier">Tier</Label>
                <NativeSelect id="tier" value={tier} onChange={setTier}>
                  <option value="">— none —</option>
                  <option value="Tier 1">Tier 1</option>
                  <option value="Tier 2">Tier 2</option>
                  <option value="Tier 3">Tier 3</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <NativeSelect id="status" value={status} onChange={setStatus}>
                  <option value="request_sent">Request Sent</option>
                  <option value="connected">Connected</option>
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label htmlFor="owner">Outreach Owner</Label>
              <OwnerSelect value={owner} onChange={setOwner} />
            </div>
            {!loadingEvents && events.length > 0 && (
              <div>
                <Label htmlFor="events">Invite to event(s)</Label>
                <div className="space-y-2 mt-2">
                  {events.map((eventName) => (
                    <label key={eventName} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={selectedEvents.includes(eventName)} onChange={() => toggleEvent(eventName)} className="rounded border-input w-4 h-4" />
                      <span className="text-sm text-foreground">{eventName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {prep && (
                <Button variant="ghost" onClick={() => setCreating(false)} className="text-sm">
                  Back
                </Button>
              )}
              <Button onClick={saveCreate} disabled={submitting} className="flex-1">
                {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Add to Notion
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual fallback when nothing has been pasted yet */}
      {prepState === "idle" && !creating && (
        <button onClick={chooseCreate} className="text-xs text-muted-foreground underline w-full text-center">
          or enter a contact manually
        </button>
      )}

      {result && <ResultCard result={result} />}
    </div>
  );
}

/* ================================================================== */
/* Page export — Suspense wrapper required for useSearchParams          */
/* ================================================================== */
export default function AddPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-lg mx-auto">
          <div className="h-8 w-32 rounded bg-muted animate-pulse mb-4" />
          <div className="rounded-xl border bg-card p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <AddContactForm />
    </Suspense>
  );
}
