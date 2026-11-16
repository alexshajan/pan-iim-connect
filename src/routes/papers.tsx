import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthorLine } from "@/components/papers/AuthorLine";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Search, Star } from "lucide-react";
import { AppShell, EmptyNote } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useBookmarks } from "@/hooks/useBookmarks";
import { sessionsQuery } from "@/lib/conference";
import { filterPapers, flattenPapers, trackCounts } from "@/lib/paper-browse";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const search = (s: Record<string, unknown>) => ({ q: str(s["q"]), track: str(s["track"]), mode: str(s["mode"]) });

export const Route = createFileRoute("/papers")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Papers, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "Browse every paper at the 11th Pan-IIM WMC by track, mode and author, and star the ones you want to hear." },
      { property: "og:title", content: "Papers, 11th Pan-IIM WMC" },
      { property: "og:description", content: "Every paper by track, with its slot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PapersPage,
});

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function PapersPage() {
  const { q, track, mode } = Route.useSearch();
  const nav = useNavigate({ from: "/papers" });
  const set = (patch: Partial<{ q: string; track: string; mode: string }>) => nav({ search: (p) => ({ ...p, ...patch }), replace: true });
  const { user } = useAuth();
  const { starred, toggle } = useBookmarks(user?.id ?? null);
  const sessions = useQuery(sessionsQuery);
  const all = useMemo(() => flattenPapers(sessions.data ?? []), [sessions.data]);
  const tracks = useMemo(() => trackCounts(all), [all]);
  const list = filterPapers(all, { q, track, mode }).slice(0, 200);

  return (
    <AppShell title="Papers">
      <label className="card-surface flex items-center gap-2 px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => set({ q: e.target.value })} placeholder="Title, author, institute or ID" className="w-full bg-transparent text-sm outline-none" />
      </label>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {([["", "All"], ["in_person", "In person"], ["online", "Online"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => set({ mode: v })} className={`tap shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold ${mode === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{l}</button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((t) => (
          <button key={t.track} type="button" onClick={() => set({ track: track === t.track ? "" : t.track })}
            className={`tap index-card px-3 py-2.5 text-left ${track === t.track ? "ring-2 ring-primary" : ""}`}>
            <span className="flex items-baseline justify-between gap-2"><span className="text-sm font-semibold leading-tight">{t.track}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {sessions.isLoading ? <EmptyNote>Loading papers…</EmptyNote> : !list.length ? <EmptyNote>No papers match.</EmptyNote> : null}
        {list.map((p) => {
          const on = starred.includes(p.sessionId);
          return (
            <div key={p.id} className="index-card flex gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
              <Link to="/session/$sessionId" params={{ sessionId: p.sessionId }} className="block">
                <p className="text-[0.68rem] text-muted-foreground">{p.code ? `#${p.code}, ` : ""}{p.track}{p.mode === "online" ? ", Online" : ""}</p>
                <p className="text-display text-[0.98rem] leading-snug">{p.title}</p>
              </Link>
              <AuthorLine compact className="mt-1" authors={p.authorList} presenter={p.presenter} submissionId={p.id} />
              <Link to="/session/$sessionId" params={{ sessionId: p.sessionId }} className="mt-1 block text-xs font-medium text-primary tabular-nums">{fmt(p.startsAt)}{p.room ? `, ${p.room}` : ""}</Link>
              </div>
              {user ? (
                <button type="button" aria-label={on ? "Unstar session" : "Star session"} onClick={() => toggle(p.sessionId)} className="tap self-start rounded-md p-1.5 text-warn">
                  <Star className="h-5 w-5" fill={on ? "currentColor" : "none"} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
