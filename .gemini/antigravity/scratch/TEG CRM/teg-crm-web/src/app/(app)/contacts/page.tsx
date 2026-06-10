"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, MessageSquare, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/lib/types";

const STAGES = ["Awareness", "First Attendance", "Engaged", "Deepening", "Activated"];
const TIERS = ["Tier 1", "Tier 2", "Tier 3"];
const STATUSES = ["Request Sent", "Connected", "Messaged", "No Response", "Withdrawn"];

function stageBadge(stage: string) {
  const map: Record<string, string> = {
    Awareness: "bg-slate-100 text-slate-700",
    "First Attendance": "bg-blue-100 text-blue-700",
    Engaged: "bg-green-100 text-green-700",
    Deepening: "bg-amber-100 text-amber-700",
    Activated: "bg-purple-100 text-purple-700",
  };
  return map[stage] ?? "bg-slate-100 text-slate-700";
}

function tierBadge(tier: string) {
  const map: Record<string, string> = {
    "Tier 1": "bg-orange-100 text-orange-700",
    "Tier 2": "bg-yellow-100 text-yellow-700",
    "Tier 3": "bg-gray-100 text-gray-600",
  };
  return map[tier] ?? "bg-gray-100 text-gray-600";
}

interface ContactDetailProps {
  contact: Contact;
  onClose: () => void;
  onUpdated: (updated: Contact) => void;
}

function ContactDetail({ contact, onClose, onUpdated }: ContactDetailProps) {
  const [stage, setStage] = useState(contact.pipelineStage);
  const [tier, setTier] = useState(contact.tier);
  const [status, setStatus] = useState(contact.outreachStatus);
  const [saving, setSaving] = useState(false);
  const [confirmStage, setConfirmStage] = useState<string | null>(null);

  async function patchStage(newStage: string) {
    setSaving(true);
    try {
      await fetch(`/api/contacts/${contact.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      setStage(newStage);
      onUpdated({ ...contact, pipelineStage: newStage });
    } finally {
      setSaving(false);
      setConfirmStage(null);
    }
  }

  async function patchField(field: "tier" | "status", value: string) {
    setSaving(true);
    const propertyMap: Record<string, string> = {
      tier: "Tier",
      status: "LinkedIn Outreach Status",
    };
    try {
      await fetch(`/api/contacts/${contact.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: propertyMap[field], value }),
      });
      if (field === "tier") setTier(value);
      else setStatus(value);
      onUpdated({
        ...contact,
        tier: field === "tier" ? value : tier,
        outreachStatus: field === "status" ? value : status,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Job Title</p>
          <p>{contact.jobTitle || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Company</p>
          <p>{contact.company || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Owner</p>
          <p>{contact.outreachOwner || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Contact</p>
          <p>{contact.lastContactDate || "—"}</p>
        </div>
      </div>

      {contact.events && contact.events.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Events</p>
          <div className="flex flex-wrap gap-1">
            {contact.events.map((e) => (
              <span key={e} className="inline-block rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {contact.notes && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-muted-foreground">{contact.notes}</p>
        </div>
      )}

      {/* Inline edit: Stage (confirm required) */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pipeline Stage</p>
        {confirmStage ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">Move to <strong>{confirmStage}</strong>?</span>
            <Button size="sm" variant="default" disabled={saving} onClick={() => patchStage(confirmStage)}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmStage(null)}>Cancel</Button>
          </div>
        ) : (
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={stage}
            disabled={saving}
            onChange={(e) => setConfirmStage(e.target.value)}
          >
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Inline edit: Tier */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tier</p>
        <select
          className="border rounded px-2 py-1 text-sm bg-background"
          value={tier}
          disabled={saving}
          onChange={(e) => patchField("tier", e.target.value)}
        >
          {TIERS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Inline edit: Outreach Status */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">LinkedIn Status</p>
        <select
          className="border rounded px-2 py-1 text-sm bg-background"
          value={status}
          disabled={saving}
          onChange={(e) => patchField("status", e.target.value)}
        >
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <Link
          href={`/messages/${contact.id}`}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          onClick={onClose}
        >
          <MessageSquare className="h-4 w-4" />
          Write message
        </Link>
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            LinkedIn
          </a>
        )}
        {contact.notionUrl && (
          <a
            href={contact.notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Notion
          </a>
        )}
      </div>
    </div>
  );
}

function ContactsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const stage = searchParams.get("stage") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const owner = searchParams.get("owner") ?? "";
  const event = searchParams.get("event") ?? "";
  const q = searchParams.get("q") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("cursor");
    router.push(`/contacts?${params.toString()}`);
  }

  const fetchContacts = useCallback(async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (tier) params.set("tier", tier);
    if (owner) params.set("owner", owner);
    if (event) params.set("event", event);
    if (q) params.set("q", q);
    if (cursor) params.set("cursor", cursor);

    try {
      const res = await fetch(`/api/contacts/list?${params.toString()}`);
      const data = (await res.json()) as {
        contacts: Contact[];
        nextCursor: string | null;
      };
      setContacts(cursor ? (prev) => [...prev, ...data.contacts] : data.contacts);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [stage, tier, owner, event, q]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function handleUpdated(updated: Contact) {
    setContacts((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    setSelected(updated);
  }

  const hasFilters = !!(stage || tier || owner || event || q);
  const [events, setEvents] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch available events on mount
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events ?? []);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingEvents(false);
      }
    }
    fetchEvents();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <Link href="/add">
          <Button size="sm">+ Add contact</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchRef}
            defaultValue={q}
            placeholder="Search name…"
            className="border rounded pl-7 pr-3 py-1.5 text-sm bg-background w-48"
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
            }}
            onBlur={(e) => setParam("q", e.target.value)}
          />
        </div>

        <select
          className="border rounded px-2 py-1.5 text-sm bg-background"
          value={stage}
          onChange={(e) => setParam("stage", e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select
          className="border rounded px-2 py-1.5 text-sm bg-background"
          value={tier}
          onChange={(e) => setParam("tier", e.target.value)}
        >
          <option value="">All tiers</option>
          {TIERS.map((t) => <option key={t}>{t}</option>)}
        </select>

        <input
          defaultValue={owner}
          placeholder="Owner…"
          className="border rounded px-2 py-1.5 text-sm bg-background w-32"
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("owner", (e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => setParam("owner", e.target.value)}
        />

        {!loadingEvents && events.length > 0 && (
          <select
            className="border rounded px-2 py-1.5 text-sm bg-background"
            value={event}
            onChange={(e) => setParam("event", e.target.value)}
          >
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/contacts")}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {loading && contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts match the current filters.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Stage</th>
                <th className="px-3 py-2 text-left font-medium">Tier</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Status</th>
                <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Owner</th>
                <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Last Contact</th>
                <th className="px-3 py-2 text-left font-medium hidden xl:table-cell">Events</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelected(c)}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.name}</p>
                    {c.jobTitle && (
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {c.jobTitle}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stageBadge(c.pipelineStage)}`}>
                      {c.pipelineStage || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {c.tier && (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tierBadge(c.tier)}`}>
                        {c.tier}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                    {c.outreachStatus || "—"}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">
                    {c.outreachOwner || "—"}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">
                    {c.lastContactDate || "—"}
                  </td>
                  <td className="px-3 py-2 hidden xl:table-cell">
                    {c.events && c.events.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.events.map((e) => (
                          <span key={e} className="inline-block rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                            {e}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => fetchContacts(nextCursor)}
        >
          Load more
        </Button>
      )}

      {/* Side dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <ContactDetail
              contact={selected}
              onClose={() => setSelected(null)}
              onUpdated={handleUpdated}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsInner />
    </Suspense>
  );
}
