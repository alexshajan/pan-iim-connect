import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Undo2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASH_LABEL, findScheduleClashes, groupClashes, istDay, istIso, snap } from "@/lib/schedule-clash";
import { minutesOfDay, labelForMinutes } from "@/lib/schedule";
import { canEditRegistry } from "@/lib/console-access";
import { PageHead, useConsoleAccess } from "./console";
import { cn } from "@/lib/utils";
import { ScheduleSheet } from "@/components/console/ScheduleSheet";

export const Route = createFileRoute("/console/schedule/")({ component: ScheduleBoard });

const DAYS = [
  { key: "2026-11-27", label: "Fri 27 Nov" },
  { key: "2026-11-28", label: "Sat 28 Nov" },
  { key: "2026-11-29", label: "Sun 29 Nov" },
];
const START = 8 * 60, END = 22 * 60, PX = 1.4; // px per minute; Day 1 runs 8 AM–10 PM
const STATUSES = [
  { v: "scheduled", l: "On time" }, { v: "delayed", l: "Delayed" }, { v: "moved", l: "Moved" }, { v: "cancelled", l: "Cancelled" },
];
const TRACK_TONES = ["bg-primary/15 border-primary/50", "bg-accent/40 border-accent", "bg-secondary border-secondary-foreground/30", "bg-muted border-foreground/30"];

type Paper = { id: string; submission_code: string; title: string | null; presenter_name: string | null; presentation_mode: string; session_id: string | null; session_order: number | null };
type Row = {
  id: string; title: string; summary: string | null; session_type: string; track_id: string | null; venue_id: string | null; room: string | null;
  session_code: string | null; mode: string | null; in_everyone_plan: boolean;
  starts_at: string; ends_at: string; chair: string | null; status: string; status_note: string | null; papers: Paper[];
  slot_code: string | null; moved_at: string | null;
};
/** Column key for a session: a venue, or a free-text room when no venue is linked. */
const roomKey = (s: { venue_id: string | null; room: string | null }) => s.venue_id ?? (s.room ? `room:${s.room}` : "none");
type Col = { id: string; name: string };

const boardQuery = {
  queryKey: ["console", "schedule-board"],
  queryFn: async () => {
    const [s, v, t, p] = await Promise.all([
      supabase.from("sessions").select("id,title,summary,session_type,track_id,venue_id,room,session_code,mode,in_everyone_plan,starts_at,ends_at,chair,status,status_note,slot_code,moved_at").order("starts_at"),
      supabase.from("venues").select("id,name,short_name,kind,sort_order").order("sort_order"),
      supabase.from("tracks").select("id,name,sort_order").order("sort_order"),
      supabase.from("submissions").select("id,submission_code,title,presenter_name,presentation_mode,session_id,session_order").eq("is_placeholder", false).range(0, 4999),
    ]);
    if (s.error) throw s.error;
    if (p.error) throw p.error;
    const papers = (p.data ?? []) as Paper[];
    const bySession = new Map<string, Paper[]>();
    for (const x of papers) if (x.session_id) bySession.set(x.session_id, [...(bySession.get(x.session_id) ?? []), x]);
    const sessions = (s.data ?? []).map((r) => ({ ...r, papers: (bySession.get(r.id) ?? []).sort((a, b) => (a.session_order ?? 99) - (b.session_order ?? 99)) })) as Row[];
    return { sessions, venues: v.data ?? [], tracks: t.data ?? [], papers };
  },
};

type Snapshot = Pick<Row, "id" | "starts_at" | "ends_at" | "venue_id" | "track_id" | "room">;

function ScheduleBoard() {
  const { roles } = useConsoleAccess();
  const canEdit = canEditRegistry(roles);
  const qc = useQueryClient();
  const q = useQuery(boardQuery);
  const [day, setDay] = useState(DAYS[0]!.key);
  const [by, setBy] = useState<"venue" | "track">("venue");
  const [view, setView] = useState<"board" | "sheet">("board");
  const [openId, setOpenId] = useState<string | null>(null);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [drag, setDrag] = useState<{ id: string; dy: number; col: string | null; resize: boolean } | null>(null);
  const [pending, setPending] = useState<{ id: string; dy: number; col: string | null; resize: boolean; dMin: number } | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const data = q.data;
  const cols: Col[] = useMemo(() => {
    if (!data) return [];
    if (by === "track") return [...data.tracks.map((t) => ({ id: t.id, name: t.name })), { id: "none", name: "No track" }];
    const daySet = data.sessions.filter((s) => istDay(s.starts_at) === day);
    const venueCols = data.venues.filter((v) => daySet.some((s) => s.venue_id === v.id)).map((v) => ({ id: v.id, name: v.short_name || v.name }));
    const rooms = [...new Set(daySet.filter((s) => !s.venue_id && s.room).map((s) => s.room!))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const extra = daySet.some((s) => !s.venue_id && !s.room) ? [{ id: "none", name: "No room" }] : [];
    return [...venueCols, ...rooms.map((r) => ({ id: `room:${r}`, name: r.startsWith("Room") ? r : `Room ${r}` })), ...extra];
  }, [data, by, day]);
  const trackIdx = useMemo(() => new Map((data?.tracks ?? []).map((t, i) => [t.id, i])), [data]);

  const daySessions = (data?.sessions ?? []).filter((s) => istDay(s.starts_at) === day);
  const clashes = useMemo(
    () => findScheduleClashes(daySessions.map((s) => ({ ...s, people: s.papers.map((p) => p.presenter_name ?? "").filter(Boolean) }))),
    [daySessions],
  );
  const clashIds = new Set(clashes.filter((c) => CLASH_LABEL[c.kind].severe).flatMap((c) => [c.a, c.b ?? c.a]));
  const warnIds = new Set(clashes.filter((c) => !CLASH_LABEL[c.kind].severe).map((c) => c.a));
  const groups = groupClashes(clashes);
  const movedIds = daySessions.filter((s) => s.moved_at).map((s) => s.id);
  const short = (id: string) => { const x = byIdAll.get(id); return x?.session_code ?? x?.title ?? "Session"; };
  const byIdAll = new Map(daySessions.map((s) => [s.id, s]));
  const colOf = (s: Row) => (by === "venue" ? roomKey(s) : s.track_id ?? "none");

  async function save(id: string, patch: Partial<Row>, prev: Snapshot, notify?: string) {
    qc.setQueryData(boardQuery.queryKey, (old: typeof data) => old && { ...old, sessions: old.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    const { papers: _p, ...clean } = patch as Row;
    const { error } = await supabase.from("sessions").update(clean).eq("id", id);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: boardQuery.queryKey }); return; }
    setUndo((u) => [...u.slice(-19), prev]);
    qc.invalidateQueries({ queryKey: ["sessions"] });
    if (notify) {
      toast.success("Saved", {
        action: { label: "Send alert", onClick: () => sendMoveAlert(id, notify) },
        duration: 8000,
      });
    }
  }

  async function sendMoveAlert(id: string, text: string) {
    const s = data?.sessions.find((x) => x.id === id);
    const { error } = await supabase.from("announcements").insert({ title: `${s?.title ?? "Session"} changed`, body: text, kind: "schedule", audience: "all", session_id: id, urgent: false });
    if (error) toast.error(error.message); else toast.success("Alert sent");
  }

  async function doUndo() {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo((u) => u.slice(0, -1));
    const { id, ...rest } = last;
    qc.setQueryData(boardQuery.queryKey, (old: typeof data) => old && { ...old, sessions: old.sessions.map((s) => (s.id === id ? { ...s, ...rest } : s)) });
    const { error } = await supabase.from("sessions").update(rest).eq("id", id);
    if (error) toast.error(error.message); else toast("Change undone");
  }

  // Press and hold to lift a card; a quick tap opens it, a quick swipe scrolls.
  // Dropping never saves straight away: the card waits for Place or Put back.
  function onPointerDown(e: React.PointerEvent, s: Row, resize: boolean) {
    if (!canEdit || pending) { if (!pending) setOpenId(s.id); return; }
    e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY;
    let lifted = false, cancelled = false;
    let state = { id: s.id, dy: 0, col: colOf(s), resize };
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      lifted = true;
      setDrag(state);
      navigator.vibrate?.(12);
    }, resize ? 150 : 320);
    const move = (ev: PointerEvent) => {
      if (!lifted) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { cancelled = true; window.clearTimeout(timer); cleanup(); }
        return;
      }
      ev.preventDefault();
      const dy = ev.clientY - y0;
      let col = state.col;
      if (!resize) {
        const el = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => (n as HTMLElement).dataset?.["col"]) as HTMLElement | undefined;
        const dc = el?.dataset["col"]; if (dc) col = dc;
      }
      state = { ...state, dy, col };
      setDrag(state);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const cancel = () => { window.clearTimeout(timer); cleanup(); setDrag(null); };
    const up = () => {
      window.clearTimeout(timer);
      cleanup();
      if (!lifted) { if (!cancelled) setOpenId(s.id); return; }
      const dMin = snap(state.dy / PX);
      if (dMin === 0 && state.col === colOf(s)) { setDrag(null); return; }
      setPending({ ...state, dMin });
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  function commitPending() {
    const p = pending;
    if (!p) return;
    setPending(null);
    setDrag(null);
    const s = daySessions.find((x) => x.id === p.id);
    if (!s) return;
    const st0 = minutesOfDay(s.starts_at);
    {
      const state = p, resize = p.resize, dMin = p.dMin;
      void st0;
      const st = minutesOfDay(s.starts_at), en = minutesOfDay(s.ends_at);
      const prev: Snapshot = { id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, venue_id: s.venue_id, track_id: s.track_id, room: s.room };
      if (resize) {
        const ne = Math.max(st + 15, en + dMin);
        void save(s.id, { ends_at: istIso(day, ne) }, prev);
        return;
      }
      const ns = Math.min(Math.max(START, st + dMin), END - 15);
      const patch: Partial<Row> = { starts_at: istIso(day, ns), ends_at: istIso(day, ns + (en - st)) };
      const colChanged = state.col !== colOf(s);
      if (colChanged) {
        if (by === "venue") {
          if (state.col?.startsWith("room:")) { patch.venue_id = null; patch.room = state.col.slice(5); }
          else if (state.col === "none") { patch.venue_id = null; patch.room = null; }
          else patch.venue_id = state.col;
        }
        else patch.track_id = state.col === "none" ? null : state.col;
      }
      const venueName = cols.find((c) => c.id === state.col)?.name;
      const note = colChanged && by === "venue" ? `Now in ${venueName}, ${labelForMinutes(ns)}.` : `Now starts at ${labelForMinutes(ns)}.`;
      save(s.id, patch, prev, note);
    }
  }

  function putBack() { setPending(null); setDrag(null); }

  async function clearMoved(ids: string[]) {
    for (const id of ids) {
      const s = data?.sessions.find((x) => x.id === id);
      if (!s) continue;
      await supabase.from("sessions").update({ moved_at: null, base_starts_at: s.starts_at, base_venue_id: s.venue_id, base_room: s.room }).eq("id", id);
    }
    toast.success(ids.length > 1 ? `Moved tag cleared on ${ids.length} sessions` : "Moved tag cleared");
    qc.invalidateQueries({ queryKey: boardQuery.queryKey });
    qc.invalidateQueries({ queryKey: ["sessions"] });
  }

  async function fixGroup(kind: string, items: { a: string; expected?: { starts_at: string; ends_at: string } }[]) {
    for (const c of items) {
      const s = data?.sessions.find((x) => x.id === c.a);
      if (!s) continue;
      const prev: Snapshot = { id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, venue_id: s.venue_id, track_id: s.track_id, room: s.room };
      if (kind === "off-slot" && c.expected) await save(s.id, { starts_at: c.expected.starts_at, ends_at: c.expected.ends_at }, prev);
      if (kind === "online-room") await save(s.id, { venue_id: null, room: null }, prev);
    }
    toast.success("Fixed");
  }

  async function addSession(colId: string, mins: number) {
    if (!canEdit) return;
    const start = snap(mins, 15);
    const row = {
      title: "New session", starts_at: istIso(day, start), ends_at: istIso(day, start + 60),
      venue_id: by === "venue" && !colId.startsWith("room:") && colId !== "none" ? colId : null,
      room: by === "venue" && colId.startsWith("room:") ? colId.slice(5) : null, track_id: by === "track" && colId !== "none" ? colId : null,
    };
    const { data: ins, error } = await supabase.from("sessions").insert(row).select("id").single();
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: boardQuery.queryKey });
    setOpenId(ins.id);
  }

  const hours: number[] = [];
  for (let m = START; m <= END; m += 60) hours.push(m);
  const open = data?.sessions.find((s) => s.id === openId) ?? null;

  return (
    <div>
      <PageHead title="Schedule">
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <button disabled={!undo.length} onClick={doUndo} className="tap inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40">
                <Undo2 className="size-4" /> Undo
              </button>
              <Link to="/console/schedule/import" className="tap inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                <FileUp className="size-4" /> Import timetable
              </Link>
            </>
          )}
        </div>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {DAYS.map((d) => (
            <button key={d.key} onClick={() => setDay(d.key)} className={cn("tap rounded-md px-3 py-1 text-sm", day === d.key ? "bg-plate text-plate-foreground" : "text-muted-foreground")}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {(["venue", "track"] as const).map((b) => (
            <button key={b} onClick={() => setBy(b)} className={cn("tap rounded-md px-3 py-1 text-sm", by === b ? "bg-muted text-foreground" : "text-muted-foreground")}>
              By {b}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="View">
          {(["board", "sheet"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("tap rounded-md px-3 py-1 text-sm", view === v ? "bg-muted text-foreground" : "text-muted-foreground")}>
              {v === "board" ? "Board" : "Sheet"}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{daySessions.length} sessions. {canEdit ? "Press and hold a card to lift it, then drop and confirm. Tap to edit." : "View only."}</span>
      </div>

      {(groups.length > 0 || movedIds.length > 0) && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const meta = CLASH_LABEL[g.kind];
            const isOpen = openGroup === g.kind;
            const fixable = canEdit && (g.kind === "off-slot" || g.kind === "online-room");
            return (
              <div key={g.kind} className={cn("rounded-lg border bg-card px-3 py-2.5 text-sm shadow-sm", meta.severe ? "border-destructive/50" : "border-warn/60")}>
                <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpenGroup(isOpen ? null : g.kind)}>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-md text-sm font-bold tabular-nums", meta.severe ? "bg-destructive text-destructive-foreground" : "bg-warn text-warn-foreground")}>{g.items.length}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{meta.title}</span>
                    <span className="block text-xs text-muted-foreground">{meta.fix}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-2 border-t border-border pt-2">
                    <ul className="flex flex-wrap gap-1.5">
                      {g.items.map((c, i) => (
                        <li key={i}>
                          <button onClick={() => setOpenId(c.a)} className="press rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                            {short(c.a)}{c.b ? ` + ${short(c.b)}` : ""}{c.who ? `, ${c.who}` : ""}
                            {c.expected ? ` → ${labelForMinutes(minutesOfDay(c.expected.starts_at))}` : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {fixable && (
                      <button onClick={() => fixGroup(g.kind, g.items)} className="press mt-2 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                        {g.kind === "off-slot" ? "Snap all back to block time" : "Clear these rooms"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {movedIds.length > 0 && (
            <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-sm font-bold tabular-nums">{movedIds.length}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Showing a Moved tag to guests</span>
                  <span className="block text-xs text-muted-foreground">Goes away by itself if a session returns to its first time and room</span>
                </span>
                {canEdit && <button onClick={() => clearMoved(movedIds)} className="press rounded-md border border-border px-2 py-1 text-xs font-semibold">Clear all</button>}
              </div>
            </div>
          )}
        </div>
      )}

      {pending && (() => {
        const s = byIdAll.get(pending.id);
        if (!s) return null;
        const st = minutesOfDay(s.starts_at), en = minutesOfDay(s.ends_at);
        const where = pending.col !== colOf(s) ? cols.find((c) => c.id === pending.col)?.name : null;
        const what = pending.resize ? `End at ${labelForMinutes(Math.max(st + 15, en + pending.dMin))}` : `Start at ${labelForMinutes(st + pending.dMin)}${where ? `, ${where}` : ""}`;
        return (
          <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-plate px-4 py-3 text-plate-foreground shadow-2xl">
              <span className="text-sm"><b>{s.session_code ?? s.title}</b>. {what}?</span>
              <button onClick={putBack} className="press rounded-lg border border-plate-foreground/30 px-3 py-1.5 text-sm">Put back</button>
              <button onClick={commitPending} className="press rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Place</button>
            </div>
          </div>
        );
      })()}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : view === "sheet" && data ? (
        <ScheduleSheet
          sessions={daySessions}
          venues={data.venues}
          canEdit={canEdit}
          statuses={STATUSES}
          onOpen={setOpenId}
          onSave={(s, patch) => save(s.id, patch as Partial<Row>, { id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, venue_id: s.venue_id, track_id: s.track_id, room: s.room }, patch.starts_at || patch.venue_id !== undefined || patch.room !== undefined ? `${s.title} now ${patch.starts_at ? labelForMinutes(minutesOfDay(patch.starts_at)) : "in a new room"}.` : undefined)}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <div className="flex min-w-max" ref={gridRef}>
            <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-border bg-card">
              <div className="h-10 border-b border-border" />
              <div className="relative" style={{ height: (END - START) * PX }}>
                {hours.map((m) => (
                  <span key={m} className="absolute right-2 -translate-y-1/2 text-[0.65rem] text-muted-foreground" style={{ top: (m - START) * PX }}>
                    {labelForMinutes(m)}
                  </span>
                ))}
              </div>
            </div>
            {cols.map((c) => (
              <div key={c.id} className="w-48 shrink-0 border-r border-border last:border-r-0">
                <div className="sticky top-0 flex h-10 items-center border-b border-border px-3 text-sm font-medium">{c.name}</div>
                <div
                  data-col={c.id}
                  className={cn("relative", drag && drag.col === c.id && "bg-primary/5")}
                  style={{ height: (END - START) * PX }}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    addSession(c.id, START + (e.clientY - r.top) / PX);
                  }}
                >
                  {hours.map((m) => (
                    <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: (m - START) * PX }} />
                  ))}
                  {daySessions.filter((s) => colOf(s) === c.id).map((s) => {
                    const st = minutesOfDay(s.starts_at), en = minutesOfDay(s.ends_at);
                    const d = drag?.id === s.id ? drag : null;
                    const snapDy = d ? snap(d.dy / PX) * PX : 0; // card moves in 5-minute notches
                    const top = (st - START) * PX + (d && !d.resize ? snapDy : 0);
                    const h = Math.max(22, (en - st) * PX + (d?.resize ? snapDy : 0));
                    const tone = TRACK_TONES[(trackIdx.get(s.track_id ?? "") ?? 3) % TRACK_TONES.length];
                    return (
                      <div
                        key={s.id}
                        onPointerDown={(e) => onPointerDown(e, s, false)}
                        className={cn(
                          "absolute inset-x-1 cursor-pointer select-none overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm [touch-action:pan-x_pan-y] transition-[transform,box-shadow,top,height] duration-150 ease-out active:scale-[0.98]",
                          tone,
                          d && "z-20 -rotate-1 scale-[1.04] cursor-grabbing shadow-2xl ring-2 ring-primary",
                          pending?.id === s.id && "animate-pulse",
                          clashIds.has(s.id) && "ring-2 ring-destructive",
                          !clashIds.has(s.id) && warnIds.has(s.id) && "ring-2 ring-warn",
                          s.status === "cancelled" && "opacity-50 line-through",
                        )}
                        style={{ top, height: h }}
                      >
                        {d && !d.resize && (
                          <span className="absolute right-1 top-1 rounded bg-plate px-1 text-[0.6rem] font-bold text-plate-foreground tabular-nums">{labelForMinutes(st + snap(d.dy / PX))}</span>
                        )}
                        <p className="truncate font-medium text-foreground">{s.moved_at && <span className="mr-1 rounded bg-warn px-1 text-[0.6rem] font-bold text-warn-foreground">Moved</span>}{s.title}</p>
                        <p className="truncate text-muted-foreground">
                          {labelForMinutes(st)}–{labelForMinutes(en)}
                          {s.chair ? `, ${s.chair}` : ""}
                        </p>
                        {h > 50 && (
                          <p className="mt-0.5 flex flex-wrap gap-1">
                            {s.papers.length > 0 && <span className="rounded bg-background/70 px-1">{s.papers.length} papers</span>}
                            {s.status !== "scheduled" && <span className="rounded bg-background/70 px-1 font-medium">{STATUSES.find((x) => x.v === s.status)?.l ?? s.status}{s.status_note ? ` ${s.status_note}` : ""}</span>}
                          </p>
                        )}
                        {canEdit && <div onPointerDown={(e) => onPointerDown(e, s, true)} className="absolute inset-x-6 bottom-0 h-2 cursor-ns-resize rounded-t bg-foreground/10" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && data && (
        <SessionPanel
          key={open.id}
          s={open}
          venues={data.venues}
          tracks={data.tracks}
          allSessions={data.sessions}
          allPapers={data.papers}
          canEdit={canEdit}
          onClose={() => setOpenId(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: boardQuery.queryKey })}
          onAlert={(text) => sendMoveAlert(open.id, text)}
          onClearMoved={() => clearMoved([open.id])}
        />
      )}
    </div>
  );
}

function SessionPanel({
  s, venues, tracks, allSessions, allPapers, canEdit, onClose, onSaved, onAlert, onClearMoved,
}: {
  s: Row; venues: { id: string; name: string }[]; tracks: { id: string; name: string }[];
  allSessions: Row[]; allPapers: Paper[]; canEdit: boolean;
  onClose: () => void; onSaved: () => void; onAlert: (t: string) => void; onClearMoved: () => void;
}) {
  const [f, setF] = useState({
    title: s.title, chair: s.chair ?? "", venue_id: s.venue_id ?? "", room: s.room ?? "", track_id: s.track_id ?? "", status: s.status, status_note: s.status_note ?? "",
    summary: s.summary ?? "", everyone: s.in_everyone_plan, start: minutesOfDay(s.starts_at), end: minutesOfDay(s.ends_at), day: istDay(s.starts_at),
  });
  const [papers, setPapers] = useState<Paper[]>(s.papers);
  const [find, setFind] = useState("");
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const parseHm = (v: string) => { const [h, m] = v.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
  const sessionLabel = (x: Row) => `${x.session_code ? `${x.session_code}, ` : ""}${x.title} (${DAYS.find((d) => d.key === istDay(x.starts_at))?.label ?? ""} ${labelForMinutes(minutesOfDay(x.starts_at))})`;
  const targets = allSessions.filter((x) => x.id !== s.id && (x.session_type === "papers" || x.papers.length > 0 || !!x.session_code));
  const matches = find.trim().length >= 2
    ? allPapers.filter((p) => p.session_id !== s.id && `${p.submission_code} ${p.title ?? ""} ${p.presenter_name ?? ""}`.toLowerCase().includes(find.trim().toLowerCase())).slice(0, 6)
    : [];

  async function saveAll() {
    const { error } = await supabase.from("sessions").update({
      title: f.title.trim() || "Untitled", chair: f.chair || null, venue_id: f.venue_id || null, room: f.venue_id ? null : f.room.trim() || null,
      track_id: f.track_id || null, status: f.status, status_note: f.status_note || null, summary: f.summary || null, in_everyone_plan: f.everyone,
      starts_at: istIso(f.day, f.start), ends_at: istIso(f.day, Math.max(f.end, f.start + 15)),
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    for (const [i, p] of papers.entries()) {
      if (p.session_order !== i + 1) await supabase.from("submissions").update({ session_order: i + 1 }).eq("id", p.id);
    }
    toast.success("Session saved");
    onSaved();
  }
  async function placePaper(p: Paper, sessionId: string | null) {
    const order = sessionId === s.id ? papers.length + 1 : (allSessions.find((x) => x.id === sessionId)?.papers.length ?? 0) + 1;
    const { error } = await supabase.from("submissions").update({ session_id: sessionId, session_order: sessionId ? order : null }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    if (sessionId === s.id) { setPapers((x) => [...x, { ...p, session_id: s.id, session_order: order }]); setFind(""); toast.success(`Paper ${p.submission_code} added here`); }
    else {
      setPapers((x) => x.filter((y) => y.id !== p.id));
      const to = allSessions.find((x) => x.id === sessionId);
      toast.success(sessionId && to ? `Paper ${p.submission_code} moved to ${to.session_code ?? to.title}` : `Paper ${p.submission_code} is now unscheduled`);
    }
    onSaved();
  }
  async function removeSession() {
    if (!confirm("Delete this session? Its papers become unscheduled.")) return;
    await supabase.from("submissions").update({ session_id: null, session_order: null }).eq("session_id", s.id);
    const { error } = await supabase.from("sessions").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    onSaved();
    onClose();
  }
  const move = (i: number, d: number) => setPapers((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const input = "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-70";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20" />
      <aside className="relative h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{s.session_code ? `Session ${s.session_code}` : "Session"}{s.mode ? `, ${s.mode}` : ""}</p>
          <button onClick={onClose} aria-label="Close" className="tap rounded-lg p-1"><X className="size-5" /></button>
        </div>
        {s.moved_at && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-warn/60 bg-warn/15 px-3 py-2 text-sm">
            <span className="flex-1">Guests see a <b>Moved</b> tag on this session.</span>
            {canEdit && <button onClick={onClearMoved} className="press rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">Remove tag</button>}
          </div>
        )}
        <fieldset disabled={!canEdit} className="space-y-3">
          <input className={cn(input, "text-base font-medium")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-xs text-muted-foreground">Day
              <select className={input} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })}>
                {DAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Starts<input type="time" step={300} className={input} value={hm(f.start)} onChange={(e) => setF({ ...f, start: parseHm(e.target.value) })} /></label>
            <label className="text-xs text-muted-foreground">Ends<input type="time" step={300} className={input} value={hm(f.end)} onChange={(e) => setF({ ...f, end: parseHm(e.target.value) })} /></label>
            <label className="text-xs text-muted-foreground">Venue
              <select className={input} value={f.venue_id} onChange={(e) => setF({ ...f, venue_id: e.target.value })}>
                <option value="">Use room number</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Room number<input className={input} disabled={!!f.venue_id || !canEdit} placeholder="e.g. 101" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></label>
            <label className="text-xs text-muted-foreground">Track
              <select className={input} value={f.track_id} onChange={(e) => setF({ ...f, track_id: e.target.value })}>
                <option value="">None</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Status
              <select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                {STATUSES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select>
            </label>
            <label className="col-span-2 text-xs text-muted-foreground">Status note<input className={input} placeholder="+15 min" value={f.status_note} onChange={(e) => setF({ ...f, status_note: e.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.everyone} onChange={(e) => setF({ ...f, everyone: e.target.checked })} /> Add to everyone&apos;s plan</label>
          <label className="block text-xs text-muted-foreground">Chair (private, not shown to guests)<input className={input} value={f.chair} onChange={(e) => setF({ ...f, chair: e.target.value })} /></label>
          <label className="block text-xs text-muted-foreground">Summary<textarea rows={2} className={input} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
        </fieldset>

        <h3 className="mt-5 text-sm font-medium">Papers in this session ({papers.length})</h3>
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {papers.map((p, i) => (
            <li key={p.id} className="px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="w-4 pt-0.5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2">{p.title ?? "Untitled"}</p>
                  <p className="truncate text-xs text-muted-foreground">#{p.submission_code}, {p.presenter_name ?? "presenter not set"}, {p.presentation_mode === "online" ? "online" : "on campus"}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-0.5 text-xs">
                    <button className="tap rounded px-1" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button className="tap rounded px-1" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  </div>
                )}
              </div>
              {canEdit && (
                <select className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground" value="" onChange={(e) => e.target.value && placePaper(p, e.target.value === "__none" ? null : e.target.value)}>
                  <option value="">Move this paper to another session…</option>
                  <option value="__none">Unschedule it</option>
                  {targets.map((x) => <option key={x.id} value={x.id}>{sessionLabel(x)}</option>)}
                </select>
              )}
            </li>
          ))}
          {!papers.length && <li className="px-3 py-2 text-sm text-muted-foreground">No papers yet</li>}
        </ul>
        {canEdit && (
          <div className="mt-2">
            <input className={input} placeholder="Add a paper: type its number, title or presenter" value={find} onChange={(e) => setFind(e.target.value)} />
            {matches.length > 0 && (
              <ul className="mt-1 divide-y divide-border rounded-lg border border-border">
                {matches.map((p) => {
                  const from = allSessions.find((x) => x.id === p.session_id);
                  return (
                    <li key={p.id}>
                      <button onClick={() => placePaper(p, s.id)} className="tap flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted">
                        <span className="line-clamp-1">#{p.submission_code} {p.title}</span>
                        <span className="text-xs text-muted-foreground">{from ? `Currently in ${from.session_code ?? from.title}, will move here` : "Unscheduled"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {canEdit && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={saveAll} className="tap rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Save</button>
            <button onClick={() => onAlert(`${f.title}: ${STATUSES.find((x) => x.v === f.status)?.l ?? f.status}${f.status_note ? ` ${f.status_note}` : ""}, ${labelForMinutes(f.start)}.`)} className="tap rounded-lg border border-border px-4 py-2 text-sm">
              Send alert about this
            </button>
            <button onClick={removeSession} className="tap ml-auto rounded-lg px-3 py-2 text-sm text-destructive">Delete</button>
          </div>
        )}
      </aside>
    </div>
  );
}
