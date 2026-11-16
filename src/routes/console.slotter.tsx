import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, LockOpen, Sparkles, Undo2, Eye, Check, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConsoleAccess } from "@/components/console/access";
import { canEditRegistry } from "@/lib/console-access";
import { istDay } from "@/lib/schedule-clash";
import { minutesOfDay, labelForMinutes } from "@/lib/schedule";
import {
  applyMoves, canMove, diffPlacement, findIssues, fitScore, loadOf, papersBySession, suggest, targetOf,
  type IssueKind, type Move, type Placement, type SPaper, type SSession,
} from "@/lib/slotter";
import { PageHead } from "./console";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/console/slotter")({
  head: () => ({ meta: [{ title: "Smart Slotter, Console" }, { name: "robots", content: "noindex" }] }),
  component: Slotter,
});

const DAYS = [{ key: "2026-11-27", label: "Fri 27" }, { key: "2026-11-28", label: "Sat 28" }, { key: "2026-11-29", label: "Sun 29" }];
const DRAFT_KEY = "slotter.draft.v1";
const KIND: Record<IssueKind, string> = { over: "Over target", under: "Has room", mode: "Wrong mode", clash: "Presenter clash", misfit: "Theme misfit", unplaced: "Unplaced" };
const LOAD_TONE = { empty: "bg-muted text-muted-foreground", under: "bg-accent/40 text-foreground", ok: "bg-primary/15 text-primary", over: "bg-destructive/15 text-destructive" };

const slotterQuery = {
  queryKey: ["console", "slotter"],
  queryFn: async () => {
    const [s, p] = await Promise.all([
      supabase.from("sessions").select("id,session_code,title,area,mode,slot_code,starts_at,paper_target,is_locked,session_type,room,venues(short_name,name)").order("starts_at"),
      supabase.from("submissions").select("id,submission_code,title,track,presentation_mode,presenter_name,session_id,session_order").eq("is_placeholder", false).range(0, 4999),
    ]);
    if (s.error) throw s.error;
    if (p.error) throw p.error;
    const sessions: SSession[] = (s.data ?? []).filter((x) => x.session_type === "paper" || x.slot_code).map((x) => ({
      id: x.id, code: x.session_code, title: x.title, area: x.area, mode: x.mode, slot: x.slot_code ?? x.starts_at,
      day: istDay(x.starts_at), starts_at: x.starts_at, target: x.paper_target, locked: x.is_locked,
    }));
    const rooms = new Map<string, string>((s.data ?? []).map((x) => {
      const v = x.venues as { short_name: string | null; name: string } | null;
      return [x.id, v?.short_name ?? v?.name ?? x.room ?? ""];
    }));
    const papers: SPaper[] = (p.data ?? []).map((x) => ({
      id: x.id, code: x.submission_code, title: x.title, track: x.track, mode: x.presentation_mode,
      presenters: (x.presenter_name ?? "").split(/,|;| and /).map((n) => n.trim()).filter(Boolean),
    }));
    const base: Placement = Object.fromEntries((p.data ?? []).map((x) => [x.id, { session_id: x.session_id, order: x.session_order }]));
    return { sessions, papers, base, rooms };
  },
};

function Slotter() {
  const { roles } = useConsoleAccess();
  const canEdit = canEditRegistry(roles);
  const qc = useQueryClient();
  const q = useQuery(slotterQuery);
  const [day, setDay] = useState(DAYS[0]!.key);
  const [mode, setMode] = useState<"all" | "offline" | "online">("all");
  const [view, setView] = useState<"board" | "sheet">("board");
  const [find, setFind] = useState("");
  const [draft, setDraft] = useState<Placement | null>(null);
  const [history, setHistory] = useState<Placement[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [preview, setPreview] = useState<Move[] | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<IssueKind | null>(null);
  const [area, setArea] = useState("");
  const [hide, setHide] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<string | null>(null);

  const data = q.data;
  // Restore a saved sandbox once data arrives.
  useEffect(() => {
    if (!data || draft) return;
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Placement | null;
      setDraft(saved ? { ...data.base, ...saved } : data.base);
    } catch { setDraft(data.base); }
  }, [data, draft]);

  const place = draft ?? data?.base ?? {};
  const changes = useMemo(() => (data && draft ? diffPlacement(data.base, draft) : []), [data, draft]);
  useEffect(() => {
    if (!data || !draft) return;
    const delta = Object.fromEntries(changes.map((c) => [c.id, { session_id: c.session_id, order: c.order }]));
    if (changes.length) localStorage.setItem(DRAFT_KEY, JSON.stringify(delta)); else localStorage.removeItem(DRAFT_KEY);
  }, [changes, data, draft]);

  const sessions = data?.sessions ?? [];
  const papers = data?.papers ?? [];
  const by = useMemo(() => papersBySession(papers, place), [papers, place]);
  const issues = useMemo(() => findIssues(sessions, papers, place), [sessions, papers, place]);
  const tips = useMemo(() => suggest(sessions, papers, place, issues), [sessions, papers, place, issues]);
  const pById = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);
  const sById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const changedIds = new Set(changes.map((c) => c.id));
  const flagged = new Map<string, IssueKind>();
  for (const i of issues) if (i.paper_id && i.kind !== "unplaced") flagged.set(i.paper_id, i.kind);

  const areas = useMemo(() => [...new Set(sessions.map((s) => s.area).filter(Boolean) as string[])].sort(), [sessions]);
  const kindPapers = new Set<string>(), kindSessions = new Set<string>();
  if (kind) for (const i of issues) if (i.kind === kind) { if (i.paper_id) kindPapers.add(i.paper_id); if (i.session_id) kindSessions.add(i.session_id); }
  const needle = find.trim().toLowerCase();
  const textHit = (p: SPaper) => !needle || p.code.toLowerCase().includes(needle) || (p.title ?? "").toLowerCase().includes(needle) || (p.track ?? "").toLowerCase().includes(needle) || p.presenters.some((n) => n.toLowerCase().includes(needle));
  const sessHit = (s: SSession) => !!needle && [s.code, s.title, s.area, data?.rooms.get(s.id)].some((t) => (t ?? "").toLowerCase().includes(needle));
  const hit = (p: SPaper, s?: SSession | null) => {
    if (kind && (kind === "over" || kind === "under" ? !(s && kindSessions.has(s.id)) : !kindPapers.has(p.id))) return false;
    return textHit(p) || (!!s && sessHit(s));
  };
  const filtering = !!(needle || kind);
  const visible = sessions.filter((s) => s.day === day && (mode === "all" || (mode === "online") === (s.mode === "online")) && (!area || s.area === area)
    && (!hide || !filtering || kindSessions.has(s.id) || sessHit(s) || (by.get(s.id) ?? []).some((p) => hit(p, s))));
  const slots = useMemo(() => {
    const m = new Map<string, SSession[]>();
    for (const s of visible) m.set(s.slot, [...(m.get(s.slot) ?? []), s]);
    return [...m.entries()].sort((a, b) => a[1][0]!.starts_at.localeCompare(b[1][0]!.starts_at));
  }, [visible]);
  const counts = { over: 0, under: 0, mode: 0, clash: 0, misfit: 0, unplaced: 0 } as Record<IssueKind, number>;
  for (const i of issues) counts[i.kind]++;
  const previewIds = new Set(preview?.map((m) => m.paper_id) ?? []);
  const previewTo = new Set(preview?.map((m) => m.to ?? "") ?? []);

  function move(moves: Move[]) {
    if (!canEdit || !draft) return;
    const ok = moves.filter((m) => canMove(place, m.paper_id, m.to, sessions));
    if (ok.length < moves.length) toast.error("That session is locked");
    if (!ok.length) return;
    setHistory((h) => [...h.slice(-29), draft]);
    setDraft(applyMoves(draft, ok, papers));
    setPicked(null); setPreview(null);
  }
  function reorder(paperId: string, sessionId: string, beforeId: string) {
    if (!draft || !canMove(place, paperId, sessionId, sessions)) return;
    const list = (by.get(sessionId) ?? []).filter((p) => p.id !== paperId);
    const at = list.findIndex((p) => p.id === beforeId);
    list.splice(at < 0 ? list.length : at, 0, pById.get(paperId)!);
    setHistory((h) => [...h.slice(-29), draft]);
    const next = { ...draft };
    list.forEach((p, i) => { next[p.id] = { session_id: sessionId, order: i + 1 }; });
    setDraft(next);
  }
  async function saveSession(id: string, patch: { paper_target?: number; is_locked?: boolean }) {
    qc.setQueryData(slotterQuery.queryKey, (old: typeof data) => old && { ...old, sessions: old.sessions.map((s) => s.id === id ? { ...s, target: patch.paper_target ?? s.target, locked: patch.is_locked ?? s.locked } : s) });
    const { error } = await supabase.from("sessions").update(patch).eq("id", id);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: slotterQuery.queryKey }); }
  }
  async function publish() {
    setBusy(true);
    const { error } = await supabase.rpc("apply_slotter_moves", { _moves: changes });
    setBusy(false); setConfirm(false);
    if (error) { toast.error(error.message); return; }
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null); setHistory([]);
    await qc.invalidateQueries(); // calendar, papers, My Plan, schedule board all re-read
    toast.success(`${changes.length} paper ${changes.length === 1 ? "change" : "changes"} published`);
  }

  if (q.isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Loading the programme…</div>;
  if (q.error) return <div className="p-6 text-sm text-destructive">{(q.error as Error).message}</div>;

  const dragProps = (p: SPaper) => ({
    draggable: canEdit,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/paper", p.id); e.dataTransfer.effectAllowed = "move";
      const ghost = document.createElement("div");
      ghost.className = "slot-ghost"; ghost.textContent = `#${p.code}  ${(p.title ?? "").slice(0, 48)}`;
      document.body.appendChild(ghost); e.dataTransfer.setDragImage(ghost, 16, 16); setTimeout(() => ghost.remove(), 0);
      setTimeout(() => setDragging(p.id), 0);
    },
    onDragEnd: () => { setDragging(null); setOver(null); setInsertAt(null); },
  });
  const dropProps = (sid: string | null) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(sid ?? "tray"); },
    onDragLeave: () => setOver((o) => (o === (sid ?? "tray") ? null : o)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(null); setInsertAt(null); setDragging(null); const id = e.dataTransfer.getData("text/paper"); if (id) move([{ paper_id: id, to: sid }]); },
    onClick: () => { if (picked) move([{ paper_id: picked, to: sid }]); },
  });

  const chip = (p: SPaper, s: SSession | null, list: SPaper[]) => {
    const f = s ? fitScore(p, s, list) : null;
    const flag = flagged.get(p.id);
    return (
      <li key={p.id} {...dragProps(p)}
        onDragOver={(e) => { if (s) { e.preventDefault(); e.stopPropagation(); setOver(s.id); setInsertAt(p.id); } }}
        onDrop={(e) => { if (!s) return; e.preventDefault(); e.stopPropagation(); setOver(null); setInsertAt(null); setDragging(null); const id = e.dataTransfer.getData("text/paper"); if (id && id !== p.id) reorder(id, s.id, p.id); }}
        onClick={(e) => { e.stopPropagation(); if (picked && picked !== p.id && s) { move([{ paper_id: picked, to: s.id }]); return; } setPicked(picked === p.id ? null : p.id); }}
        className={cn("slot-chip group relative flex cursor-grab items-start gap-2 rounded-md border bg-background px-2 py-1.5 text-xs transition-all active:cursor-grabbing hover:-translate-y-px hover:shadow-sm",
          picked === p.id ? "border-primary ring-2 ring-primary" : "border-border",
          previewIds.has(p.id) && "ring-2 ring-accent", changedIds.has(p.id) && "border-l-4 border-l-primary",
          insertAt === p.id && dragging !== p.id && "slot-insert", dragging === p.id && "opacity-40 scale-95",
          !hit(p, s) && "opacity-25 saturate-0")}>
        <span className="shrink-0 font-semibold tabular-nums">#{p.code}</span>
        <span className="line-clamp-2 flex-1 text-muted-foreground">{p.title ?? "Untitled"}</span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {p.mode === "online" && <span className="rounded-sm bg-secondary px-1 text-[10px]">Online</span>}
          {flag && <span className="rounded-sm bg-destructive/15 px-1 text-[10px] text-destructive">{KIND[flag]}</span>}
          {f !== null && list.length > 1 && <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(Math.min(1, f) * 100)}%</span>}
        </span>
      </li>
    );
  };

  const tray = by.get(null) ?? [];
  return (
    <div className="pb-24">
      <PageHead title="Smart Slotter">
        <div className="flex flex-wrap items-center gap-2">
          <Seg value={day} onChange={setDay} options={DAYS.map((d) => ({ v: d.key, l: d.label }))} />
          <Seg value={mode} onChange={(v) => setMode(v as typeof mode)} options={[{ v: "all", l: "All" }, { v: "offline", l: "On campus" }, { v: "online", l: "Online" }]} />
          <Seg value={view} onChange={(v) => setView(v as typeof view)} options={[{ v: "board", l: "Board" }, { v: "sheet", l: "Sheet" }]} />
        </div>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {(Object.keys(counts) as IssueKind[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} disabled={!counts[k]} onClick={() => setKind(kind === k ? null : k)}
            className={cn("rounded-md border px-2 py-1 tabular-nums transition-all active:scale-95 disabled:opacity-40",
              kind === k ? "border-primary bg-primary text-primary-foreground" : counts[k] && k !== "under" ? "border-destructive/30 bg-destructive/10 hover:bg-destructive/20" : "border-border bg-card hover:bg-muted")}>
            {KIND[k]} <b>{counts[k]}</b>
          </button>
        ))}
        {kind && <button onClick={() => setKind(null)} className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Clear</button>}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex flex-1 items-center gap-1 rounded-md border border-border bg-card px-2 sm:max-w-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Paper ID, title, author, track, session or room" className="w-full bg-transparent py-1.5 outline-none" />
          {find && <button onClick={() => setFind("")} aria-label="Clear search"><X className="h-3 w-3" /></button>}
        </label>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5">
          <option value="">All areas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Seg value={hide ? "hide" : "dim"} onChange={(v) => setHide(v === "hide")} options={[{ v: "dim", l: "Dim others" }, { v: "hide", l: "Hide others" }]} />
        {filtering && <span className="tabular-nums text-muted-foreground">{visible.length} sessions shown</span>}
      </div>
      {picked && <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-xs">#{pById.get(picked)?.code} picked. Tap a session to place it, or tap it again to drop.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          {view === "board" ? slots.map(([slot, list]) => (
            <section key={slot}>
              <h2 className="mb-2 text-sm font-semibold tabular-nums">{slot.length < 8 ? slot : "Slot"} <span className="font-normal text-muted-foreground">{labelForMinutes(minutesOfDay(list[0]!.starts_at))}</span></h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {list.map((s) => {
                  const ps = by.get(s.id) ?? [];
                  const load = loadOf(ps.length, targetOf(s));
                  return (
                    <div key={s.id} {...dropProps(s.id)}
                      className={cn("w-72 shrink-0 rounded-lg border bg-card p-2 transition-all duration-150", over === s.id ? "border-primary bg-primary/5 shadow-md -translate-y-0.5" : "border-border",
                        dragging && !s.locked && over !== s.id && "border-dashed", dragging && s.locked && "opacity-40",
                        s.locked && "opacity-70", previewTo.has(s.id) && "ring-2 ring-accent")}>
                      <header className="mb-2 flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{s.code ?? s.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.area ?? s.title} · {s.mode === "online" ? "Online" : data.rooms.get(s.id) || "Room awaited"}</p>
                          <Gauge n={ps.length} t={targetOf(s)} />
                        </div>
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums", LOAD_TONE[load])}>
                          {ps.length}/
                          <input type="number" min={1} max={12} disabled={!canEdit} defaultValue={targetOf(s)} key={targetOf(s)} onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== targetOf(s)) saveSession(s.id, { paper_target: v }); }}
                            className="w-6 bg-transparent text-center outline-none" aria-label="Paper target" />
                        </span>
                        <button disabled={!canEdit} onClick={(e) => { e.stopPropagation(); saveSession(s.id, { is_locked: !s.locked }); }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={s.locked ? "Unlock session" : "Lock session"} title={s.locked ? "Locked: not open for reschedule" : "Lock this session"}>
                          {s.locked ? <Lock className="h-3.5 w-3.5 text-foreground" /> : <LockOpen className="h-3.5 w-3.5" />}
                        </button>
                      </header>
                      <ol className="space-y-1">{ps.map((p) => chip(p, s, ps))}</ol>
                      {over === s.id && !insertAt && dragging && <div className="slot-insert-bar mt-1" />}
                      {ps.length < targetOf(s) && <p className="mt-1 rounded-md border border-dashed border-border py-2 text-center text-[11px] text-muted-foreground">{targetOf(s) - ps.length} open</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          )) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[48rem] text-sm tabular-nums">
                <thead className="bg-muted text-left text-xs text-muted-foreground"><tr>{["Paper", "Title", "Mode", "Room", "Session", "Order", "Fit", "Flag"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {visible.flatMap((s) => (by.get(s.id) ?? []).filter((p) => hit(p, s)).map((p) => (
                    <tr key={p.id} className={cn("border-t border-border", changedIds.has(p.id) && "bg-primary/5")}>
                      <td className="px-2 py-1 font-semibold">#{p.code}</td>
                      <td className="max-w-xs truncate px-2 py-1">{p.title}</td>
                      <td className="px-2 py-1">{p.mode === "online" ? "Online" : "On campus"}</td>
                      <td className="px-2 py-1 text-xs text-muted-foreground">{data.rooms.get(s.id) || ""}</td>
                      <td className="px-2 py-1">
                        <select disabled={!canEdit || s.locked} value={s.id} onChange={(e) => move([{ paper_id: p.id, to: e.target.value || null }])} className="bg-transparent">
                          <option value="">Unplaced</option>
                          {sessions.map((o) => <option key={o.id} value={o.id} disabled={o.locked}>{o.day.slice(8)} · {o.code ?? o.title}{o.locked ? " (locked)" : ""}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">{place[p.id]?.order ?? ""}</td>
                      <td className="px-2 py-1">{Math.round(Math.min(1, fitScore(p, s, by.get(s.id) ?? [])) * 100)}%</td>
                      <td className="px-2 py-1 text-destructive">{flagged.get(p.id) ? KIND[flagged.get(p.id)!] : ""}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section {...dropProps(null)} className={cn("rounded-lg border bg-card p-3 transition-all", over === "tray" ? "border-primary bg-primary/5" : dragging ? "border-dashed border-primary/60" : "border-border")}>
            <h3 className="mb-2 text-sm font-semibold">Unplaced <span className="tabular-nums text-muted-foreground">{tray.length}</span></h3>
            <ol className="max-h-56 space-y-1 overflow-y-auto">{tray.filter((p) => !hide || hit(p, null)).map((p) => chip(p, null, []))}</ol>
            {!tray.length && <p className="text-xs text-muted-foreground">Drag a paper here to take it out of the programme.</p>}
          </section>
          <section className="rounded-lg border border-border bg-card p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Suggestions <span className="tabular-nums text-muted-foreground">{tips.length}</span></h3>
            <p className="mb-2 text-[11px] text-muted-foreground">Fit reads titles for now; abstracts will sharpen it. Locked sessions are left out.</p>
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
              {tips.filter((t) => !kind || t.issue.kind === kind).slice(0, 40).map((t) => {
                const m = t.moves[0]!;
                return (
                  <li key={t.id} className="rounded-md border border-border p-2 text-xs">
                    <p className="mb-1 font-semibold">{KIND[t.issue.kind]}</p>
                    <p className="mb-2 text-muted-foreground">{t.why}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <button onClick={() => { setPreview(preview === t.moves ? null : t.moves); const s = sById.get(m.to ?? ""); if (s) { setDay(s.day); } }} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted"><Eye className="h-3 w-3" />Show</button>
                      {canEdit && <button onClick={() => move(t.moves)} className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-primary-foreground"><Check className="h-3 w-3" />Accept</button>}
                      {canEdit && (
                        <select value="" onChange={(e) => e.target.value && move([{ paper_id: m.paper_id, to: e.target.value }])} className="rounded border border-border bg-transparent px-1 py-1">
                          <option value="">Somewhere else…</option>
                          {sessions.filter((s) => !s.locked && s.id !== place[m.paper_id]?.session_id).map((s) => <option key={s.id} value={s.id}>{s.day.slice(8)} · {s.code ?? s.title} ({by.get(s.id)?.length ?? 0}/{targetOf(s)})</option>)}
                        </select>
                      )}
                    </div>
                  </li>
                );
              })}
              {!tips.length && <li className="text-xs text-muted-foreground">Nothing to fix right now.</li>}
            </ul>
          </section>
        </aside>
      </div>

      {canEdit && changes.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Draft</span>
            <span className="tabular-nums text-muted-foreground">{changes.length} unpublished {changes.length === 1 ? "change" : "changes"}. Guests still see the old programme.</span>
            <div className="ml-auto flex gap-2">
              <button disabled={!history.length} onClick={() => { setDraft(history[history.length - 1]!); setHistory((h) => h.slice(0, -1)); }} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 disabled:opacity-40"><Undo2 className="h-4 w-4" />Undo</button>
              <button onClick={() => { setDraft(data.base); setHistory([]); }} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5"><X className="h-4 w-4" />Discard</button>
              <button onClick={() => setConfirm(true)} className="rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Publish</button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish {changes.length} {changes.length === 1 ? "change" : "changes"}?</AlertDialogTitle>
            <AlertDialogDescription>Calendar, papers and My Plan update for everyone at once.</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-xs tabular-nums">
            {changes.map((c) => {
              const from = sById.get(data.base[c.id]?.session_id ?? ""), to = sById.get(c.session_id ?? "");
              return <li key={c.id}>#{pById.get(c.id)?.code}: {from?.code ?? "Unplaced"} → {to?.code ?? "Unplaced"}{c.order ? ` (#${c.order})` : ""}</li>;
            })}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); publish(); }}>{busy ? "Publishing…" : "Publish"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cn("rounded px-2.5 py-1 transition-colors", value === o.v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{o.l}</button>
      ))}
    </div>
  );
}

/** Segmented capacity: one notch per target seat, overflow notches in red. */
function Gauge({ n, t }: { n: number; t: number }) {
  const total = Math.max(n, t);
  return (
    <span className="mt-1 flex gap-0.5" aria-label={`${n} of ${t} papers`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-[1px] transition-colors", i >= t ? "bg-destructive" : i < n ? (n === t ? "bg-primary" : "bg-primary/60") : "bg-muted")} />
      ))}
    </span>
  );
}
