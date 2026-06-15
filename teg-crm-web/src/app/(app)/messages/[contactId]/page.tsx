"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { OwnerSelect, OWNER_STORAGE_KEY } from "@/components/OwnerSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Copy,
  CheckCheck,
  AlertTriangle,
  RefreshCw,
  MessageCircleReply,
} from "lucide-react";
import type { ParsedMessage } from "@/lib/message/parse";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */
type LogStatus = "idle" | "logging" | "logged" | "error";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
function CharBar({ count }: { count: number }) {
  const pct = Math.min(100, (count / 500) * 100);
  const ok = count <= 500;
  const warn = count > 450 && count <= 500;
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            !ok ? "bg-destructive" : warn ? "bg-amber-500" : "bg-green-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className={cn(
          "text-xs",
          !ok
            ? "text-destructive font-medium"
            : warn
            ? "text-amber-600"
            : "text-muted-foreground"
        )}
      >
        {count} / 500 chars{!ok ? " — too long" : warn ? " — almost full" : ""}
      </p>
    </div>
  );
}

function FitBadge({ fit }: { fit: number }) {
  const color =
    fit >= 4
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : fit === 3
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span
      className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold", color)}
    >
      Fit {fit}/5
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Copy button with flash                                               */
/* ------------------------------------------------------------------ */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy}>
      {copied ? (
        <>
          <CheckCheck className="size-3.5 mr-1.5 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5 mr-1.5" />
          Copy
        </>
      )}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Variant card                                                         */
/* ------------------------------------------------------------------ */
function VariantCard({
  index,
  angle,
  initialText,
  contactId,
  anrede,
  fit,
  onLogged,
}: {
  index: number;
  angle: string;
  initialText: string;
  contactId: string;
  anrede: string;
  fit: number;
  onLogged: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [logStatus, setLogStatus] = useState<LogStatus>("idle");
  const charCount = text.length;
  const canLog = fit >= 3 && charCount <= 500 && charCount > 0;

  async function handleLog() {
    if (!canLog) return;
    setLogStatus("logging");
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          summary: "LinkedIn outreach message sent",
          type: "LinkedIn Message",
          nextAction: "Await response",
        }),
      });
      if (!res.ok) throw new Error("log failed");
      setLogStatus("logged");
      onLogged();
    } catch {
      setLogStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Variante {index + 1} — {angle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
        />
        <CharBar count={charCount} />
        <div className="flex items-center gap-2">
          <CopyButton text={text} />
          {logStatus === "logged" ? (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCheck className="size-3.5" />
              Logged — status set to Messaged
            </span>
          ) : logStatus === "error" ? (
            <span className="text-xs text-destructive">Log failed — retry</span>
          ) : (
            <Button
              size="sm"
              onClick={handleLog}
              disabled={!canLog || logStatus === "logging"}
            >
              {logStatus === "logging" ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : null}
              Mark as messaged + log
            </Button>
          )}
        </div>
        {fit < 3 && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="size-3.5" />
            Fit {fit}/5 — below threshold, logging disabled
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pre-flight checklist                                                 */
/* ------------------------------------------------------------------ */
function Preflight({
  fit,
  seniority,
  blacklistClear,
}: {
  fit: number;
  seniority: string;
  blacklistClear: boolean;
}) {
  const rows: { label: string; ok: boolean; note?: string }[] = [
    { label: "Fit", ok: fit >= 3, note: `${fit}/5` },
    {
      label: "Seniority",
      ok: !seniority.toLowerCase().includes("achtung"),
      note: seniority,
    },
    { label: "Blacklist", ok: blacklistClear },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Pre-flight</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {rows.map(({ label, ok, note }) => (
            <li key={label} className="flex items-start gap-2 text-xs">
              <span className={ok ? "text-green-600" : "text-destructive"}>
                {ok ? "✓" : "✗"}
              </span>
              <span className={ok ? "text-foreground" : "text-destructive font-medium"}>
                {label}
                {note && (
                  <span className="text-muted-foreground font-normal"> — {note}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Follow-up panel                                                     */
/* ------------------------------------------------------------------ */
function FollowupPanel({
  contactId,
  anrede,
}: {
  contactId: string;
  anrede: "Du" | "Sie";
}) {
  const [reply, setReply] = useState("");
  const [selectedAnrede, setSelectedAnrede] = useState<"Du" | "Sie">(anrede);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; positive: boolean } | null>(null);
  const [editedText, setEditedText] = useState("");
  const [logStatus, setLogStatus] = useState<LogStatus>("idle");
  const [promoted, setPromoted] = useState(false);

  async function generate() {
    if (!reply.trim()) return;
    setLoading(true);
    setResult(null);
    setLogStatus("idle");
    setPromoted(false);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, reply: reply.trim(), anrede: selectedAnrede }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(data);
      setEditedText((data as { text: string }).text);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function logFollowup() {
    if (!editedText.trim()) return;
    setLogStatus("logging");
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          summary: `Follow-up response sent (reply: '${reply.slice(0, 60)}')`,
          type: "LinkedIn Message",
          nextAction: "Await further response",
        }),
      });
      if (!res.ok) throw new Error("log failed");
      setLogStatus("logged");
    } catch {
      setLogStatus("error");
    }
  }

  async function promoteToEngaged() {
    await fetch(`/api/contacts/${contactId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "Engaged" }),
    });
    setPromoted(true);
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircleReply className="size-4" />
          Follow-up reply
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Contact replied? Enter their message to draft a short, warm response.
        </p>
        <textarea
          rows={2}
          placeholder='e.g. "Klingt spannend!"'
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
        />
        <div className="flex items-center gap-2">
          <select
            value={selectedAnrede}
            onChange={(e) => setSelectedAnrede(e.target.value as "Du" | "Sie")}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring appearance-none cursor-pointer"
          >
            <option value="Du">Du</option>
            <option value="Sie">Sie</option>
          </select>
          <Button
            size="sm"
            onClick={generate}
            disabled={loading || !reply.trim()}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            Draft reply
          </Button>
        </div>

        {result && (
          <div className="space-y-2 pt-1 border-t border-border">
            <textarea
              rows={3}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <CopyButton text={editedText} />
              {logStatus === "logged" ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCheck className="size-3.5" /> Logged
                </span>
              ) : (
                <Button size="sm" variant="outline" onClick={logFollowup} disabled={logStatus === "logging"}>
                  {logStatus === "logging" && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                  Log follow-up
                </Button>
              )}
              {result.positive && logStatus === "logged" && !promoted && (
                <Button size="sm" variant="secondary" onClick={promoteToEngaged}>
                  Mark as Engaged
                </Button>
              )}
              {promoted && (
                <span className="text-xs text-green-600">Pipeline → Engaged</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Inner component — uses hooks requiring Suspense                      */
/* ------------------------------------------------------------------ */
function MessageInner({ contactId }: { contactId: string }) {
  const searchParams = useSearchParams();
  const [owner, setOwner] = useState(() => {
    // seed from URL param; localStorage read happens in effect below
    return searchParams.get("owner") ?? "";
  });
  const ownerInitialised = useRef(false);
  const [profileText, setProfileText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggedIdx, setLoggedIdx] = useState<number | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setParsed(null);
    setLoggedIdx(null);
    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, profileText: profileText.trim() || undefined, owner: owner.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }
      setParsed(data as ParsedMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  // Restore owner from localStorage if not set via URL param
  useEffect(() => {
    if (ownerInitialised.current) return;
    ownerInitialised.current = true;
    if (!owner) {
      try {
        const saved = localStorage.getItem(OWNER_STORAGE_KEY);
        if (saved) setOwner(saved);
      } catch {
        // ignore
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate on mount
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Generate Message</h1>
        <div className="flex items-center gap-2">
          <OwnerSelect value={owner} onChange={setOwner} className="h-8 w-36 text-sm" />
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
            {loading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="size-3.5 mr-1.5" />
            )}
            Regenerate
          </Button>
        </div>
      </div>

      {/* Optional profile paste */}
      <details
        open={profileOpen}
        onToggle={(e) => setProfileOpen((e.target as HTMLDetailsElement).open)}
        className="rounded-lg border border-border overflow-hidden"
      >
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors select-none">
          Override saved profile (optional — the enriched profile is used automatically)
        </summary>
        <div className="px-3 pb-3 pt-1 border-t border-border">
          <textarea
            rows={5}
            placeholder="Paste the full LinkedIn profile text here."
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
          />
          <Button
            size="sm"
            className="mt-2"
            onClick={generate}
            disabled={loading || !profileText.trim()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : null}
            Generate with profile
          </Button>
        </div>
      </details>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Generating message variants&hellip;</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {parsed && !loading && (
        <>
          {/* Analysis row */}
          <div className="flex flex-wrap items-center gap-3">
            <FitBadge fit={parsed.fit} />
            <span className="text-xs text-muted-foreground">
              Ansprache: <strong>{parsed.anrede}</strong>
            </span>
            {parsed.seniority && parsed.seniority !== "—" && (
              <span
                className={cn(
                  "text-xs",
                  parsed.seniority.toLowerCase().includes("achtung")
                    ? "text-amber-600 font-medium"
                    : "text-muted-foreground"
                )}
              >
                {parsed.seniority}
              </span>
            )}
          </div>

          {/* Pre-flight */}
          <Preflight
            fit={parsed.fit}
            seniority={parsed.seniority}
            blacklistClear={true}
          />

          {/* 3 variants */}
          {parsed.variants.map((v, i) => (
            <VariantCard
              key={i}
              index={i}
              angle={v.angle}
              initialText={v.text}
              contactId={contactId}
              anrede={parsed.anrede}
              fit={parsed.fit}
              onLogged={() => setLoggedIdx(i)}
            />
          ))}

          {loggedIdx !== null && (
            <p className="text-sm text-green-600 text-center">
              Interaction logged. Contact marked as Messaged.
            </p>
          )}

          <FollowupPanel contactId={contactId} anrede={parsed.anrede} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page export                                                          */
/* ------------------------------------------------------------------ */
export default function MessagesPage() {
  const params = useParams();
  const contactId = Array.isArray(params.contactId)
    ? params.contactId[0]
    : (params.contactId ?? "");

  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading&hellip;</p>
        </div>
      }
    >
      <MessageInner contactId={contactId} />
    </Suspense>
  );
}
