"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/lib/types";

const STAGES = [
  "Awareness",
  "First Attendance",
  "Engaged",
  "Deepening",
  "Activated",
] as const;

type Stage = (typeof STAGES)[number];

function stageBg(stage: Stage) {
  const map: Record<Stage, string> = {
    Awareness: "bg-slate-50 border-slate-200",
    "First Attendance": "bg-blue-50 border-blue-200",
    Engaged: "bg-green-50 border-green-200",
    Deepening: "bg-amber-50 border-amber-200",
    Activated: "bg-purple-50 border-purple-200",
  };
  return map[stage];
}

function stageDot(stage: Stage) {
  const map: Record<Stage, string> = {
    Awareness: "bg-slate-400",
    "First Attendance": "bg-blue-400",
    Engaged: "bg-green-400",
    Deepening: "bg-amber-400",
    Activated: "bg-purple-400",
  };
  return map[stage];
}

interface ConfirmMove {
  contact: Contact;
  from: string;
  to: Stage;
}

export default function PipelinePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmMove | null>(null);
  const [moving, setMoving] = useState(false);
  const dragging = useRef<Contact | null>(null);

  useEffect(() => {
    async function fetchAll() {
      const all: Contact[] = [];
      let cursor: string | null = null;
      do {
        const url = cursor
          ? `/api/contacts/list?cursor=${encodeURIComponent(cursor)}`
          : "/api/contacts/list";
        const res = await fetch(url);
        const d = (await res.json()) as { contacts: Contact[]; nextCursor: string | null };
        all.push(...d.contacts);
        cursor = d.nextCursor;
      } while (cursor);
      setContacts(all);
      setLoading(false);
    }
    fetchAll();
  }, []);

  function handleDragStart(contact: Contact) {
    dragging.current = contact;
  }

  function handleDrop(stage: Stage) {
    const contact = dragging.current;
    dragging.current = null;
    if (!contact || contact.pipelineStage === stage) return;
    setConfirm({ contact, from: contact.pipelineStage, to: stage });
  }

  async function confirmMove() {
    if (!confirm) return;
    setMoving(true);
    try {
      await fetch(`/api/contacts/${confirm.contact.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: confirm.to }),
      });
      setContacts((prev) =>
        prev.map((c) =>
          c.id === confirm.contact.id
            ? { ...c, pipelineStage: confirm.to }
            : c
        )
      );
    } finally {
      setMoving(false);
      setConfirm(null);
    }
  }

  const byStage = (stage: Stage) =>
    contacts.filter((c) => c.pipelineStage === stage);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading pipeline…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pipeline</h1>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className={`flex-shrink-0 w-52 rounded-lg border p-3 space-y-2 ${stageBg(stage)}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${stageDot(stage)}`} />
              <p className="text-xs font-semibold uppercase tracking-wide">
                {stage}
              </p>
              <span className="ml-auto text-xs text-muted-foreground">
                {byStage(stage).length}
              </span>
            </div>

            {byStage(stage).map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => handleDragStart(c)}
                className="bg-background rounded border p-2 cursor-grab active:cursor-grabbing shadow-sm space-y-1 hover:shadow-md transition-shadow"
              >
                <p className="text-sm font-medium leading-tight">{c.name}</p>
                {c.jobTitle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {c.jobTitle}
                  </p>
                )}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {c.tier && (
                    <span className="text-xs text-muted-foreground">{c.tier}</span>
                  )}
                  <Link
                    href={`/messages/${c.id}`}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    title="Write message"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Stage move confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move stage?</DialogTitle>
          </DialogHeader>
          {confirm && (
            <div className="space-y-4 text-sm">
              <p>
                Move <strong>{confirm.contact.name}</strong> from{" "}
                <strong>{confirm.from}</strong> to{" "}
                <strong>{confirm.to}</strong>?
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={moving}
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={moving} onClick={confirmMove}>
                  {moving ? "Moving…" : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
