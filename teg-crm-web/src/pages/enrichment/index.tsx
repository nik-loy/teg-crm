import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { backendFetch } from "@/lib/backend";

export default function EnrichmentPage() {
  const [pastedText, setPastedText] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleEnrich() {
    if (!pastedText.trim()) return;
    setEnriching(true);
    setResult(null);

    try {
      const res = await backendFetch("/api/contacts/enrich/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw_text: pastedText,
        }),
      });

      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        setResult({ success: true, message: data.status || "Profile enriched successfully." });
        setPastedText("");
      } else {
        setResult({ success: false, message: data.error || "Failed to enrich profile." });
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Unknown error occurred" });
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enrichment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste the raw text of a LinkedIn profile to enrich the contact and calculate their fit score.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste LinkedIn Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Copy the entire text from the contact's LinkedIn profile page (Ctrl+A, Ctrl+C). 
            The first line must be the contact's exact name as it appears in the CRM.
          </p>
          <textarea
            rows={15}
            placeholder="John Doe&#10;VP of Engineering @ TechCorp&#10;..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs resize-y"
          />
          <Button
            onClick={handleEnrich}
            disabled={enriching || !pastedText.trim()}
            className="w-full"
          >
            {enriching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enriching Profile…
              </>
            ) : (
              "Enrich Profile"
            )}
          </Button>

          {result && (
            <div className={`rounded-md p-4 mt-4 ${result.success ? "bg-green-50 border border-green-200" : "bg-destructive/10 border border-destructive/20"}`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <Loader2 className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className={`text-sm ${result.success ? "text-green-800" : "text-destructive"}`}>
                  {result.message}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
