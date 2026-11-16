/** Papers discovery: flatten sessions into papers, filter, group. Pure, tested. */
import type { Session } from "@/lib/conference";

export type BrowsePaper = {
  id: string;
  code: string | null;
  title: string;
  authors: string;
  authorList: { name: string; org?: string | null }[];
  presenter: string | null;
  affiliation: string | null;
  mode: "online" | "in_person";
  track: string;
  sessionId: string;
  sessionTitle: string;
  startsAt: string;
  room: string | null;
};

export function flattenPapers(sessions: Session[]): BrowsePaper[] {
  const out: BrowsePaper[] = [];
  for (const s of sessions)
    for (const p of s.papers ?? [])
      out.push({
        id: p.id,
        code: p.code ?? null,
        title: p.title,
        authors: p.authors,
        authorList: p.authorList ?? [],
        presenter: p.presenter ?? null,
        affiliation: p.affiliation,
        mode: (p.mode ?? s.mode) === "online" ? "online" : "in_person",
        track: s.area ?? s.tracks?.name ?? "Other domains",
        sessionId: s.id,
        sessionTitle: s.title,
        startsAt: s.starts_at,
        room: s.room ?? s.venues?.short_name ?? null,
      });
  return out;
}

export type PaperFilter = { q: string; track: string; mode: string };

export function filterPapers(list: BrowsePaper[], f: PaperFilter): BrowsePaper[] {
  const q = f.q.trim().toLowerCase();
  return list.filter(
    (p) =>
      (!f.track || p.track === f.track) &&
      (f.mode !== "online" || p.mode === "online") &&
      (f.mode !== "in_person" || p.mode === "in_person") &&
      (!q || `${p.title} ${p.code ?? ""} ${p.authors} ${p.affiliation ?? ""}`.toLowerCase().includes(q)),
  );
}

/** Tracks with paper counts, biggest first. */
export function trackCounts(list: BrowsePaper[]): { track: string; count: number }[] {
  const m = new Map<string, number>();
  for (const p of list) m.set(p.track, (m.get(p.track) ?? 0) + 1);
  return [...m].map(([track, count]) => ({ track, count })).sort((a, b) => b.count - a.count || a.track.localeCompare(b.track));
}
