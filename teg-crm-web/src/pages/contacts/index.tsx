import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ExternalLink, MessageSquare, Search, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Contact } from "@/lib/types";
import { backendFetch, djangoToFrontendContact } from "@/lib/backend";

interface ContactDetailProps {
  contact: Contact;
  onClose: () => void;
  onUpdated: (updated: Contact) => void;
}

function ContactDetail({ contact, onClose, onUpdated }: ContactDetailProps) {
  const [saving, setSaving] = useState(false);

  async function toggleFollowUp() {
    setSaving(true);
    try {
      const res = await backendFetch(`/api/contacts/${contact.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_complete: !contact.followUpComplete }),
      });
      if (res.ok) {
        onUpdated({ ...contact, followUpComplete: !contact.followUpComplete });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Owner</p>
          <p>{contact.followUpOwner || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Follow-up Complete</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-block w-2 h-2 rounded-full ${contact.followUpComplete ? "bg-green-500" : "bg-amber-500"}`} />
            <span>{contact.followUpComplete ? "Yes" : "No"}</span>
            <Button size="sm" variant="outline" className="h-6 ml-2 text-xs py-0" onClick={toggleFollowUp} disabled={saving}>
              {contact.followUpComplete ? "Mark Pending" : "Mark Complete"}
            </Button>
          </div>
        </div>
      </div>

      {contact.rating && (
        <div className="rounded-md border bg-slate-50/50 p-3 space-y-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Fit Rating</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-lg font-bold text-indigo-700">{contact.rating.score}</span>
              <span className="text-xs text-muted-foreground">/ 5</span>
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 border border-indigo-200 rounded px-1.5 py-0.5">
                {contact.rating.score >= 4 ? "Highly Relevant" : contact.rating.score >= 3 ? "Relevant" : "Low Relevant"}
              </span>
            </div>
          </div>
          {contact.rating.reason && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Rationale</p>
              <p className="text-xs text-muted-foreground mt-0.5 italic leading-relaxed">{contact.rating.reason}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link to={`/messages/${contact.id}`}
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
      </div>
    </div>
  );
}

function ContactsInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const owner = searchParams.get("owner") ?? "";
  const q = searchParams.get("q") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("cursor");
    navigate(`/contacts?${params.toString()}`);
  }

  const fetchContacts = useCallback(async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (owner) params.set("owner", owner);
    if (q) params.set("q", q);
    if (cursor) params.set("page", cursor);

    try {
      setError(null);
      const res = await backendFetch(`/api/contacts/?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to load contacts");
        return;
      }
      const data = await res.json();
      
      let nextCursorStr: string | null = null;
      if (data.next) {
          const urlObj = new URL(data.next);
          nextCursorStr = urlObj.searchParams.get("page") || urlObj.searchParams.get("cursor") || null;
      }

      const results = Array.isArray(data) ? data : (data.results || []);
      const mapped = results.map(djangoToFrontendContact);

      setContacts(cursor ? (prev) => [...prev, ...mapped] : mapped);
      setNextCursor(nextCursorStr);
    } catch (e) {
      setError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [owner, q]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function handleUpdated(updated: Contact) {
    setContacts((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    setSelected(updated);
  }

  const hasFilters = !!(owner || q);

  const [enrichOpen, setEnrichOpen] = useState(false);
  const [enrichText, setEnrichText] = useState("");
  const [enrichSearching, setEnrichSearching] = useState(false);
  const [enrichSelectedId, setEnrichSelectedId] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [matchedContact, setMatchedContact] = useState<Contact | null>(null);

  async function handleEnrichTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setEnrichText(text);
    if (!text.trim()) {
      setMatchedContact(null);
      setEnrichSelectedId(null);
      setEnrichError(null);
      return;
    }
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || "";
    
    if (name.length > 2) {
      setEnrichSearching(true);
      setEnrichError(null);
      setMatchedContact(null);
      setEnrichSelectedId(null);
      try {
        const res = await backendFetch(`/api/contacts/?name=${encodeURIComponent(name)}`);
        if (res.ok) {
          const data = await res.json();
          const results = Array.isArray(data) ? data : (data.results || []);
          if (results.length > 0) {
            const mapped = djangoToFrontendContact(results[0]);
            setMatchedContact(mapped);
            setEnrichSelectedId(mapped.id);
          } else {
            setEnrichError(`Contact "${name}" not found in CRM database.`);
          }
        } else {
          setEnrichError("Failed to lookup contact in database.");
        }
      } catch (err) {
        setEnrichError("Network error checking database.");
      } finally {
        setEnrichSearching(false);
      }
    } else {
      setEnrichError("First line must be at least 3 characters long.");
    }
  }

  async function handleEnrichSubmit() {
    if (!enrichSelectedId) return;
    setEnriching(true);
    try {
      const res = await backendFetch(`/api/contacts/enrich/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw_text: enrichText })
      });
      if (res.ok) {
        setEnrichOpen(false);
        setEnrichText("");
        setEnrichSelectedId(null);
        setMatchedContact(null);
        setEnrichError(null);
        fetchContacts();
      } else {
        alert("Enrichment failed");
      }
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEnrichOpen(true)}>Enrich Profile</Button>
        </div>
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

        <input
          defaultValue={owner}
          placeholder="Owner…"
          className="border rounded px-2 py-1.5 text-sm bg-background w-32"
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("owner", (e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => setParam("owner", e.target.value)}
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/contacts")}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {error ? (
        <div className="p-4 rounded-lg bg-red-100 text-red-700 text-sm border border-red-200">
          <strong>Error:</strong> {error}. Make sure your backend service and SQLite database are configured correctly.
        </div>
      ) : loading && contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts match the current filters.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Owner</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Event</th>
                <th className="px-3 py-2 text-left font-medium">Follow-up</th>
                <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Rating Score</th>
                <th className="px-3 py-2 text-left font-medium hidden xl:table-cell max-w-sm">Rating Rationale</th>
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{c.name}</p>
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                    {c.followUpOwner || "—"}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                    {c.eventName || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${c.followUpComplete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {c.followUpComplete ? "Complete" : "Pending"}
                    </span>
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    {c.rating?.score !== undefined ? (
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
                        c.rating.score >= 4 ? "bg-green-100 text-green-800" :
                        c.rating.score >= 3 ? "bg-blue-100 text-blue-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        ⭐ {c.rating.score}/5
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden xl:table-cell text-muted-foreground max-w-sm truncate">
                    {c.rating?.reason || "—"}
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
      
      {/* Enrich Profile Dialog */}
      <Dialog open={enrichOpen} onOpenChange={setEnrichOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Enrich Contact Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Paste full LinkedIn profile text to attach it to an existing contact.</p>
                <textarea
                    className="w-full h-32 border rounded p-2 text-sm focus-visible:ring-1 focus-visible:ring-ring outline-none"
                    placeholder="Paste profile text..."
                    value={enrichText}
                    onChange={handleEnrichTextChange}
                />
                
                {enrichSearching && (
                    <p className="text-xs text-muted-foreground animate-pulse">Searching CRM database...</p>
                )}
                
                {matchedContact && (
                    <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Matched: {matchedContact.name}</p>
                        </div>
                    </div>
                )}
                
                {enrichError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <span>{enrichError}</span>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setEnrichOpen(false)}>Cancel</Button>
                <Button disabled={!enrichSelectedId || enriching} onClick={handleEnrichSubmit}>
                    {enriching ? "Enriching..." : "Enrich Profile"}
                </Button>
            </DialogFooter>
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
