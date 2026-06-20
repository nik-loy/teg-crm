

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { 
  ArrowLeft, Users, Settings, 
  Sparkles, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { backendFetch } from "@/lib/backend";
import type { EventRecord, AttendanceRecord } from "@/lib/types";

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "settings">("leads");

  // Tab 1: Leads State
  const [leads, setLeads] = useState<AttendanceRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [generatingForId, setGeneratingForId] = useState<number | null>(null);

  // Tab 2: Settings State
  const [fitPrompt, setFitPrompt] = useState("");
  const [outreachPrompt, setOutreachPrompt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Load Event Meta
  async function loadEventMeta() {
    setLoadingEvent(true);
    try {
      const res = await backendFetch(`/api/events/${slug}/`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
        setFitPrompt(data.fit_scoring_prompt || "");
        setOutreachPrompt(data.outreach_prompt || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEvent(false);
    }
  }

  // Load Event Leads
  async function loadLeads() {
    setLoadingLeads(true);
    try {
      const res = await backendFetch(`/api/events/${slug}/attendances/`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  }

  useEffect(() => {
    loadEventMeta();
  }, [slug]);

  useEffect(() => {
    if (activeTab === "leads") loadLeads();
  }, [activeTab, slug]);

  // Generate outreach message
  async function handleGenerate(attendanceId: number) {
    setGeneratingForId(attendanceId);
    try {
      const res = await backendFetch(`/api/attendances/${attendanceId}/generate_message/`, {
        method: "POST",
      });
      if (res.ok) {
        alert("Scoring finished and message draft successfully generated!");
        loadLeads(); // refresh fit score
      } else {
        alert("Failed to generate outreach draft.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error occurred during AI message generation.");
    } finally {
      setGeneratingForId(null);
    }
  }

  // Save Event Prompts Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await backendFetch(`/api/events/${slug}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fit_scoring_prompt: fitPrompt,
          outreach_prompt: outreachPrompt,
        }),
      });
      if (res.ok) {
        alert("Event prompts configuration saved successfully.");
        loadEventMeta();
      } else {
        alert("Failed to update prompts.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  }

  function getScoreBadge(score: number | null) {
    if (score === null) return "bg-gray-100 text-gray-500 border border-gray-200";
    if (score >= 4) return "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (score >= 3) return "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-300";
    return "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300";
  }

  if (loadingEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading event dashboard...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-lg font-semibold text-destructive">Event Not Found</p>
        <Link to="/events">
          <Button variant="outline">Back to Events</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back button & Event Title */}
      <div className="space-y-2">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to events
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              {event.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Event Details & Leads Management for `{event.slug}`.
            </p>
          </div>
          {event.luma_url && (
            <a 
              href={event.luma_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 font-medium hover:bg-primary/20 transition-all self-start md:self-auto"
            >
              🔗 Open Luma Event
            </a>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => setActiveTab("leads")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "leads" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" /> Leads ({leads.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "settings" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-4 w-4" /> Prompts Settings
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        
        {/* LEADS TAB */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Attendee Scoring & Fit</h2>
              <p className="text-xs text-muted-foreground">Sorted by AI score descending</p>
            </div>

            {loadingLeads ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading leads list...</p>
              </div>
            ) : leads.length === 0 ? (
              <Card className="border-dashed py-8 text-center bg-muted/10">
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium">No leads currently registered for this event.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-card">
                <div className="divide-y">
                  {leads.map((lead) => (
                    <div key={lead.id} className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-muted/10 transition-colors">
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-base">{lead.contact.name}</span>
                          {lead.contact.linkedin_url && (
                            <a 
                              href={lead.contact.linkedin_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-xs text-primary hover:underline"
                            >
                              LinkedIn ↗
                            </a>
                          )}
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getScoreBadge(lead.fit_score)}`}>
                            {lead.fit_score !== null ? `Score: ${lead.fit_score}/5` : "Unscored"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          —
                        </p>
                        {lead.fit_reason && (
                          <div className="mt-2 text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 py-0.5 bg-muted/20 rounded-r">
                            <strong>AI Reason:</strong> {lead.fit_reason}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 self-start md:self-center">
                        <Button 
                          onClick={() => handleGenerate(lead.id)} 
                          disabled={generatingForId === lead.id}
                          variant="outline" 
                          size="sm"
                          className="flex items-center gap-1.5 text-xs hover:border-primary/50"
                        >
                          {generatingForId === lead.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Scoring...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              Generate Message
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-xl font-bold">Configure Event AI Settings</h2>
            <p className="text-xs text-muted-foreground">
              Define the prompts specifically tailored for this event. These prompts dictate how AI scores registrations and constructs custom invitations.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">AI Lead Fit Criteria Prompt</label>
                <textarea
                  value={fitPrompt}
                  onChange={(e) => setFitPrompt(e.target.value)}
                  placeholder="Define criteria to evaluate lead compatibility (e.g. rate 5 if they are a CEO, 1 if freelancer)..."
                  className="w-full min-h-[120px] text-sm p-3 border rounded bg-background focus:outline-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Outreach Invitation Message Prompt</label>
                <textarea
                  value={outreachPrompt}
                  onChange={(e) => setOutreachPrompt(e.target.value)}
                  placeholder="e.g. Hi {name}, I saw you are speaking at {event_name} about {topic}..."
                  className="w-full min-h-[120px] text-sm p-3 border rounded bg-background focus:outline-primary"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use placeholders like {"{name}"}, {"{company}"}, and {"{event_name}"} to inject dynamically.
                </p>
              </div>

              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Prompts Settings"
                )}
              </Button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
