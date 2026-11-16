/** Pure helpers for the Network directory. */
export type DirPerson = {
  code: string;
  full_name: string;
  organization: string | null;
  keywords: string[];
  bio: string | null;
  linkedin_url: string | null;
  email: string | null;
  is_placeholder: boolean;
  roles: string[];
  papers: { id: string; code: string; title: string | null; track: string | null; session_id: string | null }[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** Shared keywords between two lists (case-insensitive, unique). */
export function keywordOverlap(a: string[], b: string[]): string[] {
  const set = new Set(a.map(norm));
  return Array.from(new Set(b.map(norm))).filter((k) => k && set.has(k));
}

/** People ranked by keyword overlap with me, then shared track; excludes me and zero-overlap. */
export function suggest(me: { code: string; keywords: string[]; tracks: string[] }, people: DirPerson[], limit = 8) {
  return people
    .filter((p) => p.code !== me.code)
    .map((p) => {
      const shared = keywordOverlap(me.keywords, p.keywords);
      const track = p.papers.some((x) => x.track && me.tracks.includes(x.track));
      return { p, shared, score: shared.length * 2 + (track ? 1 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.full_name.localeCompare(b.p.full_name))
    .slice(0, limit);
}

export type DirFilter = { q?: string | undefined; track?: string | undefined; role?: string | undefined; bookmarked?: string[] | undefined };

export function filterPeople(people: DirPerson[], f: DirFilter): DirPerson[] {
  const q = f.q ? norm(f.q) : "";
  return people.filter((p) => {
    if (f.track && !p.papers.some((x) => x.track === f.track)) return false;
    if (f.role && !p.roles.map((r) => (r === "payer" ? "presenter" : r)).includes(f.role)) return false;
    if (f.bookmarked && !f.bookmarked.includes(p.code)) return false;
    if (!q) return true;
    const hay = [p.full_name, p.organization ?? "", ...p.keywords, ...p.papers.map((x) => x.title ?? "")].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
