// Affiliation standardizer: maps a typed institution to the standard name used across the app.

export type Alias = { raw: string; canonical: string };
export type Suggestion = { canonical: string; how: "known spelling" | "standard name" | "close match" | "new" };

const STOP = new Set(["of", "the", "and", "for", "in", "at", "department", "dept", "school", "faculty", "india", "deemed", "to", "be", "university"]);
const ABBR: [RegExp, string][] = [
  [/\bindian institute of management\b/g, "iim"],
  [/\bindian institute of technology\b/g, "iit"],
  [/\bnational institute of technology\b/g, "nit"],
];

export function normOrg(s: string): string {
  let t = s.toLowerCase().replace(/&/g, " and ");
  for (const [re, to] of ABBR) t = t.replace(re, to);
  return t.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
const tokens = (s: string) => normOrg(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));

/** Best standard name for what a guest typed; "new" keeps their text (tidied). */
export function standardizeAffiliation(input: string, aliases: Alias[]): Suggestion {
  const typed = input.replace(/\s+/g, " ").trim();
  const n = normOrg(typed);
  if (!n) return { canonical: typed, how: "new" };
  const raw = aliases.find((a) => normOrg(a.raw) === n);
  if (raw) return { canonical: raw.canonical, how: "known spelling" };
  const canonicals = [...new Set(aliases.map((a) => a.canonical))];
  const exact = canonicals.find((c) => normOrg(c) === n);
  if (exact) return { canonical: exact, how: "standard name" };
  const mine = tokens(typed);
  let best: { c: string; score: number } | null = null;
  for (const c of canonicals) {
    const theirs = tokens(c);
    if (!theirs.length || !mine.length) continue;
    const hit = theirs.filter((w) => mine.includes(w)).length;
    const score = hit / theirs.length; // every word of the standard name appears in what they typed
    if (hit >= 1 && score === 1 && (!best || theirs.length > tokens(best.c).length)) best = { c, score };
  }
  return best ? { canonical: best.c, how: "close match" } : { canonical: typed, how: "new" };
}
