/** Pure helpers for the Home "Day Dial" hero. Day window is 08:00–20:00 Indian time. */
const IST = 5.5 * 3600_000;
export const DAY_START_H = 8;
export const DAY_END_H = 20;

/** Start of the dial window (08:00 IST) for the IST calendar day containing `now`. */
export function dayWindow(now: Date): { start: number; end: number } {
  const ist = now.getTime() + IST;
  const midnight = ist - (ist % 86_400_000) - IST;
  return { start: midnight + DAY_START_H * 3600_000, end: midnight + DAY_END_H * 3600_000 };
}

/** Position 0–100 of a moment on the dial; clamped. */
export function dialPct(t: number, now: Date): number {
  const { start, end } = dayWindow(now);
  return Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
}

type Slot = { id: string; starts_at: string; ends_at: string };

/** Ticks for sessions happening on the dial day. */
export function dialTicks<T extends Slot>(sessions: T[], now: Date, mine: string[] = []) {
  const { start, end } = dayWindow(now);
  return sessions
    .filter((s) => new Date(s.ends_at).getTime() > start && new Date(s.starts_at).getTime() < end)
    .map((s) => {
      const a = dialPct(new Date(s.starts_at).getTime(), now);
      const b = dialPct(new Date(s.ends_at).getTime(), now);
      return { id: s.id, left: a, width: Math.max(0.6, b - a), mine: mine.includes(s.id) };
    });
}

/** Next session not yet ended; prefers ones in `mine`. */
export function nextItem<T extends Slot>(sessions: T[], now: Date, mine: string[] = []): T | null {
  const t = now.getTime();
  const open = sessions.filter((s) => new Date(s.ends_at).getTime() > t).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return open.find((s) => mine.includes(s.id)) ?? open[0] ?? null;
}

export function countdownParts(target: Date, now: Date) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3600_000),
    minutes: Math.floor((ms % 3600_000) / 60_000),
  };
}
