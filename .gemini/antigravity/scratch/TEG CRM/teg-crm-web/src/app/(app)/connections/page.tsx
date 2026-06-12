"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OwnerSelect } from "@/components/OwnerSelect";
import { Loader2, Send, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ConnectionParseResult, MessageParseResult } from "@/lib/extraction/connections-types";

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

interface MarkResult {
  updated: number;
  created: number;
  createdMinimal: string[];
  failed: number;
  errors: Array<{ name: string; reason: string }>;
}

const OWNER_STORAGE_KEY = "teg-pending-owner";

const STATUS_OPTIONS = [
  {
    value: "Connected",
    label: "Connected",
    description: "You are connected but haven't sent a first message yet",
  },
  {
    value: "Messaged",
    label: "Messaged",
    description: "You have already sent them a message",
  },
];

export default function ConnectionsPage() {
  const [owner, setOwner] = useState("");
  const [outreachStatus, setOutreachStatus] = useState("Connected");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  // ── Connected mode state ───────────────────────────────────────────────────
  const [pastedText, setPastedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ConnectionParseResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  // ── Messaged mode state ────────────────────────────────────────────────────
  const [msgPastedText, setMsgPastedText] = useState("");
  const [msgParsing, setMsgParsing] = useState(false);
  const [msgParseResult, setMsgParseResult] = useState<MessageParseResult | null>(null);
  const [inCrm, setInCrm] = useState<DuplicateInfo[]>([]);
  const [checkingCrm, setCheckingCrm] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markResult, setMarkResult] = useState<MarkResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(OWNER_STORAGE_KEY);
    if (saved) setOwner(saved);
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {/* silently fail */});
  }, []);

  function handleOwnerChange(v: string) {
    setOwner(v);
    localStorage.setItem(OWNER_STORAGE_KEY, v);
  }

  function switchStatus(value: string) {
    setOutreachStatus(value);
    // Clear all parsing state when switching modes so stale results don't show.
    setPastedText("");
    setParseResult(null);
    setDuplicates([]);
    setCreateResult(null);
    setMsgPastedText("");
    setMsgParseResult(null);
    setInCrm([]);
    setMarkResult(null);
  }

  // ── Connected mode handlers ────────────────────────────────────────────────

  async function handleParse() {
    if (!pastedText.trim()) return;
    setParsing(true);
    setParseResult(null);
    setDuplicates([]);
    setCreateResult(null);
    try {
      const res = await fetch("/api/connections/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastedText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Parsing failed");
      }
      const result: ConnectionParseResult = await res.json();
      setParseResult(result);

      if (result.connections.length > 0) {
        setCheckingDupes(true);
        try {
          const dupeRes = await fetch("/api/pending-requests/check-duplicates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: result.connections.map((c) => c.name) }),
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
        connections: [],
        errors: [{ reason: err instanceof Error ? err.message : "Unknown error" }],
        stats: { totalLines: 0, parsed: 0, failed: 1, duplicateDetected: 0 },
      });
    } finally {
      setParsing(false);
    }
  }

  async function handleCreateAll() {
    if (!parseResult?.connections.length || !owner || !selectedEvent) return;
    setCreating(true);
    try {
      const res = await fetch("/api/connections/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connections: parseResult.connections,
          owner,
          eventName: selectedEvent.trim() || undefined,
          outreachStatus,
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

  // ── Messaged mode handlers ─────────────────────────────────────────────────

  async function handleMsgParse() {
    if (!msgPastedText.trim()) return;
    setMsgParsing(true);
    setMsgParseResult(null);
    setInCrm([]);
    setMarkResult(null);
    try {
      const res = await fetch("/api/messages/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastedText: msgPastedText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Parsing failed");
      }
      const result: MessageParseResult = await res.json();
      setMsgParseResult(result);

      if (result.names.length > 0) {
        setCheckingCrm(true);
        try {
          const crmRes = await fetch("/api/pending-requests/check-duplicates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: result.names }),
          });
          if (crmRes.ok) {
            const { duplicates: found } = await crmRes.json();
            setInCrm(found ?? []);
          }
        } finally {
          setCheckingCrm(false);
        }
      }
    } catch (err) {
      setMsgParseResult({
        success: false,
        names: [],
        errors: [{ reason: err instanceof Error ? err.message : "Unknown error" }],
        stats: { totalLines: 0, parsed: 0, failed: 1, duplicateDetected: 0 },
      });
    } finally {
      setMsgParsing(false);
    }
  }

  async function handleMarkMessaged() {
    if (!msgParseResult?.names.length || !owner || !selectedEvent) return;
    setMarking(true);
    try {
      const res = await fetch("/api/messages/mark-messaged", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          names: msgParseResult.names,
          owner,
          eventName: selectedEvent.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Mark messaged failed");
      }
      const result: MarkResult = await res.json();
      setMarkResult(result);
      setMsgPastedText("");
      setMsgParseResult(null);
      setInCrm([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark contacts as messaged");
    } finally {
      setMarking(false);
    }
  }

  function reset() {
    setCreateResult(null);
    setMarkResult(null);
    setPastedText("");
    setMsgPastedText("");
    setParseResult(null);
    setMsgParseResult(null);
    setDuplicates([]);
    setInCrm([]);
    setSelectedEvent("");
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const dupeNames = new Set(duplicates.map((d) => d.name));
  const newCount = parseResult
    ? parseResult.connections.filter((c) => !dupeNames.has(c.name)).length
    : 0;
  const dupeCount = duplicates.length;

  const inCrmNames = new Set(inCrm.map((d) => d.name));
  const msgInCrmCount = msgParseResult ? msgParseResult.names.filter((n) => inCrmNames.has(n)).length : 0;
  const msgNewCount = msgParseResult ? msgParseResult.names.filter((n) => !inCrmNames.has(n)).length : 0;

  const isDone = outreachStatus === "Messaged" ? !!markResult : !!createResult;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Existing Connections</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Log contacts you&apos;re already connected with or have messaged on LinkedIn.
        </p>
      </div>

      {/* Identity */}
      <Card className={!owner ? "border-amber-400 bg-amber-50/40" : ""}>
        <CardContent className="pt-4 pb-4">
          <label className="text-sm font-semibold block mb-2">
            Who are you? <span className="text-destructive">*</span>
          </label>
          <OwnerSelect value={owner} onChange={handleOwnerChange} />
          {!owner ? (
            <p className="text-xs text-amber-600 mt-2">
              Select yourself first — this records which sales rep owns these connections.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Contacts will be attributed to <strong>{owner}</strong> in the CRM.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status toggle */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <label className="text-sm font-semibold block mb-2">
            What stage are these connections at?
          </label>
          <div className="flex gap-3">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => switchStatus(opt.value)}
                className={`flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  outreachStatus === opt.value
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                <span className="font-medium block">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {outreachStatus === "Connected" ? (
              <>These contacts will be set to <strong>Connected</strong> — they&apos;ll appear in your <strong>Today</strong> queue as needing a first message.</>
            ) : (
              <>These contacts will be marked as <strong>Messaged</strong> in the CRM. Existing contacts are updated; unknown names are created with name only.</>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Event selection */}
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
              {outreachStatus === "Messaged"
                ? "Select the event — it will be appended to existing contacts and set on any new ones."
                : "Select the event where you met these connections."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Connected mode: paste + parse ─────────────────────────────────── */}
      {outreachStatus === "Connected" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste LinkedIn Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Go to <strong>LinkedIn → My Network → Connections</strong>, select all text
              (Ctrl+A on desktop), copy and paste below.
            </p>
            <textarea
              rows={12}
              placeholder={
                "Max Mustermann's profile picture\nMax Mustermann\n\nProduct Manager @ Example GmbH\nBuilding great things\n\nConnected on June 12, 2026\n\nMessage\n..."
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
                "Parse Connections"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Messaged mode: paste + parse ──────────────────────────────────── */}
      {outreachStatus === "Messaged" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste LinkedIn Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Go to <strong>LinkedIn → Messaging</strong>, press <strong>Ctrl+A</strong> to select
              all conversations, copy and paste below. The full accessibility text is needed —
              including the navigation lines below each conversation.
            </p>
            <textarea
              rows={12}
              placeholder={
                "Raphael de Boer\nJun 8\nYou: Hahahaha seems legit 👀👀\n\n. Active conversation. Press return to go to conversation details\nOpen the options list in your conversation with Niklas Loycke and Raphael de Boer\nToni Wiemeyer\nJun 5\nToni: Hi Niklas...\n. Press return to go to conversation details\nOpen the options list in your conversation with Toni Wiemeyer and Niklas Loycke\n..."
              }
              value={msgPastedText}
              onChange={(e) => setMsgPastedText(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs resize-y"
            />
            <Button
              onClick={handleMsgParse}
              disabled={msgParsing || !msgPastedText.trim()}
              className="w-full"
            >
              {msgParsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing…
                </>
              ) : (
                "Parse Messages"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Connected mode: preview + import ──────────────────────────────── */}
      {parseResult && !createResult && outreachStatus === "Connected" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span>Review — {parseResult.stats.parsed} found</span>
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
              {!checkingDupes && dupeCount === 0 && parseResult.connections.length > 0 && (
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
                    No connections found. Make sure you copied the right page — each entry
                    needs a &quot;Connected on [Date]&quot; line.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="max-h-80 overflow-y-auto divide-y rounded-md border">
                  {parseResult.connections.map((conn, i) => {
                    const dupe = duplicates.find((d) => d.name === conn.name);
                    return (
                      <div key={i} className={`px-3 py-2 ${dupe ? "bg-amber-50" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              {dupe ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              )}
                              <span className="truncate">{conn.name}</span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate pl-5">
                              {conn.headline}
                            </p>
                            <p className="text-xs text-muted-foreground pl-5">
                              Connected on {conn.connectedOn}
                            </p>
                          </div>
                          {dupe && (
                            <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                              {dupe.owner ? `already by ${dupe.owner}` : "already in CRM"}
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
                        Import {newCount} new contact{newCount !== 1 ? "s" : ""} as Connected — skip {dupeCount} duplicate{dupeCount !== 1 ? "s" : ""}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Import All {parseResult.stats.parsed} Contacts as Connected
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Messaged mode: preview + mark ─────────────────────────────────── */}
      {msgParseResult && !markResult && outreachStatus === "Messaged" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span>Review — {msgParseResult.stats.parsed} name{msgParseResult.stats.parsed !== 1 ? "s" : ""} found</span>
              {checkingCrm && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking CRM…
                </span>
              )}
              {!checkingCrm && msgInCrmCount > 0 && (
                <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {msgInCrmCount} in CRM
                </span>
              )}
              {!checkingCrm && msgNewCount > 0 && (
                <span className="text-xs font-normal text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {msgNewCount} not yet in CRM
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {msgParseResult.stats.parsed === 0 ? (
              <div className="space-y-2">
                {!msgParseResult.success && msgParseResult.errors.length > 0 ? (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-sm font-semibold text-destructive mb-1">Parsing failed</p>
                    <p className="text-xs text-destructive">{msgParseResult.errors[0].reason}</p>
                  </div>
                ) : (
                  <p className="text-sm text-destructive">
                    No names found. Make sure you selected all text on the Messages page
                    including the navigation lines below each conversation.
                  </p>
                )}
              </div>
            ) : (
              <>
                {msgNewCount > 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      <strong>{msgNewCount} name{msgNewCount !== 1 ? "s" : ""} not found in CRM.</strong>{" "}
                      {msgNewCount === 1 ? "This contact" : "These contacts"} will be created with name only —
                      visit their profile afterwards to add headline, company, and LinkedIn URL.
                    </p>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto divide-y rounded-md border">
                  {msgParseResult.names.map((name, i) => {
                    const known = inCrmNames.has(name);
                    return (
                      <div key={i} className={`px-3 py-2 ${known ? "" : "bg-amber-50"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            {known ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            )}
                            <span className="truncate">{name}</span>
                          </p>
                          <span className={`text-xs rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap border ${
                            known
                              ? "bg-green-50 text-green-800 border-green-200"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}>
                            {known ? "Will update → Messaged" : "Will create (name only)"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  {(!owner || !selectedEvent) && (
                    <p className="text-sm text-amber-600 font-medium">
                      ⚠ {!owner ? "Select who you are" : "Select an event"} at the top before continuing.
                    </p>
                  )}
                  <Button
                    onClick={handleMarkMessaged}
                    disabled={marking || !owner || !selectedEvent}
                    className="w-full"
                  >
                    {marking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Marking as Messaged in Notion…
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Mark {msgParseResult.stats.parsed} contact{msgParseResult.stats.parsed !== 1 ? "s" : ""} as Messaged
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Connected mode: result ─────────────────────────────────────────── */}
      {createResult && outreachStatus === "Connected" && (
        <Card className={createResult.failed > 0 ? "border-destructive" : "border-green-500"}>
          <CardHeader>
            <CardTitle className="text-base">Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{createResult.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{createResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Already existed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{createResult.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            {createResult.created > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                These contacts are now in your <strong>Today</strong> queue — ready to message.
              </p>
            )}
            {createResult.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                <p className="text-xs font-semibold text-destructive">Errors:</p>
                {createResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err.name}: {err.reason}</p>
                ))}
              </div>
            )}
            <Button onClick={reset} variant="outline" className="w-full">
              Import More
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Messaged mode: result ──────────────────────────────────────────── */}
      {markResult && outreachStatus === "Messaged" && (
        <Card className={markResult.failed > 0 ? "border-destructive" : "border-green-500"}>
          <CardHeader>
            <CardTitle className="text-base">Done</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{markResult.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{markResult.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{markResult.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            {markResult.createdMinimal.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1">
                    {markResult.createdMinimal.length} contact{markResult.createdMinimal.length !== 1 ? "s" : ""} created with name only — enrich their profiles:
                  </p>
                  <ul className="text-xs text-amber-700 space-y-0.5">
                    {markResult.createdMinimal.map((name, i) => (
                      <li key={i}>• {name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {markResult.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                <p className="text-xs font-semibold text-destructive">Errors:</p>
                {markResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err.name}: {err.reason}</p>
                ))}
              </div>
            )}
            <Button onClick={reset} variant="outline" className="w-full">
              {isDone ? "Mark More" : "Done"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
