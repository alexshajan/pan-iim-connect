// Smart Slotter: pure capacity, misfit and suggestion logic for the paper programme.
// The UI keeps a draft placement map; nothing here touches the database.

export type SPaper = { id: string; code: string; title: string | null; track: string | null; mode: string; presenters: string[] };
export type SSession = {
  id: string; code: string | null; title: string; area: string | null; mode: string | null;
  slot: string; day: string; starts_at: string; target: number | null; locked: boolean;
};
export type Place = { session_id: string | null; order: number | null };
export type Placement = Record<string, Place>;

export const DEFAULT_TARGET = 6;
export const targetOf = (s: SSession) => s.target ?? DEFAULT_TARGET;
const isOnline = (m: string | null | undefined) => (m ?? "").toLowerCase() === "online";

const STOP = new Set("a an the of and or in on for to with from by at as is are be its into via using use study analysis evidence approach role impact effect effects towards toward among between case new based through their from india indian firms firm study".split(" "));
/** Academic-ish tokens: lower case, stop words out, light stemming so "markets"/"market" meet. */
export function tokens(text: string | null | undefined): string[] {
  return (text ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => w.replace(/(ies)$/, "y").replace(/(ing|ed|es|s)$/, "") || w)
    .filter((w) => w.length >= 3);
}

function bag(texts: (string | null | undefined)[], weight = 1, into = new Map<string, number>()) {
  for (const t of texts) for (const w of new Set(tokens(t))) into.set(w, (into.get(w) ?? 0) + weight);
  return into;
}
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const o = b.get(k); if (o) dot += v * o; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** 0..1 thematic fit of a paper with a session's other papers plus its area and title. */
export function fitScore(p: SPaper, s: SSession, others: SPaper[]) {
  const centre = bag(others.filter((o) => o.id !== p.id).map((o) => o.title));
  bag([s.area, s.title], 2, centre);
  bag(others.filter((o) => o.id !== p.id).map((o) => o.track), 0.5, centre);
  return cosine(bag([p.title]).set("__t:" + (p.track ?? ""), 0), centre) + (p.track && s.area && tokens(p.track).some((w) => tokens(s.area).includes(w)) ? 0.15 : 0);
}

export function papersBySession(papers: SPaper[], place: Placement) {
  const out = new Map<string | null, SPaper[]>();
  for (const p of papers) {
    const k = place[p.id]?.session_id ?? null;
    out.set(k, [...(out.get(k) ?? []), p]);
  }
  for (const list of out.values()) list.sort((a, b) => (place[a.id]?.order ?? 99) - (place[b.id]?.order ?? 99));
  return out;
}

export type Load = "empty" | "under" | "ok" | "over";
export function loadOf(n: number, target: number): Load {
  if (n === 0) return "empty";
  if (n > target) return "over";
  if (n < target) return "under";
  return "ok";
}

export type IssueKind = "over" | "under" | "mode" | "clash" | "misfit" | "unplaced";
export type Issue = { kind: IssueKind; session_id?: string; paper_id?: string; detail: string };
export type Move = { paper_id: string; to: string | null };
export type Suggestion = { id: string; issue: Issue; moves: Move[]; why: string; gain?: number };

const norm = (n: string) => n.toLowerCase().replace(/^(prof|dr)\.?\s*/, "").replace(/[^a-z]/g, "");

export function findIssues(sessions: SSession[], papers: SPaper[], place: Placement): Issue[] {
  const by = papersBySession(papers, place);
  const sById = new Map(sessions.map((s) => [s.id, s]));
  const out: Issue[] = [];
  for (const s of sessions) {
    if (s.locked) continue;
    const n = by.get(s.id)?.length ?? 0, t = targetOf(s);
    if (n > t) out.push({ kind: "over", session_id: s.id, detail: `${n} papers, target ${t}` });
    else if (n < t) out.push({ kind: "under", session_id: s.id, detail: `${n} of ${t}, ${t - n} open` });
  }
  for (const p of by.get(null) ?? []) out.push({ kind: "unplaced", paper_id: p.id, detail: "Not in any session" });
  // Mode and fit per placed paper.
  for (const [sid, list] of by) {
    const s = sid ? sById.get(sid) : undefined;
    if (!s || s.locked) continue;
    for (const p of list) {
      if (s.mode && isOnline(p.mode) !== isOnline(s.mode))
        out.push({ kind: "mode", session_id: s.id, paper_id: p.id, detail: `${isOnline(p.mode) ? "Online" : "On-campus"} paper in ${isOnline(s.mode) ? "an online" : "an on-campus"} session` });
      else if (list.length >= 3 && fitScore(p, s, list) < 0.06)
        out.push({ kind: "misfit", session_id: s.id, paper_id: p.id, detail: "Shares little with the rest of this session" });
    }
  }
  // Presenter in two sessions of one slot.
  const slotPeople = new Map<string, Map<string, string>>();
  for (const p of papers) {
    const s = sById.get(place[p.id]?.session_id ?? "");
    if (!s) continue;
    const m = slotPeople.get(s.day + s.slot) ?? new Map<string, string>();
    slotPeople.set(s.day + s.slot, m);
    for (const who of p.presenters) {
      const k = norm(who);
      if (!k) continue;
      const prev = m.get(k);
      if (prev && prev !== s.id) out.push({ kind: "clash", session_id: s.id, paper_id: p.id, detail: `${who} also presents in a parallel session` });
      else m.set(k, s.id);
    }
  }
  return out;
}

/** Best unlocked destination with room, matching the paper's mode. Prefers its own slot. */
export function bestHome(p: SPaper, sessions: SSession[], papers: SPaper[], place: Placement, opts: { exclude?: string | undefined; sameSlotAs?: SSession | undefined } = {}) {
  const by = papersBySession(papers, place);
  let best: { s: SSession; score: number } | null = null;
  for (const s of sessions) {
    if (s.locked || s.id === opts.exclude) continue;
    if (s.mode && isOnline(s.mode) !== isOnline(p.mode)) continue;
    const list = by.get(s.id) ?? [];
    if (list.length >= targetOf(s)) continue;
    const score = fitScore(p, s, list) + (opts.sameSlotAs && s.day === opts.sameSlotAs.day && s.slot === opts.sameSlotAs.slot ? 0.2 : 0);
    if (!best || score > best.score) best = { s, score };
  }
  return best;
}

const pct = (x: number) => `${Math.round(Math.min(1, x) * 100)}%`;

export function suggest(sessions: SSession[], papers: SPaper[], place: Placement, issues = findIssues(sessions, papers, place)): Suggestion[] {
  const by = papersBySession(papers, place);
  const sById = new Map(sessions.map((s) => [s.id, s]));
  const pById = new Map(papers.map((p) => [p.id, p]));
  const out: Suggestion[] = [];
  const used = new Set<string>();
  const label = (s: SSession) => s.code ?? s.title;
  for (const issue of issues) {
    if (issue.kind === "under") continue; // filled by moves from other issues
    if (issue.kind === "over") {
      const s = sById.get(issue.session_id!)!;
      const list = by.get(s.id) ?? [];
      const worst = [...list].filter((p) => !used.has(p.id)).sort((a, b) => fitScore(a, s, list) - fitScore(b, s, list))[0];
      if (!worst) continue;
      const home = bestHome(worst, sessions, papers, place, { exclude: s.id, sameSlotAs: s });
      if (!home) continue;
      used.add(worst.id);
      out.push({ id: `over:${s.id}`, issue, moves: [{ paper_id: worst.id, to: home.s.id }], gain: home.score,
        why: `${label(s)} is over target. #${worst.code} fits ${label(home.s)} best (${pct(home.score)}) and it has room.` });
      continue;
    }
    const p = pById.get(issue.paper_id!);
    if (!p || used.has(p.id)) continue;
    const from = issue.session_id ? sById.get(issue.session_id) : undefined;
    const home = bestHome(p, sessions, papers, place, { exclude: from?.id, sameSlotAs: from });
    if (!home) continue;
    if (issue.kind === "misfit" && from && home.score <= fitScore(p, from, by.get(from.id) ?? []) + 0.05) continue;
    used.add(p.id);
    const verb = { mode: "Matches its mode", clash: "Frees the presenter", misfit: "Closer theme", unplaced: "Has room", over: "", under: "" }[issue.kind];
    out.push({ id: `${issue.kind}:${p.id}`, issue, moves: [{ paper_id: p.id, to: home.s.id }], gain: home.score,
      why: `${verb}: move #${p.code} to ${label(home.s)} (fit ${pct(home.score)}).` });
  }
  return out;
}

/** Apply moves to a placement, appending each paper at the end of its new session. */
export function applyMoves(place: Placement, moves: Move[], papers: SPaper[]): Placement {
  const next: Placement = { ...place };
  for (const m of moves) {
    const count = papers.filter((p) => next[p.id]?.session_id === m.to && p.id !== m.paper_id).length;
    next[m.paper_id] = { session_id: m.to, order: m.to ? count + 1 : null };
  }
  return next;
}

/** Changed rows between published and draft, ready for apply_slotter_moves(). */
export function diffPlacement(base: Placement, draft: Placement) {
  return Object.entries(draft)
    .filter(([id, d]) => base[id]?.session_id !== d.session_id || base[id]?.order !== d.order)
    .map(([id, d]) => ({ id, session_id: d.session_id, order: d.order }));
}

/** Placement is blocked when either end of the move is locked. */
export function canMove(place: Placement, paperId: string, to: string | null, sessions: SSession[]) {
  const locked = new Set(sessions.filter((s) => s.locked).map((s) => s.id));
  const from = place[paperId]?.session_id ?? null;
  return from === to || (!(from && locked.has(from)) && !(to && locked.has(to)));
}
