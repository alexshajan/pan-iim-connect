import { MergeEmailDialog } from "@/components/console/MergeEmailDialog";
import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AccessCtx, useConsoleAccess } from "@/components/console/access";
import {
  Activity, Gauge, IdCard, Mail, CalendarCog, CalendarDays, Megaphone, ClipboardList, Compass, FlaskConical, Inbox, LayoutGrid, LifeBuoy, Menu, Presentation,
  ScanLine, Search, Settings, ShieldCheck, Upload, Users, Building2, MessageCircle, } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { allowedScreens, canEditRegistry, homeScreen, ROLE_LABELS, screenForPath, type ConsoleRole, type Screen } from "@/lib/console-access";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "Console, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "Organizer and volunteer console for Pan-IIM 2026: registry, check-in, slide decks and help desk." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Console, Pan-IIM 2026" },
      { property: "og:description", content: "Internal organizer and volunteer console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsoleLayout,
});

export { useConsoleAccess };

type NavItem = { to: string; label: string; icon: typeof Users; screen: Screen; exact?: boolean };
const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "", items: [{ to: "/console", label: "Overview", icon: LayoutGrid, screen: "overview", exact: true }] },
  {
    label: "Registry",
    items: [
      { to: "/console/data", label: "Data health", icon: Gauge, screen: "data" },
      { to: "/console/people", label: "People", icon: Users, screen: "people" },
      { to: "/console/cards", label: "ID cards", icon: IdCard, screen: "cards" },
      { to: "/console/submissions", label: "Papers", icon: ClipboardList, screen: "submissions" },
      { to: "/console/institutions", label: "Institutions", icon: Building2, screen: "institutions" },
      { to: "/console/imports", label: "Imports", icon: Upload, screen: "imports" },
      { to: "/console/review", label: "Review queue", icon: Inbox, screen: "review" },
    ],
  },
  {
    label: "On-site",
    items: [
      { to: "/console/checkin", label: "Check-in desk", icon: ScanLine, screen: "checkin" },
      { to: "/console/decks", label: "Deck drive", icon: Presentation, screen: "decks" },
      { to: "/console/help", label: "Help queue", icon: LifeBuoy, screen: "help" },
    ],
  },
  {
    label: "Event ops",
    items: [
      { to: "/console/schedule", label: "Schedule", icon: CalendarDays, screen: "schedule" },
      { to: "/console/slotter", label: "Smart Slotter", icon: LayoutGrid, screen: "slotter" },
      { to: "/console/alerts", label: "Alerts", icon: Megaphone, screen: "alerts" },
      { to: "/console/emails", label: "Emails", icon: Mail, screen: "emails" },
      { to: "/console/whatsapp", label: "WhatsApp Studio", icon: MessageCircle, screen: "whatsapp" },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/console/guide", label: "Guide data", icon: Compass, screen: "guide" },
      { to: "/console/placeholders", label: "Test data", icon: FlaskConical, screen: "placeholders" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/console/team", label: "Team & roles", icon: ShieldCheck, screen: "team" },
      { to: "/console/activity", label: "Activity log", icon: Activity, screen: "activity" },
      { to: "/console/settings", label: "Settings", icon: Settings, screen: "settings" },
    ],
  },
];

const HOME_PATH: Record<string, "/console" | "/console/checkin" | "/console/decks" | "/console/help"> = { overview: "/console", checkin: "/console/checkin", decks: "/console/decks", help: "/console/help" };

function ConsoleLayout() {
  const { user, loading } = useAuth();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [q, setQ] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return setRoles(loading ? null : []);
    supabase
      .from("user_roles")
      .select("role")
      .then(({ data }) => setRoles((data ?? []).map((r: { role: string }) => r.role)));
  }, [user, loading]);

  useEffect(() => setNavOpen(false), [pathname]);

  if (roles === null) return <Shell><p className="text-sm text-muted-foreground">Checking access…</p></Shell>;
  const screens = allowedScreens(roles);
  if (!screens.size)
    return (
      <Shell>
        <div className="card-surface max-w-md px-5 py-5">
          <h1 className="text-display text-xl">Organizing team only</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in with an organizer or volunteer account to open the console.</p>
          <Link to="/auth" className="tap mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            Sign in
          </Link>
        </div>
      </Shell>
    );

  const current = screenForPath(pathname);
  const blocked = current && !screens.has(current);
  const home = homeScreen(roles);
  const canEdit = canEditRegistry(roles);

  const sidebar = (
    <nav className="flex flex-col gap-4 px-3 pb-6">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => screens.has(i.screen));
        if (!items.length) return null;
        return (
          <div key={g.label || "top"}>
            {g.label && <p className="px-3 pb-1 text-[0.6rem] text-muted-foreground">{g.label}</p>}
            {items.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: !!n.exact }}
                className="tap flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                activeProps={{ className: "bg-plate text-plate-foreground hover:bg-plate" }}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            ))}
          </div>
        );
      })}
      {screens.has("events") && (
        <div>
          <p className="px-3 pb-1 text-[0.6rem] text-muted-foreground">Older tools</p>
          <Link to="/admin" className="tap flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
            <CalendarCog className="size-4" />
            Dining & services
          </Link>
        </div>
      )}
    </nav>
  );

  return (
    <AccessCtx.Provider value={{ canEdit, roles, screens, userId: user?.id ?? null }}>
      <div className="min-h-dvh bg-background md:flex">
        <aside className="hidden border-r border-border bg-card md:sticky md:top-0 md:block md:h-dvh md:w-60 md:shrink-0 md:overflow-y-auto">
          <Brand />
          {sidebar}
        </aside>
        {navOpen && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setNavOpen(false)}>
            <div className="absolute inset-0 bg-foreground/30" />
            <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
              <Brand />
              {sidebar}
            </aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur md:px-8">
            <button className="tap rounded-lg p-1.5 md:hidden" aria-label="Open menu" onClick={() => setNavOpen(true)}>
              <Menu className="size-5" />
            </button>
            {screens.has("people") ? (
              <form
                className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate({ to: "/console/people", search: q.trim() ? { q: q.trim() } : {} });
                }}
              >
                <Search className="size-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search people, emails, delegate codes…"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </form>
            ) : (
              <div className="flex-1" />
            )}
            <div className="hidden gap-1 sm:flex">
              {roles.filter((r) => r in ROLE_LABELS).map((r) => (
                <span key={r} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {ROLE_LABELS[r as ConsoleRole]}
                </span>
              ))}
            </div>
          </header>
          <main className="px-4 py-6 md:px-8 md:py-8">
            {blocked && current === "overview" && home && home !== "overview" ? (
              <Navigate to={HOME_PATH[home] ?? "/console"} replace />
            ) : blocked ? (
              <div className="card-surface max-w-md px-5 py-5">
                <h1 className="text-display text-xl">Not part of your role</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Ask an admin if you need this screen.</p>
                {home && (
                  <Link to={HOME_PATH[home] ?? "/console"} className="tap mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                    Go to my screen
                  </Link>
                )}
              </div>
            ) : (
              <Outlet />
            )}
            <MergeEmailDialog />
          </main>
        </div>
      </div>
    </AccessCtx.Provider>
  );
}

function Brand() {
  return (
    <div className="px-5 pb-3 pt-5">
      <p className="text-[0.65rem] text-muted-foreground">Pan-IIM 2026</p>
      <p className="text-display text-lg">Console</p>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background px-5 py-10">{children}</div>;
}

export function PageHead({ title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-display text-2xl md:text-3xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export const cx = cn;
