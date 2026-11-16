/** One-stream Calendar: turns a day's sessions into rows a phone can scroll. Pure, tested. */
import type { Session } from "@/lib/conference";
import { groupIntoSlots, type Slot } from "@/lib/schedule";

export type StreamRow =
  | { kind: "pause"; slot: Slot; session: Session }
  | { kind: "common"; slot: Slot; session: Session }
  | { kind: "parallel"; slot: Slot; picks: Session[]; clash: boolean };

const PAUSE = new Set(["break", "meal"]);

export function buildDayStream(daySessions: Session[], mine: ReadonlySet<string>): StreamRow[] {
  return groupIntoSlots(daySessions).map((slot): StreamRow => {
    if (slot.sessions.length === 1) {
      const s = slot.sessions[0]!;
      return { kind: PAUSE.has(s.session_type) ? "pause" : "common", slot, session: s };
    }
    const picks = slot.sessions.filter((s) => mine.has(s.id) && s.status !== "cancelled");
    return { kind: "parallel", slot, picks, clash: picks.length > 1 };
  });
}

/** Rows kept when "My plan" is on: my picks plus things everyone attends. Breaks drop out. */
export function onlyMine(rows: StreamRow[], mine: ReadonlySet<string>): StreamRow[] {
  return rows.filter((r) => {
    if (r.kind === "parallel") return r.picks.length > 0;
    if (r.kind === "pause") return false;
    return mine.has(r.session.id) || r.session.session_type !== "paper";
  });
}

/** Index of the row happening now, else the next one; -1 when the day is over. */
export function nowIndex(rows: StreamRow[], now: Date): number {
  const t = now.getTime();
  for (let i = 0; i < rows.length; i++) {
    const end = Math.max(...rows[i]!.slot.sessions.map((s) => new Date(s.ends_at).getTime()));
    if (end > t) return i;
  }
  return -1;
}
