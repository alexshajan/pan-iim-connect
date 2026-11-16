// Pure conflict detection for the console schedule board.
//
// How the programme works (and so what counts as a conflict):
// - Plenary items (keynotes, panels, meals) sit in a venue hall, one at a time.
// - Paper sessions run in parallel blocks sharing a slot code (D1A, D2B...).
//   In-person ones need their own room; online ones need no room at all.
// - Day 1 papers deliberately run alongside the plenary at the same venue, so
//   a paper session and a plenary sharing a venue is not a clash.
export type BoardSession = {
  id: string;
  title: string;
  venue_id: string | null;
  room?: string | null;
  mode?: string | null;
  session_type?: string | null;
  slot_code?: string | null;
  starts_at: string;
  ends_at: string;
  chair: string | null;
  status: string;
  people?: string[]; // presenter names in this session
};

export type ClashKind = "room" | "hall" | "person" | "off-slot" | "online-room" | "needs-room";
export type ScheduleClash = { kind: ClashKind; a: string; b?: string; who?: string; expected?: { starts_at: string; ends_at: string } };

const t = (iso: string) => new Date(iso).getTime();
const norm = (s: string) => s.trim().toLowerCase().replace(/^(prof|dr)\.?\s+/, "");
const isOnline = (s: BoardSession) => s.mode === "online";
const isPaper = (s: BoardSession) => s.session_type === "paper" || !!s.slot_code;

export function findScheduleClashes(sessions: BoardSession[]): ScheduleClash[] {
  const live = sessions.filter((s) => s.status !== "cancelled").sort((x, y) => t(x.starts_at) - t(y.starts_at));
  const out: ScheduleClash[] = [];

  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!, b = live[j]!;
      if (t(b.starts_at) >= t(a.ends_at)) break;
      const inPerson = !isOnline(a) && !isOnline(b);
      if (inPerson && a.room && a.room === b.room && (a.venue_id ?? null) === (b.venue_id ?? null)) out.push({ kind: "room", a: a.id, b: b.id });
      else if (inPerson && !a.room && !b.room && a.venue_id && a.venue_id === b.venue_id && !isPaper(a) && !isPaper(b)) out.push({ kind: "hall", a: a.id, b: b.id });
      const pa = new Set([a.chair, ...(a.people ?? [])].filter(Boolean).map((x) => norm(x!)));
      for (const p of [b.chair, ...(b.people ?? [])]) {
        if (p && pa.has(norm(p))) { out.push({ kind: "person", a: a.id, b: b.id, who: p }); break; }
      }
    }
  }

  // Sessions of one block (same slot code and mode) should share a window.
  const groups = new Map<string, BoardSession[]>();
  for (const s of live) if (s.slot_code) groups.set(`${s.slot_code}|${s.mode ?? ""}`, [...(groups.get(`${s.slot_code}|${s.mode ?? ""}`) ?? []), s]);
  for (const g of groups.values()) {
    if (g.length < 3) continue;
    const tally = new Map<string, number>();
    for (const s of g) { const k = `${t(s.starts_at)}|${t(s.ends_at)}`; tally.set(k, (tally.get(k) ?? 0) + 1); }
    const [best, n] = [...tally.entries()].sort((x, y) => y[1] - x[1])[0]!;
    if (n * 2 <= g.length) continue; // no clear majority
    const [bs, be] = best.split("|").map(Number);
    for (const s of g) if (t(s.starts_at) !== bs || t(s.ends_at) !== be)
      out.push({ kind: "off-slot", a: s.id, expected: { starts_at: new Date(bs!).toISOString(), ends_at: new Date(be!).toISOString() } });
  }

  for (const s of live) if (isOnline(s) && (s.venue_id || s.room)) out.push({ kind: "online-room", a: s.id });

  // In-person paper sessions overlapping at one venue need distinct rooms.
  const offPapers = live.filter((s) => isPaper(s) && !isOnline(s) && !s.room && s.venue_id);
  for (const s of offPapers) {
    if (offPapers.some((o) => o.id !== s.id && o.venue_id === s.venue_id && t(o.starts_at) < t(s.ends_at) && t(s.starts_at) < t(o.ends_at)))
      out.push({ kind: "needs-room", a: s.id });
  }
  return out;
}

export const CLASH_LABEL: Record<ClashKind, { title: string; fix: string; severe: boolean }> = {
  room: { title: "Same room, same time", fix: "Move one to a free room", severe: true },
  hall: { title: "Two plenaries overlap", fix: "Shift one of them", severe: true },
  person: { title: "Someone is in two places", fix: "Swap a paper or the chair", severe: true },
  "off-slot": { title: "Out of step with its block", fix: "Snap back to the block time", severe: false },
  "online-room": { title: "Online session holds a room", fix: "Clear the room", severe: false },
  "needs-room": { title: "Parallel in-person papers without rooms", fix: "Give each a room", severe: false },
};

export type ClashGroup = { kind: ClashKind; items: ScheduleClash[] };
/** Group conflicts by kind, severe kinds first. */
export function groupClashes(list: ScheduleClash[]): ClashGroup[] {
  const order: ClashKind[] = ["room", "hall", "person", "off-slot", "needs-room", "online-room"];
  return order.map((kind) => ({ kind, items: list.filter((c) => c.kind === kind) })).filter((g) => g.items.length);
}

/** Round minutes to the nearest step (default 5). */
export const snap = (mins: number, step = 5) => Math.round(mins / step) * step;

/** ISO timestamp in India time for a conference day (YYYY-MM-DD) and minutes since midnight. */
export function istIso(day: string, mins: number) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return new Date(`${day}T${h}:${m}:00+05:30`).toISOString();
}

export const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
