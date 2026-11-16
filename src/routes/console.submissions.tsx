import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Loader2, Monitor, MapPin, Pencil, X } from "lucide-react";
import { PaperEditor, rowsFor } from "@/components/console/PaperEditor";
import { db } from "@/lib/registry-data";
import { downloadCsv } from "@/lib/csv";
import { rangeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHead } from "./console";
import { peopleQuery, type Person } from "@/lib/registry-data";
import { PersonEditor } from "@/components/console/PersonEditor";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const Route = createFileRoute("/console/submissions")({ component: PapersPage });

type Link = { id: string; role: string; is_presenter: boolean; people: { id: string; full_name: string; email: string; organization: string | null; delegate_code: string } | null };
type Paper = {
  id: string;
  submission_code: string;
  title: string | null;
  track: string | null;
  presentation_mode: string;
  data_flag: string | null;
  session_order: number | null;
  sessions: { title: string; session_code: string | null; starts_at: string; ends_at: string; room: string | null; mode: string | null } | null;
  submission_people: Link[];
  presenter_name: string | null;
  authors: { name: string; org?: string | null }[];
};

const papersQuery = queryOptions({
  queryKey: ["registry", "papers-console"],
  queryFn: async () => {
    const { data, error } = await db
      .from("submissions")
      .select(
        "id, submission_code, title, track, presenter_name, authors, presentation_mode, data_flag, session_order, sessions(title, session_code, starts_at, ends_at, room, mode), submission_people(id, role, is_presenter, people(id, full_name, email, organization, delegate_code))",
      )
      .eq("is_placeholder", false)
      .order("submission_code");
    if (error) throw error;
    return (data ?? []) as unknown as Paper[];
  },
});

type Filter = "all" | "flag" | "nopres" | "offline" | "online" | "noslot" | "multi";
const hasPresenter = (s: Paper) => rowsFor(s).rows.some((r) => r.presenting) || s.submission_people.some((l) => l.is_presenter);
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["flag", "Needs a decision"],
  ["nopres", "No presenter"],
  ["offline", "In person"],
  ["online", "Online"],
  ["noslot", "No slot"],
  ["multi", "Multi-paper people"],
];

function PapersPage() {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery(papersQuery);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Paper | null>(null);
  const people = useQuery(peopleQuery);
  const [openPerson, setOpenPerson] = useState<Person | null>(null);
  const papersPerPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data) for (const l of s.submission_people) if (l.people) m.set(l.people.id, (m.get(l.people.id) ?? 0) + 1);
    return m;
  }, [data]);

  const counts: Record<Filter, number> = {
    all: data.length,
    flag: data.filter((s) => s.data_flag).length,
    nopres: data.filter((s) => !hasPresenter(s)).length,
    offline: data.filter((s) => s.presentation_mode === "offline").length,
    online: data.filter((s) => s.presentation_mode === "online").length,
    noslot: data.filter((s) => !s.sessions).length,
    multi: data.filter((s) => s.submission_people.some((l) => l.people && (papersPerPerson.get(l.people.id) ?? 0) > 1)).length,
  };

  const t = q.trim().toLowerCase();
  const rows = data.filter((s) => {
    if (filter === "flag" && !s.data_flag) return false;
    if (filter === "nopres" && hasPresenter(s)) return false;
    if (filter === "offline" && s.presentation_mode !== "offline") return false;
    if (filter === "online" && s.presentation_mode !== "online") return false;
    if (filter === "noslot" && s.sessions) return false;
    if (filter === "multi" && !s.submission_people.some((l) => l.people && (papersPerPerson.get(l.people.id) ?? 0) > 1)) return false;
    if (!t) return true;
    return (
      s.submission_code.includes(t) ||
      (s.title ?? "").toLowerCase().includes(t) ||
      (s.authors ?? []).some((a) => a.name.toLowerCase().includes(t)) ||
      (s.sessions?.session_code ?? "").toLowerCase().includes(t) ||
      s.submission_people.some((l) => l.people && (l.people.full_name.toLowerCase().includes(t) || l.people.email.includes(t)))
    );
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["registry"] });

  const [pending, setPending] = useState<string | null>(null);
  // No window.confirm (blocked in the preview frame): ask through a toast with an action.
  function setMode(s: Paper, mode: "offline" | "online") {
    if (s.presentation_mode === mode || pending) return;
    const label = mode === "online" ? "online" : "in person";
    const clash = s.sessions?.mode && s.sessions.mode !== mode ? `Its session ${s.sessions.session_code ?? ""} is ${s.sessions.mode === "online" ? "online" : "in person"}, so this will clash.` : "Presenters' campus status updates with it.";
    toast(`Change #${s.submission_code} to ${label}?`, {
      description: clash,
      action: { label: "Change", onClick: async () => {
        setPending(s.id);
        const t = toast.loading(`Switching #${s.submission_code}…`);
        const { error } = await db.rpc("set_presentation_mode", { _submission: s.id, _mode: mode });
        if (error) toast.error("Couldn't change mode", { id: t, description: error.message });
        else { toast.success(`#${s.submission_code} is now ${label}`, { id: t, description: "Check its session slot still fits." }); await refresh(); }
        setPending(null);
      } },
      cancel: { label: "Keep", onClick: () => {} },
    });
  }
  return (
    <>
      <PageHead eyebrow={`${data.length} papers`} title="Papers">
        <button
          onClick={() => {
            toast.success(`Exported ${rows.length} papers`);
            downloadCsv(
              "papers.csv",
              rows.map((s) => ({
                id: s.submission_code,
                title: s.title,
                mode: s.presentation_mode,
                session: s.sessions?.session_code ?? "",
                time: s.sessions ? rangeLabel(s.sessions.starts_at, s.sessions.ends_at) : "",
                room: s.sessions?.room ?? "",
                order: s.session_order ?? "",
                people: s.submission_people.map((l) => `${l.people?.full_name} <${l.people?.email}>`).join("; "),
                flag: s.data_flag ?? "",
              })),
            );
          }}
          className="tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </PageHead>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "tap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-95",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
              f === "flag" && counts.flag > 0 && filter !== f && "border-warn",
            )}
          >
            {label}, {counts[f]}
          </button>
        ))}
      </div>
      <div className="relative mb-4 flex max-w-md items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paper ID, title, session code, person or email"
          className="w-full rounded-full border border-border bg-card px-4 py-2 pr-20 text-sm transition-shadow focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
        <span className="absolute right-9 text-xs tabular-nums text-muted-foreground">{t ? rows.length : ""}</span>
        {q ? <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="tap absolute right-2 rounded-full p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button> : null}
      </div>
      {isPending ? <p className="text-sm text-muted-foreground">Loading papers…</p> : null}

      <ul className="grid gap-2.5 lg:grid-cols-2">
        {rows.slice(0, 150).map((s) => (
          <li key={s.id} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 140px" }} className={cn("card-surface px-4 py-3 transition-opacity", pending === s.id && "opacity-60", editing?.id === s.id && "ring-2 ring-primary", s.data_flag && "ring-1 ring-warn")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tabular-nums text-muted-foreground">
                  #{s.submission_code}
                  {s.track ? <span className="font-medium">, {s.track}</span> : null}
                </p>
                <p className="mt-0.5 text-sm leading-snug font-medium">{s.title ?? <span className="text-muted-foreground">Title awaited</span>}</p>
              </div>
              <div className="flex shrink-0 rounded-full bg-muted p-0.5" role="group" aria-label="Presentation mode">
                {(["offline", "online"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(s, m)}
                    disabled={pending === s.id}
                    className={cn("tap inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold transition-all duration-200 active:scale-95", s.presentation_mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}
                  >
                    {pending === s.id && s.presentation_mode !== m ? <Loader2 className="size-3 animate-spin" /> : m === "online" ? <Monitor className="size-3" /> : <MapPin className="size-3" />}
                    {m === "online" ? "Online" : "In person"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {s.sessions ? (
                <>
                  <span className="font-semibold text-foreground">{s.sessions.session_code}</span>, {rangeLabel(s.sessions.starts_at, s.sessions.ends_at)} , {" "}
                  {s.sessions.mode === "online" ? "Online" : s.sessions.room ? `Room ${s.sessions.room}` : "Room TBA"}
                  {s.session_order ? `, #${s.session_order} in session` : ""}
                  {s.sessions.mode && s.sessions.mode !== s.presentation_mode ? (
                    <span className="ml-1 font-semibold text-warn-foreground">,  mode differs from its session</span>
                  ) : null}
                </>
              ) : (
                <span className="font-semibold text-warn-foreground">Not placed in a session</span>
              )}
            </p>
            {s.data_flag ? (
              <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-warn/20 px-2.5 py-1.5 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {s.data_flag}
              </p>
            ) : null}
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="min-w-0 text-xs leading-relaxed">
                {rowsFor(s).rows.length ? rowsFor(s).rows.map((r, i) => (
                  <span key={i}>
                    {i ? ", " : ""}
                    <span className={cn(r.presenting && "font-semibold text-primary", !r.person_id && r.presenting && "underline decoration-warn decoration-dotted")}>{r.name}{r.presenting ? "*" : ""}</span>
                  </span>
                )) : <span className="text-muted-foreground">No authors listed</span>}
                {rowsFor(s).extra.length ? <span className="text-muted-foreground"> · +{rowsFor(s).extra.length} linked</span> : null}
                {!hasPresenter(s) ? <span className="ml-1 font-semibold text-warn-foreground">· no presenter</span> : null}
              </p>
              <button onClick={() => setEditing(s)} className="tap inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary">
                <Pencil className="size-3" /> Edit
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-lg">
          {editing && <PaperEditor key={editing.id} paper={editing} people={people.data ?? []} onDone={() => { setEditing(null); refresh(); }} />}
        </SheetContent>
      </Sheet>
      <Sheet open={!!openPerson} onOpenChange={(o) => !o && setOpenPerson(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {openPerson && <PersonEditor key={openPerson.id} person={openPerson} all={people.data ?? []} onDone={() => { setOpenPerson(null); refresh(); }} />}
        </SheetContent>
      </Sheet>
      {rows.length > 150 ? <p className="mt-3 text-xs text-muted-foreground">Showing 150 of {rows.length}. Narrow with search.</p> : null}
    </>
  );
}
