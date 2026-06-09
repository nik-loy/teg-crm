"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Contact } from "@/lib/types";

const STAGE_BADGE: Record<string, string> = {
  Awareness: "bg-slate-100 text-slate-700",
  "First Attendance": "bg-blue-100 text-blue-700",
  Engaged: "bg-green-100 text-green-700",
  Deepening: "bg-amber-100 text-amber-700",
  Activated: "bg-purple-100 text-purple-700",
};

const STATUS_BADGE: Record<string, string> = {
  Connected: "bg-emerald-100 text-emerald-700",
  Messaged: "bg-sky-100 text-sky-700",
  "Request Sent": "bg-gray-100 text-gray-600",
};

export default function MessagesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);

    if (!q.trim()) {
      setContacts([]);
      setSearched(false);
      return;
    }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/contacts/list?q=${encodeURIComponent(q.trim())}`
        );
        const data = (await res.json()) as { contacts: Contact[] };
        setContacts(data.contacts);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Write a message</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for a contact to generate 3 personalised LinkedIn variants.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a contact name…"
          className="pl-9 pr-9"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {searched && contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No contacts found for &ldquo;{q}&rdquo;.{" "}
          <a href="/add" className="text-primary underline">
            Add them first.
          </a>
        </p>
      )}

      <div className="space-y-2">
        {contacts.map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`/messages/${c.id}`)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm">{c.name}</p>
              {(c.jobTitle || c.company) && (
                <p className="text-xs text-muted-foreground truncate">
                  {[c.jobTitle, c.company].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {c.outreachStatus && STATUS_BADGE[c.outreachStatus] && (
                <span
                  className={`hidden sm:inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.outreachStatus]}`}
                >
                  {c.outreachStatus}
                </span>
              )}
              {c.pipelineStage && (
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[c.pipelineStage] ?? "bg-slate-100 text-slate-700"}`}
                >
                  {c.pipelineStage}
                </span>
              )}
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {!searched && (
        <div className="mt-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Start typing a name to find your contact.
          </p>
        </div>
      )}
    </div>
  );
}
