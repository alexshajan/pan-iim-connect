// Pure matching of AI-parsed timetable rows against existing conference data.
export type ParsedPaper = { title: string; authors: string | null; code: string | null };
export type ParsedRow = {
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  venue: string | null;
  track: string | null;
  title: string;
  chair: string | null;
  papers: ParsedPaper[];
};

export type Match<T = string> = { id: T | null; label: string | null; confidence: "exact" | "close" | "new" };
export type MatchedRow = ParsedRow & {
  venueMatch: Match;
  trackMatch: Match;
  sessionMatch: Match; // existing session to update
  paperMatches: Match[]; // submission matches per paper
  action: "add" | "update" | "same";
};

type Named = { id: string; name: string; alt?: string | null };
type ExistingSession = { id: string; title: string; starts_at: string; venue_id: string | null; ends_at: string; chair: string | null };
type Sub = { id: string; submission_code: string | null; title: string | null };

export const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function tokens(s: string) { return new Set(clean(s).split(" ").filter((w) => w.length > 2)); }
/** Jaccard similarity of word sets (0..1). */
export function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return clean(a) === clean(b) ? 1 : 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
}

export function matchName(value: string | null, list: Named[]): Match {
  if (!value?.trim()) return { id: null, label: null, confidence: "new" };
  const v = clean(value);
  const exact = list.find((x) => clean(x.name) === v || (x.alt && clean(x.alt) === v));
  if (exact) return { id: exact.id, label: exact.name, confidence: "exact" };
  let best: Named | null = null, score = 0;
  for (const x of list) {
    const sc = Math.max(similarity(value, x.name), x.alt ? similarity(value, x.alt) : 0, clean(x.name).includes(v) || v.includes(clean(x.name)) ? 0.6 : 0);
    if (sc > score) { score = sc; best = x; }
  }
  return best && score >= 0.5 ? { id: best.id, label: best.name, confidence: "close" } : { id: null, label: value, confidence: "new" };
}

export function matchPaper(p: ParsedPaper, subs: Sub[]): Match {
  if (p.code) {
    const hit = subs.find((s) => !!s.submission_code && clean(s.submission_code) === clean(p.code!));
    if (hit) return { id: hit.id, label: hit.submission_code, confidence: "exact" };
  }
  let best: Sub | null = null, score = 0;
  for (const s of subs) { const sc = s.title ? similarity(p.title, s.title) : 0; if (sc > score) { score = sc; best = s; } }
  if (best && score >= 0.9) return { id: best.id, label: best.submission_code, confidence: "exact" };
  if (best && score >= 0.5) return { id: best.id, label: best.submission_code, confidence: "close" };
  return { id: null, label: null, confidence: "new" };
}

const iso = (date: string, hm: string) => new Date(`${date}T${hm.padStart(5, "0")}:00+05:30`).toISOString();

export function matchRows(
  rows: ParsedRow[],
  data: { venues: Named[]; tracks: Named[]; sessions: ExistingSession[]; subs: Sub[] },
): MatchedRow[] {
  return rows.map((r) => {
    const venueMatch = matchName(r.venue, data.venues);
    const trackMatch = matchName(r.track, data.tracks);
    const startIso = iso(r.date, r.start);
    const endIso = iso(r.date, r.end);
    const sameDay = data.sessions.filter((s) => s.starts_at.slice(0, 10) === startIso.slice(0, 10) || new Date(s.starts_at).toDateString() === new Date(startIso).toDateString());
    let sessionMatch: Match = { id: null, label: null, confidence: "new" };
    let best: ExistingSession | null = null, score = 0;
    for (const s of sameDay) { const sc = similarity(r.title, s.title); if (sc > score) { score = sc; best = s; } }
    if (best && score >= 0.5) sessionMatch = { id: best.id, label: best.title, confidence: score >= 0.9 ? "exact" : "close" };
    let action: MatchedRow["action"] = "add";
    if (best && sessionMatch.id) {
      const same = new Date(best.starts_at).getTime() === new Date(startIso).getTime()
        && new Date(best.ends_at).getTime() === new Date(endIso).getTime()
        && (best.venue_id ?? null) === (venueMatch.id ?? null)
        && (best.chair ?? "") === (r.chair ?? "");
      action = same ? "same" : "update";
    }
    return { ...r, venueMatch, trackMatch, sessionMatch, paperMatches: r.papers.map((p) => matchPaper(p, data.subs)), action };
  });
}

export const rowStartIso = (r: ParsedRow) => iso(r.date, r.start);
export const rowEndIso = (r: ParsedRow) => iso(r.date, r.end);
