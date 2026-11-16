import type { Session, Venue } from "@/lib/conference";
import { dayKey } from "@/lib/format";

const TZ = "Asia/Kolkata";

/** Minutes since midnight (India time) for an ISO timestamp. */
export function minutesOfDay(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(iso));
  const [h, m] = parts.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function durationMinutes(session: Session) {
  return Math.max(
    15,
    Math.round((new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60000),
  );
}

export function labelForMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type DayOption = { key: string; iso: string };

export function conferenceDays(sessions: Session[]): DayOption[] {
  const map = new Map<string, string>();
  sessions.forEach((s) => {
    const k = dayKey(s.starts_at);
    if (!map.has(k)) map.set(k, s.starts_at);
  });
  return [...map.entries()].map(([key, iso]) => ({ key, iso }));
}

/** Distinct venues used by the given sessions, in venue sort order. */
export function venuesInPlay(sessions: Session[]): Venue[] {
  const map = new Map<string, Venue>();
  sessions.forEach((s) => {
    if (s.venues) map.set(s.venues.id, s.venues);
  });
  return [...map.values()].sort((a, b) => a.sort_order - b.sort_order);
}

export type Slot = {
  /** Minutes since midnight of the earliest start in this slot. */
  start: number;
  end: number;
  startIso: string;
  sessions: Session[];
};

/**
 * Group sessions of a day into time slots. Sessions that start within
 * `tolerance` minutes of each other are treated as running in parallel.
 */
export function groupIntoSlots(sessions: Session[], tolerance = 10): Slot[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const slots: Slot[] = [];
  for (const s of sorted) {
    const start = minutesOfDay(s.starts_at);
    const end = minutesOfDay(s.ends_at);
    const last = slots[slots.length - 1];
    // Sessions sharing a programme slot code (online and in-person rooms of one block) stay together.
    const sameSlot = !!s.slot_code && last?.sessions.some((x) => x.slot_code === s.slot_code);
    if (last && (sameSlot || Math.abs(start - last.start) <= tolerance)) {
      last.sessions.push(s);
      last.end = Math.max(last.end, end);
    } else {
      slots.push({ start, end, startIso: s.starts_at, sessions: [s] });
    }
  }
  return slots;
}

export function overlaps(a: Session, b: Session) {
  const as = new Date(a.starts_at).getTime();
  const ae = new Date(a.ends_at).getTime();
  const bs = new Date(b.starts_at).getTime();
  const be = new Date(b.ends_at).getTime();
  return as < be && bs < ae;
}

export type Clash = { a: Session; b: Session };

/** Pairs of starred sessions whose times overlap. */
export function findClashes(sessions: Session[], starred: string[]): Clash[] {
  const mine = sessions
    .filter((s) => starred.includes(s.id) && s.status !== "cancelled")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const out: Clash[] = [];
  for (let i = 0; i < mine.length; i++) {
    for (let j = i + 1; j < mine.length; j++) {
      const a = mine[i]!;
      const b = mine[j]!;
      if (overlaps(a, b)) out.push({ a, b });
      else break;
    }
  }
  return out;
}

/** Walking minutes between two sessions' venues, when we know them. */
export function walkGap(from: Session, to: Session) {
  if (!from.venues || !to.venues) return null;
  if (from.venues.id === to.venues.id) return 0;
  const gapMin = Math.round(
    (new Date(to.starts_at).getTime() - new Date(from.ends_at).getTime()) / 60000,
  );
  const walk = to.venues.walk_minutes ?? 5;
  return { walk, gapMin, tight: gapMin < walk };
}

export type PaperHit = {
  session: Session;
  paperId: string;
  title: string;
  authors: string;
  affiliation: string | null;
};

/** Search across session titles, paper titles, authors and affiliations. */
export function searchSchedule(sessions: Session[], raw: string) {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return { sessions: [] as Session[], papers: [] as PaperHit[] };
  const sessionHits = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      (s.summary ?? "").toLowerCase().includes(q) ||
      (s.chair ?? "").toLowerCase().includes(q) ||
      (s.tracks?.name ?? "").toLowerCase().includes(q),
  );
  const paperHits: PaperHit[] = [];
  sessions.forEach((s) =>
    (s.papers ?? []).forEach((p) => {
      if (
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        (p.affiliation ?? "").toLowerCase().includes(q) ||
        (p.abstract ?? "").toLowerCase().includes(q)
      ) {
        paperHits.push({
          session: s,
          paperId: p.id,
          title: p.title,
          authors: p.authors,
          affiliation: p.affiliation,
        });
      }
    }),
  );
  return { sessions: sessionHits, papers: paperHits };
}
