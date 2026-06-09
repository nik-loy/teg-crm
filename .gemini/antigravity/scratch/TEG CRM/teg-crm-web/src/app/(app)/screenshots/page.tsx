"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExtractedRow {
  name: string;
  job_title: string;
  company: string;
}

type RowStatus = "idle" | "creating" | "created" | "existing" | "error";

interface TableRow extends ExtractedRow {
  id: number;
  status: RowStatus;
  errorMsg?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip data:image/...;base64, prefix
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function RowStatusIcon({ status }: { status: RowStatus }) {
  if (status === "creating") return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  if (status === "created") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "existing") return <CheckCircle className="h-4 w-4 text-amber-500" />;
  if (status === "error") return <AlertCircle className="h-4 w-4 text-red-500" />;
  return null;
}

export default function ScreenshotsPage() {
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const processFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    setExtracting(true);
    setExtractError(null);
    setRows([]);
    setConfirmed(false);

    try {
      const base64List = await Promise.all(images.map(fileToBase64));
      const res = await fetch("/api/screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: base64List }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { contacts: ExtractedRow[] };
      const newRows: TableRow[] = data.contacts.map((c) => ({
        ...c,
        id: nextId.current++,
        status: "idle",
      }));
      setRows(newRows);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(Array.from(e.target.files));
    },
    [processFiles]
  );

  function updateRow(id: number, field: keyof ExtractedRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function deleteRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function createContacts() {
    setConfirmed(true);
    const toCreate = rows.filter((r) => r.name.trim() && r.status === "idle");

    for (const row of toCreate) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: "creating" } : r))
      );

      try {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name.trim(),
            jobTitle: row.job_title.trim() || undefined,
            status: "request_sent",
            notes: "Created from LinkedIn screenshot — URL not yet captured",
          }),
        });

        const data = (await res.json()) as {
          created?: boolean;
          existing?: boolean;
          merged?: boolean;
          error?: string;
        };

        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

        const nextStatus: RowStatus =
          data.created ? "created" : "existing";

        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, status: nextStatus } : r
          )
        );
      } catch (e) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  status: "error",
                  errorMsg: e instanceof Error ? e.message : "Failed",
                }
              : r
          )
        );
      }
    }
  }

  const idleCount = rows.filter((r) => r.status === "idle" && r.name.trim()).length;
  const allDone = rows.length > 0 && rows.every((r) => r.status !== "idle" && r.status !== "creating");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Screenshot Batch</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop LinkedIn "Sent Invitations" screenshots to extract contacts.
          Review and edit before creating Notion records.
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors
          ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"}`}
      >
        {extracting ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground text-center">
          {extracting
            ? "Extracting contacts via GPT-4o Vision…"
            : "Drag & drop screenshots here, or click to select"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {extractError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {extractError}
        </div>
      )}

      {/* Editable preview table */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {rows.length} contact{rows.length !== 1 ? "s" : ""} extracted — edit before saving
            </p>
            {!allDone && (
              <Button
                size="sm"
                onClick={createContacts}
                disabled={idleCount === 0}
              >
                Create {idleCount} contact{idleCount !== 1 ? "s" : ""} in Notion
              </Button>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Job Title</th>
                  <th className="px-3 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <RowStatusIcon status={row.status} />
                        <input
                          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-ring rounded px-1 disabled:opacity-60"
                          value={row.name}
                          onChange={(e) => updateRow(row.id, "name", e.target.value)}
                          disabled={row.status !== "idle"}
                          placeholder="Name"
                        />
                      </div>
                      {row.status === "error" && row.errorMsg && (
                        <p className="text-xs text-destructive mt-0.5 pl-6">{row.errorMsg}</p>
                      )}
                      {row.status === "existing" && (
                        <p className="text-xs text-amber-600 mt-0.5 pl-6">Already in Notion</p>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-ring rounded px-1 disabled:opacity-60"
                        value={row.job_title}
                        onChange={(e) => updateRow(row.id, "job_title", e.target.value)}
                        disabled={row.status !== "idle"}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-ring rounded px-1 disabled:opacity-60"
                        value={row.company}
                        onChange={(e) => updateRow(row.id, "company", e.target.value)}
                        disabled={row.status !== "idle"}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {row.status === "idle" && (
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remove row"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {allDone && (
            <p className="text-sm text-green-600 font-medium">
              Done — contacts created. Fill in LinkedIn URLs once requests are accepted.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
