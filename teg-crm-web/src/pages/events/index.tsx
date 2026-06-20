

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Calendar, MapPin, User, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { backendFetch } from "@/lib/backend";
import type { EventRecord } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [lumaUrl, setLumaUrl] = useState("");
  const [fitScoringPrompt, setFitScoringPrompt] = useState("Rate 1-5 how relevant this person is for an executive networking group...");
  const [outreachPrompt, setOutreachPrompt] = useState("Hi {name}, I saw you are speaking at {event_name}...");

  // Test Prompt state
  const [testOpen, setTestOpen] = useState(false);
  const [testSelectedId, setTestSelectedId] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState("");

  async function loadEvents() {
    setLoading(true);
    setError("");
    try {
      const res = await backendFetch("/api/events/");
      if (res.ok) {
        const data = await res.json();
        // Django DRF with PageNumberPagination returns { count, next, previous, results }
        // or a list if pagination is not enabled/different
        if (data.results && Array.isArray(data.results)) {
          setEvents(data.results);
        } else if (Array.isArray(data)) {
          setEvents(data);
        } else {
          setEvents([]);
        }
      } else {
        setError("Could not load events from database.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: Could not reach the backend system.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !date) return;
    
    setSubmitting(true);
    try {
      const res = await backendFetch("/api/events/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date,
          luma_url: lumaUrl.trim() || null,
          fit_scoring_prompt: fitScoringPrompt,
          outreach_prompt: outreachPrompt,
        }),
      });

      if (res.ok) {
        setIsOpen(false);
        // Clear form
        setName("");
        setDate("");
        setLumaUrl("");
        // Reload list
        loadEvents();
      } else {
        const errData = await res.json().catch(() => ({}));
        let errorMessage = "Failed to create event. Please check inputs.";
        if (errData.error) {
          errorMessage = errData.error;
        } else if (typeof errData === "object" && errData !== null) {
          const fieldErrors = Object.entries(errData).map(([field, errors]) => {
            const errs = Array.isArray(errors) ? errors.join(", ") : String(errors);
            const fieldName = field.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            return `${fieldName}: ${errs}`;
          });
          if (fieldErrors.length > 0) {
            errorMessage = `Failed to create event:\n${fieldErrors.join("\n")}`;
          }
        }
        alert(errorMessage);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while creating the event.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestPrompt() {
    if (!testSelectedId) return;
    setTestRunning(true);
    setTestResult("");
    try {
        const token = localStorage.getItem("teg_jwt");
        const headers = {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        };
        const res = await fetch(`/api/events/${testSelectedId}/test_prompt/`, {
            method: "POST",
            headers
        });
        const data = await res.json();
        if (res.ok) {
            setTestResult(data.messages.join("\n\n"));
        } else {
            setTestResult("Error: " + (data.error || "Failed to generate test messages"));
        }
    } catch (err) {
        setTestResult("Error connecting to backend");
    } finally {
        setTestRunning(false);
    }
  }

  const filteredEvents = events.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header section with modern gradient design */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-muted">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Outreach Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage target events, ingest Apify LinkedIn leads, and configure AI prompt outreach.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="outline" onClick={() => setTestOpen(true)} className="flex items-center gap-2 hover:scale-105 transition-transform">
            Test Prompts
          </Button>
          <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2 hover:scale-105 transition-transform">
            <Plus className="h-4 w-4" /> Add Event
          </Button>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center gap-2 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/20"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-semibold">Error Loading Events</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" onClick={loadEvents} className="mt-3">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading event registries...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <Card className="border-dashed py-12 text-center bg-muted/10">
          <CardContent className="space-y-3">
            <div className="text-3xl">📅</div>
            <p className="font-semibold text-lg">No events found</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {searchQuery ? "No events match your search query." : "Get started by adding your first target conference or dinner event."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsOpen(true)} variant="outline" size="sm" className="mt-2">
                Create Event Now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`} className="group block">
              <Card className="h-full hover:shadow-md hover:border-primary/50 transition-all group-hover:-translate-y-0.5 duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {event.name}
                    </CardTitle>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-0.5 duration-200" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{new Date(event.date).toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                  {event.luma_url && (
                    <div className="text-primary truncate">
                      🔗 {event.luma_url}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add Event Dialog Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Target Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Event Name</label>
              <Input
                placeholder="e.g. Bits & Pretzels 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Luma Event URL (Optional)</label>
              <Input
                type="url"
                placeholder="https://lu.ma/..."
                value={lumaUrl}
                onChange={(e) => setLumaUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Fit Scoring Prompt</label>
              <textarea
                placeholder="Prompt defining lead fit criteria..."
                value={fitScoringPrompt}
                onChange={(e) => setFitScoringPrompt(e.target.value)}
                className="w-full border rounded p-2 text-sm bg-background"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Outreach Message Prompt</label>
              <textarea
                placeholder="Base prompt template for outreach message..."
                value={outreachPrompt}
                onChange={(e) => setOutreachPrompt(e.target.value)}
                className="w-full border rounded p-2 text-sm bg-background"
                rows={3}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Save Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Test Prompt Dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Test AI Outreach Prompts</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Select Target Event</label>
                    <select
                        value={testSelectedId}
                        onChange={(e) => setTestSelectedId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        <option value="">Select an event...</option>
                        {events.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                    </select>
                </div>
                
                <Button disabled={!testSelectedId || testRunning} onClick={handleTestPrompt} className="w-full">
                    {testRunning ? "Generating..." : "Generate Test Messages"}
                </Button>
                
                {testResult && (
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Generated Test Messages</label>
                        <textarea
                            readOnly
                            value={testResult}
                            className="w-full h-48 border rounded p-2 text-sm bg-muted/20"
                        />
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setTestOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
