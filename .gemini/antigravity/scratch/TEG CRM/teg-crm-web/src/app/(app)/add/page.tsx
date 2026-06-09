"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */
type SubmitResult =
  | { type: "created"; pageId: string; notionUrl?: string }
  | { type: "merged"; pageId: string }
  | { type: "existing"; pageId: string }
  | { type: "error"; message: string };

/* ------------------------------------------------------------------ */
/* Field helpers                                                         */
/* ------------------------------------------------------------------ */
function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-foreground mb-1"
    >
      {children}
    </label>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  children,
  className,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 appearance-none cursor-pointer",
        className
      )}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Result cards                                                          */
/* ------------------------------------------------------------------ */
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
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            Contact added to Notion
          </p>
          {result.notionUrl && (
            <a
              href={result.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline mt-1"
            >
              Open in Notion <ExternalLink className="size-3" />
            </a>
          )}
        </CardContent>
      </Card>
    );
  }

  if (result.type === "merged") {
    return (
      <Card className="border-blue-500/50 bg-blue-50/30 dark:bg-blue-900/10">
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
            Merged — existing contact enriched
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Empty fields filled in for page {result.pageId.slice(0, 8)}&hellip;
          </p>
        </CardContent>
      </Card>
    );
  }

  // existing
  return (
    <Card className="border-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10">
      <CardContent className="pt-4">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Already exists
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          This contact is already in Notion (page {result.pageId.slice(0, 8)}&hellip;).
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Inner form — uses useSearchParams, must be wrapped in Suspense       */
/* ------------------------------------------------------------------ */
function AddContactForm() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") ?? "";
  const nameParam = searchParams.get("name") ?? "";

  const [linkedinUrl, setLinkedinUrl] = useState(urlParam);
  const [name, setName] = useState(nameParam);
  const [jobTitle, setJobTitle] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("request_sent");
  const [owner, setOwner] = useState("");

  const [profileText, setProfileText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  // sync if URL params change (e.g. navigating via bookmarklet)
  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true;
      return;
    }
    setLinkedinUrl(urlParam);
    setName(nameParam);
  }, [urlParam, nameParam]);

  /* -------- Profile paste auto-fill -------- */
  async function handleProfilePaste(text: string) {
    setProfileText(text);
    if (!text.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 501) {
        // OpenAI key not configured — silently skip
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.name && !name) setName(data.name);
      if (data.jobTitle && !jobTitle) setJobTitle(data.jobTitle);
    } catch {
      // network or parse error — gracefully ignore
    } finally {
      setExtracting(false);
    }
  }

  /* -------- Submit -------- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: linkedinUrl.trim() || undefined,
          name: name.trim(),
          jobTitle: jobTitle.trim() || undefined,
          tier: tier || undefined,
          status,
          owner: owner.trim() || undefined,
          profileText: profileText.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error ?? "Request failed" });
        return;
      }

      if (data.created) {
        setResult({ type: "created", pageId: data.pageId, notionUrl: data.notionUrl });
      } else if (data.merged) {
        setResult({ type: "merged", pageId: data.pageId });
      } else if (data.existing) {
        setResult({ type: "existing", pageId: data.pageId });
      } else {
        setResult({ type: "error", message: "Unexpected response from server" });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Add Contact</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New LinkedIn Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* LinkedIn URL */}
            <div>
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input
                id="linkedinUrl"
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Job Title */}
            <div>
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                type="text"
                placeholder="e.g. Software Engineer at Acme"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>

            {/* Tier + Status (side by side) */}
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

            {/* Owner */}
            <div>
              <Label htmlFor="owner">Outreach Owner</Label>
              <Input
                id="owner"
                type="text"
                placeholder="Your name / team member"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>

            {/* Collapsed profile paste section */}
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                <span>Paste LinkedIn profile text (auto-fill)</span>
                {profileOpen ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
              {profileOpen && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
                  <textarea
                    id="profileText"
                    rows={6}
                    placeholder="Paste the LinkedIn profile text here. Name and job title will be auto-filled if /api/extract is configured."
                    value={profileText}
                    onChange={(e) => handleProfilePaste(e.target.value)}
                    className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
                  />
                  {extracting && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Extracting fields&hellip;
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !name.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving&hellip;
                </>
              ) : (
                "Add to Notion"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result feedback */}
      {result && <ResultCard result={result} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page export — Suspense wrapper required in Next.js 15                */
/* ------------------------------------------------------------------ */
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
