"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, UserPlus, MessageSquare, Camera, Users, KanbanSquare, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/add", label: "Add Contact", icon: UserPlus },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/screenshots", label: "Screenshots", icon: Camera },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

// 5 most-used routes for the mobile bottom bar
const MOBILE_NAV = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/add", label: "Add", icon: UserPlus },
  { href: "/messages", label: "Message", icon: MessageSquare },
  { href: "/screenshots", label: "Photos", icon: Camera },
  { href: "/contacts", label: "Contacts", icon: Users },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) router.push("/login");
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
                href={href}
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
        <div className="border-t p-4">
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
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-background z-10 flex safe-area-inset-bottom">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
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
