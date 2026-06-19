

import { Suspense, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Copy, CheckCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { backendFetch } from "@/lib/backend";

type LogStatus = "idle" | "logging" | "logged" | "error";

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

function VariantCard({
  index,
  angle,
  initialText,
  fit,
}: {
  index: number;
  angle: string;
  initialText: string;
  fit: number;
}) {
  const [text, setText] = useState(initialText);
  const charCount = text.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {angle}
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
        </div>
      </CardContent>
    </Card>
  );
}

function MessageInner({ contactId }: { contactId: string }) {
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<{ fit: number; variants: { angle: string; text: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setParsed(null);
    
    try {
      const res = await backendFetch(`/api/contacts/${contactId}/generate_message/`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }
      setParsed(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Generate Message</h1>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? (
            <Loader2 className="size-3.5 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="size-3.5 mr-1.5" />
          )}
          Generate
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Generating message variants&hellip;</p>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {parsed && !loading && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <FitBadge fit={parsed.fit} />
          </div>

          {parsed.variants.map((v, i) => (
            <VariantCard
              key={i}
              index={i}
              angle={v.angle}
              initialText={v.text}
              fit={parsed.fit}
            />
          ))}
        </>
      )}
    </div>
  );
}

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
