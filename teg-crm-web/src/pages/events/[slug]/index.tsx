

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { 
  ArrowLeft, Users, FileText, Upload, Settings, 
  Sparkles, CheckCircle, Edit, Trash, FileSpreadsheet, Loader2, Save 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { backendFetch } from "@/lib/backend";
import type { EventRecord, AttendanceRecord, DraftRecord } from "@/lib/types";

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "drafts" | "import" | "settings">("leads");

  // Tab 1: Leads State
  const [leads, setLeads] = useState<AttendanceRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [generatingForId, setGeneratingForId] = useState<number | null>(null);

  // Tab 2: Drafts State
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingDraftId, setSavingDraftId] = useState<number | null>(null);

  // Tab 3: Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count?: number; error?: string } | null>(null);

  // Tab 4: Settings State
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

  // Load Event Drafts
  async function loadDrafts() {
    setLoadingDrafts(true);
    try {
      const res = await backendFetch(`/api/events/${slug}/drafts/`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDrafts(false);
    }
  }

  useEffect(() => {
    loadEventMeta();
  }, [slug]);

  useEffect(() => {
    if (activeTab === "leads") loadLeads();
    else if (activeTab === "drafts") loadDrafts();
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

  // Edit Draft Inline
  function startEditDraft(draft: DraftRecord) {
    setEditingDraftId(draft.id);
    setEditingText(draft.generated_text);
  }

  async function handleSaveDraft(draftId: number) {
    setSavingDraftId(draftId);
    try {
      const res = await backendFetch(`/api/drafts/${draftId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_text: editingText }),
      });
      if (res.ok) {
        setEditingDraftId(null);
        loadDrafts();
      } else {
        alert("Failed to save draft edits.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDraftId(null);
    }
  }

  // Approve draft
  async function handleApproveDraft(draftId: number) {
    try {
      const res = await backendFetch(`/api/drafts/${draftId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });
      if (res.ok) {
        loadDrafts();
      } else {
        alert("Failed to approve draft.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Import Leads File
  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", importFile);

    try {
      const res = await backendFetch(`/api/events/${slug}/import_leads/`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult({ count: data.count });
        setImportFile(null);
      } else {
        const errData = await res.json();
        setImportResult({ error: errData.error || "Failed to process import file." });
      }
    } catch (err) {
      console.error(err);
      setImportResult({ error: "Failed to upload file to the server." });
    } finally {
      setImporting(false);
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
          onClick={() => setActiveTab("drafts")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "drafts" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" /> Outreach Drafts ({drafts.length})
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "import" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="h-4 w-4" /> Import Leads
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
                  <p className="text-xs text-muted-foreground">Go to the &quot;Import Leads&quot; tab to upload Apify CSV/Excel data.</p>
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
                          {[lead.contact.job_title, lead.contact.company_name].filter(Boolean).join(" @ ") || "—"}
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

        {/* DRAFTS TAB */}
        {activeTab === "drafts" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">AI Outreach Message Queue</h2>

            {loadingDrafts ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading drafts...</p>
              </div>
            ) : drafts.length === 0 ? (
              <Card className="border-dashed py-8 text-center bg-muted/10">
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium">No drafts currently in review queue.</p>
                  <p className="text-xs text-muted-foreground">Click &quot;Generate Message&quot; on the Leads tab to populate the outreach queue.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <Card key={draft.id} className={`border-l-4 hover:shadow-sm transition-shadow ${draft.status === "Approved" ? "border-l-emerald-500" : "border-l-amber-500"}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-base font-bold">
                            {draft.attendance.contact.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Step {draft.step_number} • {draft.attendance.contact.company_name}
                          </CardDescription>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          draft.status === "Approved" 
                            ? "bg-emerald-100 text-emerald-800" 
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {draft.status === "Approved" && <CheckCircle className="h-3 w-3" />}
                          {draft.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {editingDraftId === draft.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full min-h-[100px] text-sm p-2.5 border rounded-md bg-background focus:outline-primary"
                          />
                          <div className="flex justify-end gap-2">
                            <Button 
                              onClick={() => setEditingDraftId(null)} 
                              variant="ghost" 
                              size="sm"
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={() => handleSaveDraft(draft.id)} 
                              disabled={savingDraftId === draft.id} 
                              size="sm"
                              className="text-xs flex items-center gap-1"
                            >
                              {savingDraftId === draft.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm p-3 border rounded bg-muted/20 text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {draft.generated_text}
                          </div>
                          <div className="flex justify-end items-center gap-2 pt-1">
                            <Button 
                              onClick={() => startEditDraft(draft)} 
                              variant="outline" 
                              size="sm" 
                              className="text-xs flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" /> Edit
                            </Button>
                            {draft.status !== "Approved" && (
                              <Button 
                                onClick={() => handleApproveDraft(draft.id)} 
                                variant="default" 
                                size="sm" 
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 hover:scale-105 transition-all flex items-center gap-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Approve
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IMPORT TAB */}
        {activeTab === "import" && (
          <div className="space-y-4 max-w-xl">
            <h2 className="text-xl font-bold">Import Apify LinkedIn Leads</h2>
            <p className="text-xs text-muted-foreground">
              Upload the CSV or Excel file downloaded from Apify containing LinkedIn profiles. The importer will match column headers like Name, LinkedIn URL, Job Title, Company, and Profile Summary automatically.
            </p>

            <Card className="border-dashed bg-muted/5">
              <CardContent className="pt-6">
                <form onSubmit={handleImportSubmit} className="space-y-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 bg-background">
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                    <input 
                      type="file" 
                      accept=".csv,.xlsx" 
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="text-sm"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Supports CSV and Excel files (.xlsx).
                    </p>
                  </div>
                  {importFile && (
                    <div className="text-xs bg-muted p-2 rounded flex items-center justify-between">
                      <span className="truncate font-semibold">{importFile.name}</span>
                      <span className="text-muted-foreground">({(importFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}

                  {importResult && (
                    <div className={`p-3 rounded text-xs font-semibold ${
                      importResult.error 
                        ? "bg-destructive/10 text-destructive border border-destructive/20" 
                        : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    }`}>
                      {importResult.error ? (
                        <p>Error: {importResult.error}</p>
                      ) : (
                        <p>✓ Ingested {importResult.count} attendees successfully from file.</p>
                      )}
                    </div>
                  )}

                  <Button type="submit" disabled={importing || !importFile} className="w-full">
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Ingesting Leads data...
                      </>
                    ) : (
                      "Start Lead Ingestion"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
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
