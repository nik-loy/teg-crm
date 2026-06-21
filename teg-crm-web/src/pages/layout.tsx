

import { Link, useNavigate, useLocation } from "react-router-dom";
import { Home, UserPlus, MessageSquare, Camera, Users, KanbanSquare, LayoutDashboard, Inbox, UserCheck, CalendarRange, Database, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

const NAV = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/pending-requests", label: "Pending Req.", icon: Inbox },
  { href: "/enrichment", label: "Enrichment", icon: UserCheck },
  { href: "/messages", label: "Write a message", icon: MessageSquare },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

// 5 most-used routes for the mobile bottom bar
const MOBILE_NAV = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/pending-requests", label: "Pending", icon: Inbox },
  { href: "/enrichment", label: "Enrichment", icon: UserCheck },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/events", label: "Events", icon: CalendarRange },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();

  async function logout() {
    localStorage.removeItem("teg_jwt");
    navigate("/login");
  }

  async function handleExportLeads() {
    const token = localStorage.getItem("teg_jwt");
    if (!token) {
      alert("You must be logged in to export leads.");
      return;
    }

    try {
      const res = await fetch("/api/contacts/export/", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to export leads.");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "leads_export.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error exporting leads");
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-muted/30">
        <div className="flex h-14 items-center border-b px-4 font-semibold text-lg">
          TEG CRM
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                to={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4 space-y-2">
          <button
            onClick={handleExportLeads}
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " w-full justify-start text-muted-foreground hover:bg-muted hover:text-foreground flex items-center"}
          >
            <Download className="mr-3 h-4 w-4" />
            Export Leads
          </button>
          <a
            href={process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/` : "http://localhost:8000/admin/"}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " w-full justify-start text-muted-foreground hover:bg-muted hover:text-foreground flex items-center"}
          >
            <Database className="mr-3 h-4 w-4" />
            Admin Panel
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={logout}
          >
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 border-b bg-background flex items-center justify-between px-4 z-10">
        <span className="font-semibold">TEG CRM</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportLeads}
            title="Export Leads"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <Download className="h-5 w-5" />
          </button>
          <a
            href={process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/` : "http://localhost:8000/admin/"}
            target="_blank"
            rel="noopener noreferrer"
            title="Admin Panel"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <Database className="h-5 w-5" />
          </a>
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-background z-10 flex safe-area-inset-bottom">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              to={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Spacer for mobile top bar */}
        <div className="md:hidden h-14" />
        {children}
        {/* Spacer for mobile bottom nav */}
        <div className="md:hidden h-16" />
      </main>
    </div>
  );
}
