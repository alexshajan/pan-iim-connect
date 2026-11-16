import { useState } from "react";
import { istDay, istIso } from "@/lib/schedule-clash";
import { minutesOfDay } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type SheetRow = {
  id: string;
  title: string;
  session_code: string | null;
  session_type: string;
  venue_id: string | null;
  room: string | null;
  track_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  status_note: string | null;
  in_everyone_plan: boolean;
  papers: unknown[];
};

type Patch = Partial<Pick<SheetRow, "title" | "venue_id" | "room" | "starts_at" | "ends_at" | "status" | "status_note" | "in_everyone_plan">>;

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const parseHm = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Spreadsheet view of one day: every cell edits in place and saves when you leave it. */
export function ScheduleSheet({
  sessions,
  venues,
  canEdit,
  statuses,
  onSave,
  onOpen,
}: {
  sessions: SheetRow[];
  venues: { id: string; name: string; short_name?: string | null }[];
  canEdit: boolean;
  statuses: { v: string; l: string }[];
  onSave: (s: SheetRow, patch: Patch) => void;
  onOpen: (id: string) => void;
}) {
  const rows = [...sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || (a.session_code ?? "").localeCompare(b.session_code ?? "", undefined, { numeric: true }));
  const cell = "w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-primary disabled:opacity-80";
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[60rem] border-collapse text-sm tabular-nums">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            {["Start", "End", "Code", "Title", "Venue", "Room", "Status", "Note", "Everyone", "Papers"].map((h) => (
              <th key={h} className="border-b border-r border-border px-2 py-2 font-semibold last:border-r-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <SheetLine key={s.id + s.starts_at + s.ends_at + s.status} s={s} venues={venues} canEdit={canEdit} statuses={statuses} cell={cell} onSave={onSave} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No sessions on this day.</p> : null}
    </div>
  );
}

function SheetLine({
  s, venues, canEdit, statuses, cell, onSave, onOpen,
}: {
  s: SheetRow; venues: { id: string; name: string; short_name?: string | null }[]; canEdit: boolean; statuses: { v: string; l: string }[]; cell: string;
  onSave: (s: SheetRow, patch: Patch) => void; onOpen: (id: string) => void;
}) {
  const day = istDay(s.starts_at);
  const [title, setTitle] = useState(s.title);
  const [room, setRoom] = useState(s.room ?? "");
  const [note, setNote] = useState(s.status_note ?? "");
  const td = "border-b border-r border-border p-0 align-middle last:border-r-0";
  const len = new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime();
  return (
    <tr className={cn(s.status === "cancelled" && "opacity-60")}>
      <td className={cn(td, "w-24")}>
        <input type="time" step={300} disabled={!canEdit} className={cell} defaultValue={hm(minutesOfDay(s.starts_at))}
          onBlur={(e) => {
            const start = istIso(day, parseHm(e.target.value));
            if (start !== s.starts_at) onSave(s, { starts_at: start, ends_at: new Date(new Date(start).getTime() + len).toISOString() });
          }} />
      </td>
      <td className={cn(td, "w-24")}>
        <input type="time" step={300} disabled={!canEdit} className={cell} defaultValue={hm(minutesOfDay(s.ends_at))}
          onBlur={(e) => {
            const end = istIso(day, parseHm(e.target.value));
            if (end !== s.ends_at && end > s.starts_at) onSave(s, { ends_at: end });
          }} />
      </td>
      <td className={cn(td, "w-20 px-2 text-xs text-muted-foreground")}>{s.session_code ?? ""}</td>
      <td className={td}>
        <input disabled={!canEdit} className={cn(cell, "min-w-[16rem] font-medium")} value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== s.title && onSave(s, { title: title.trim() })} />
      </td>
      <td className={cn(td, "w-40")}>
        <select disabled={!canEdit} className={cell} value={s.venue_id ?? ""} onChange={(e) => onSave(s, { venue_id: e.target.value || null, ...(e.target.value ? { room: null } : {}) })}>
          <option value="">None</option>
          {venues.map((v) => <option key={v.id} value={v.id}>{v.short_name || v.name}</option>)}
        </select>
      </td>
      <td className={cn(td, "w-20")}>
        <input disabled={!canEdit || !!s.venue_id} className={cell} value={room} onChange={(e) => setRoom(e.target.value)}
          onBlur={() => room !== (s.room ?? "") && onSave(s, { room: room.trim() || null })} />
      </td>
      <td className={cn(td, "w-28")}>
        <select disabled={!canEdit} className={cell} value={s.status} onChange={(e) => onSave(s, { status: e.target.value })}>
          {statuses.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
        </select>
      </td>
      <td className={cn(td, "w-32")}>
        <input disabled={!canEdit} className={cell} placeholder="+15 min" value={note} onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (s.status_note ?? "") && onSave(s, { status_note: note.trim() || null })} />
      </td>
      <td className={cn(td, "w-20 text-center")}>
        <input type="checkbox" aria-label="In everyone's plan" disabled={!canEdit} checked={s.in_everyone_plan} onChange={(e) => onSave(s, { in_everyone_plan: e.target.checked })} />
      </td>
      <td className={cn(td, "w-20 text-center")}>
        <button type="button" onClick={() => onOpen(s.id)} className="tap rounded-md px-2 py-1 text-xs font-semibold text-primary">
          {s.papers.length ? s.papers.length : "Edit"}
        </button>
      </td>
    </tr>
  );
}
