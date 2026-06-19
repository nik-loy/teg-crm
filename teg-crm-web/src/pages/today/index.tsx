import { useEffect, useState } from "react";
import type { Contact } from "@/lib/types";
import { backendFetch, djangoToFrontendContact } from "@/lib/backend";
import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

function ContactRow({ contact }: { contact: Contact }) {
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(" · ") || "—";
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0 hover:bg-muted/30 px-2 rounded">
      <div className="min-w-0 flex-1 cursor-pointer">
        <Link to={`/contacts?q=${encodeURIComponent(contact.name)}`} className="block">
          <p className="font-medium text-sm truncate hover:underline">{contact.name || "Unnamed"}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline-block">
            Updated: {new Date(contact.updatedAt || "").toLocaleDateString()}
        </span>
        <Link to={`/messages/${contact.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
            Message
        </Link>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function fetchToday() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await backendFetch("/api/contacts/today/");
      if (!res.ok) {
          throw new Error("Failed to fetch today's contacts");
      }
      const data = await res.json();
      const rawContacts = Array.isArray(data) ? data : (data.results || []);
      setContacts(rawContacts.map(djangoToFrontendContact));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not reach backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchToday();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Today's Latest Updates</h1>
        <Button size="sm" variant="outline" onClick={fetchToday} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
        </Button>
      </div>

      {errorMsg && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-medium">Failed to load</p>
            <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
          </CardContent>
        </Card>
      )}

      {!loading && contacts.length === 0 && !errorMsg && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-medium">You&apos;re all caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No latest contacts found.</p>
          </CardContent>
        </Card>
      )}

      {contacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>Top 10 Latest Contacts</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                {contacts.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
