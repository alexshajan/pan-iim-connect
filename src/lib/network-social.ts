/** Pure helpers for the social layer of Network: reasons, waves, icebreakers. */
import { keywordOverlap, type DirPerson } from "./network";

export type Wave = { code: string; direction: "in" | "out"; created_at: string };
export type MeLite = { code: string; keywords: string[]; tracks: string[]; organization?: string | null };
export type SessionLite = { id: string; starts_at: string; ends_at: string; venue?: string | null };

/** Codes where both people waved. */
export function mutualWaves(waves: Wave[]): string[] {
  const out = new Set(waves.filter((w) => w.direction === "out").map((w) => w.code));
  return [...new Set(waves.filter((w) => w.direction === "in" && out.has(w.code)).map((w) => w.code))];
}

/** Short human reasons to meet someone, most specific first. */
export function reasonsFor(me: MeLite, p: DirPerson, sessions: SessionLite[] = [], now = new Date()): string[] {
  const r: string[] = [];
  const shared = keywordOverlap(me.keywords, p.keywords);
  if (shared.length) r.push(`Shared: ${shared.slice(0, 2).join(", ")}`);
  const next = p.papers
    .map((x) => sessions.find((s) => s.id === x.session_id))
    .filter((s): s is SessionLite => !!s && new Date(s.ends_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (next) {
    const mins = Math.round((new Date(next.starts_at).getTime() - now.getTime()) / 60000);
    if (mins <= 0) r.push(`Presenting now${next.venue ? `, ${next.venue}` : ""}`);
    else if (mins < 180) r.push(`Presenting in ${mins} min${next.venue ? `, ${next.venue}` : ""}`);
  }
  if (p.papers.some((x) => x.track && me.tracks.includes(x.track))) r.push("Same track as you");
  if (me.organization && p.organization && me.organization.trim().toLowerCase() === p.organization.trim().toLowerCase())
    r.push("Same institute");
  if (p.roles.includes("keynote")) r.push("Keynote speaker");
  return r;
}

/** Feed order: people with reasons first, excluding me, skipped and already met. */
export function feed(me: MeLite, people: DirPerson[], opts: { skip?: string[]; met?: string[]; sessions?: SessionLite[]; now?: Date } = {}) {
  const hide = new Set([me.code, ...(opts.skip ?? []), ...(opts.met ?? [])]);
  return people
    .filter((p) => !hide.has(p.code))
    .map((p) => ({ p, reasons: reasonsFor(me, p, opts.sessions, opts.now) }))
    .sort((a, b) => b.reasons.length - a.reasons.length || a.p.full_name.localeCompare(b.p.full_name));
}

export function icebreaker(me: MeLite, p: DirPerson): string {
  const shared = keywordOverlap(me.keywords, p.keywords);
  const paper = p.papers.find((x) => x.title)?.title;
  if (paper) return `Ask about their paper “${paper.length > 70 ? paper.slice(0, 70) + "…" : paper}”.`;
  if (shared.length) return `You both work on ${shared[0]}. Ask what got them into it.`;
  if (p.organization) return `Ask what research is buzzing at ${p.organization} right now.`;
  return "Ask which session surprised them most today.";
}
