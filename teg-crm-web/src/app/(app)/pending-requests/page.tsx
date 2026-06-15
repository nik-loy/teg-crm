"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OwnerSelect } from "@/components/OwnerSelect";
import { Loader2, Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ParseResult } from "@/lib/extraction/pending-requests-types";

interface DuplicateInfo {
  name: string;
  owner: string;
  pageId: string;
}

interface CreateResult {
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ name: string; reason: string }>;
}

const OWNER_STORAGE_KEY = "teg-pending-owner";

export default function PendingRequestsPage() {
  const [owner, setOwner] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  // Restore owner from localStorage on mount; fetch events registry
  useEffect(() => {
    const saved = localStorage.getItem(OWNER_STORAGE_KEY);
    if (saved) setOwner(saved);

    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {/* silently fail — user can still type */});
  }, []);

  function handleOwnerChange(v: string) {
    setOwner(v);
    localStorage.setItem(OWNER_STORAGE_KEY, v);
  }

  async function handleParse() {
    if (!pastedText.trim()) return;
    setParsing(true);
    setParseResult(null);
    setDuplicates([]);
    setCreateResult(null);
    try {
      const res = await fetch("/api/pending-requests/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastedText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Parsing failed");
      }
      const result: ParseResult = await res.json();
      setParseResult(result);

      // Auto-check duplicates right after parsing
      if (result.requests.length > 0) {
        setCheckingDupes(true);
        try {
          const dupeRes = await fetch("/api/pending-requests/check-duplicates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: result.requests.map((r) => r.name) }),
          });
          if (dupeRes.ok) {
            const { duplicates: found } = await dupeRes.json();
            setDuplicates(found ?? []);
          }
        } finally {
          setCheckingDupes(false);
        }
      }
    } catch (err) {
      setParseResult({
        success: false,
        requests: [],
        errors: [{ reason: err instanceof Error ? err.message : "Unknown error" }],
        stats: { totalLines: 0, parsed: 0, failed: 1, duplicateDetected: 0 },
      });
    } finally {
      setParsing(false);
    }
  }

  async function handleCreateAll() {
    if (!parseResult?.requests.length || !owner || !selectedEvent) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pending-requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: parseResult.requests,
          owner,
          eventName: selectedEvent.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Creation failed");
      }
      const result = await res.json();
      setCreateResult(result);
      setPastedText("");
      setParseResult(null);
      setDuplicates([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create contacts");
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    setCreateResult(null);
    setPastedText("");
    setParseResult(null);
    setDuplicates([]);
    setSelectedEvent("");
  }

  const dupeNames = new Set(duplicates.map((d) => d.name));
  const newCount = parseResult
    ? parseResult.requests.filter((r) => !dupeNames.has(r.name)).length
    : 0;
  const dupeCount = duplicates.length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Import Pending Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste your LinkedIn &quot;Sent&quot; requests page — creates all contacts in seconds.
        </p>
      </div>

      {/* Identity card — always visible, persists across sessions */}
      <Card className={!owner ? "border-amber-400 bg-amber-50/40" : ""}>
        <CardContent className="pt-4 pb-4">
          <label className="text-sm font-semibold block mb-2">
            Who are you? <span className="text-destructive">*</span>
          </label>
          <OwnerSelect value={owner} onChange={handleOwnerChange} />
          {!owner ? (
            <p className="text-xs text-amber-600 mt-2">
              Select yourself first — this records which sales rep sent each connection request.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Contacts will be attributed to <strong>{owner}</strong> in the CRM.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Event selection — mandatory */}
      <Card className={!selectedEvent ? "border-amber-400 bg-amber-50/40" : ""}>
        <CardContent className="pt-4 pb-4">
          <label className="text-sm font-semibold block mb-2">
            Which event? <span className="text-destructive">*</span>
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an event…</option>
            {events.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {!selectedEvent && (
            <p className="text-xs text-amber-600 mt-2">
              Select the event these connection requests came from.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Paste + Parse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste LinkedIn Pending Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Go to <strong>LinkedIn → My Network → Manage → Sent</strong>, select all
            text (Ctrl+A on desktop), copy and paste below.
          </p>
          <textarea
            rows={12}
            placeholder={
              "Aliosha Milsztein's profile picture\nAliosha Milsztein\nAgentic AI @ Personio\nSent 1 week ago\nWithdraw\n..."
            }
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs resize-y"
          />
          <Button
            onClick={handleParse}
            disabled={parsing || !pastedText.trim()}
            className="w-full"
          >
            {parsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing…
              </>
            ) : (
              "Parse Requests"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview + Duplicate warnings */}
      {parseResult && !createResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span>
                Review — {parseResult.stats.parsed} found
              </span>
              {checkingDupes && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking for duplicates…
                </span>
              )}
              {!checkingDupes && dupeCount > 0 && (
                <span className="text-xs font-normal text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {dupeCount} already in CRM
                </span>
              )}
              {!checkingDupes && dupeCount === 0 && parseResult.requests.length > 0 && (
                <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  No duplicates
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parseResult.stats.parsed === 0 ? (
              <div className="space-y-2">
                {!parseResult.success && parseResult.errors.length > 0 ? (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-sm font-semibold text-destructive mb-1">Parsing failed</p>
                    <p className="text-xs text-destructive">{parseResult.errors[0].reason}</p>
                  </div>
                ) : (
                  <p className="text-sm text-destructive">
                    No requests found. Make sure you copied the right page — each entry
                    needs a &quot;Sent X days/weeks ago&quot; line.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="max-h-80 overflow-y-auto divide-y rounded-md border">
                  {parseResult.requests.map((req, i) => {
                    const dupe = duplicates.find((d) => d.name === req.name);
                    return (
                      <div
                        key={i}
                        className={`px-3 py-2 ${dupe ? "bg-amber-50" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              {dupe ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              )}
                              <span className="truncate">{req.name}</span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate pl-5">
                              {req.headline}
                            </p>
                            <p className="text-xs text-muted-foreground pl-5">
                              Sent {req.sentDaysAgo} day{req.sentDaysAgo !== 1 ? "s" : ""} ago
                            </p>
                          </div>
                          {dupe && (
                            <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                              {dupe.owner
                                ? `already by ${dupe.owner}`
                                : "already in CRM"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  {(!owner || !selectedEvent) && (
                    <p className="text-sm text-amber-600 font-medium">
                      ⚠ {!owner ? "Select who you are" : "Select an event"} at the top before creating contacts.
                    </p>
                  )}

                  <Button
                    onClick={handleCreateAll}
                    disabled={creating || !owner || !selectedEvent}
                    className="w-full"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating contacts in Notion…
                      </>
                    ) : dupeCount > 0 ? (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Create {newCount} new contact{newCount !== 1 ? "s" : ""} &mdash; skip{" "}
                        {dupeCount} duplicate{dupeCount !== 1 ? "s" : ""}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Create All {parseResult.stats.parsed} Contacts
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {createResult && (
        <Card
          className={
            createResult.failed > 0 ? "border-destructive" : "border-green-500"
          }
        >
          <CardHeader>
            <CardTitle className="text-base">Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {createResult.created}
                </p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {createResult.skipped}
                </p>
                <p className="text-xs text-muted-foreground">Already existed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">
                  {createResult.failed}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>

            {createResult.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                <p className="text-xs font-semibold text-destructive">Errors:</p>
                {createResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {err.name}: {err.reason}
                  </p>
                ))}
              </div>
            )}

            <Button onClick={reset} variant="outline" className="w-full">
              Import More
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
