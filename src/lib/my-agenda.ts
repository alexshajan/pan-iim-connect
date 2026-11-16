import type { Session } from "./conference";

export type AgendaReason = "presenting" | "co-author" | "chair" | "starred" | "common";
export type MyItem = { session: Session; reason: AgendaReason; role?: string };
export type MySub = { role: string; session_id: string | null };
export type FreeSlot = { day: string; startIso: string; endIso: string; minutes: number };

/** Session types everyone attends. */
export const COMMON_TYPES = ["keynote", "plenary", "panel", "ceremony", "break", "meal", "evening", "social"];

const PRIORITY: Record<AgendaReason, number> = {
  presenting: 0,
  chair: 1,
  "co-author": 2,
  starred: 3,
  common: 4,
};

/**
 * My Plan: own paper slots, organizer "everyone" sessions and stars only.
 * Chair matching is opt-in (organizer views).
 */
export function myAgendaItems(
  sessions: Session[],
  opts: { fullName?: string | null; subs?: MySub[]; starred?: string[]; includeChair?: boolean },
): MyItem[] {
  const name = opts.fullName?.trim().toLowerCase() ?? "";
  const subBySession = new Map<string, string>();
  for (const s of opts.subs ?? []) if (s.session_id) subBySession.set(s.session_id, s.role);
  const starred = new Set(opts.starred ?? []);
  const out: MyItem[] = [];
  for (const s of sessions) {
    const reasons: MyItem[] = [];
    const subRole = subBySession.get(s.id);
    if (subRole) {
      const presenting = /present|lead|corresponding/i.test(subRole);
      reasons.push({ session: s, reason: presenting ? "presenting" : "co-author", role: subRole });
    }
    if (opts.includeChair && name.length > 2 && s.chair && s.chair.toLowerCase().includes(name))
      reasons.push({ session: s, reason: "chair", role: "Chair" });
    if (starred.has(s.id)) reasons.push({ session: s, reason: "starred" });
    if (s.in_everyone_plan) reasons.push({ session: s, reason: "common" });
    if (reasons.length) out.push(reasons.sort((a, b) => PRIORITY[a.reason] - PRIORITY[b.reason])[0]!);
  }
  return out.sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at));
}

/** Gaps of at least `minMinutes` between a day's items, within the day's programme bounds. */
export function freeSlots(
  items: MyItem[],
  dayBounds: { day: string; startIso: string; endIso: string }[],
  dayOf: (iso: string) => string,
  minMinutes = 30,
): FreeSlot[] {
  const out: FreeSlot[] = [];
  for (const b of dayBounds) {
    const mine = items
      .filter((i) => dayOf(i.session.starts_at) === b.day)
      .sort((x, y) => x.session.starts_at.localeCompare(y.session.starts_at));
    let cursor = new Date(b.startIso).getTime();
    const end = new Date(b.endIso).getTime();
    const push = (to: number) => {
      const mins = Math.round((to - cursor) / 60000);
      if (mins >= minMinutes)
        out.push({ day: b.day, startIso: new Date(cursor).toISOString(), endIso: new Date(to).toISOString(), minutes: mins });
    };
    for (const i of mine) {
      const s = new Date(i.session.starts_at).getTime();
      if (s > cursor) push(s);
      cursor = Math.max(cursor, new Date(i.session.ends_at).getTime());
    }
    if (end > cursor) push(end);
  }
  return out;
}

export const reasonLabel: Record<AgendaReason, string> = {
  presenting: "You present",
  "co-author": "Your paper",
  chair: "You chair",
  starred: "Starred",
  common: "For everyone",
};
