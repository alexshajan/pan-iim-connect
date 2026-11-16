/** APA 7 author lines and citations for conference papers. Pure, tested. */
export type AuthorRef = { name: string; org?: string | null };

const TITLES = /^(dr|prof|mr|ms|mrs|shri|smt)\.?\s+/i;
export const plainName = (n: string) => { let s = n.trim(); while (TITLES.test(s)) s = s.replace(TITLES, ""); return s.replace(/\s+/g, " "); };
export const nameKey = (n: string) => plainName(n).toLowerCase().replace(/[^a-z]/g, "");

/** "A", "A & B", "A, B, & C" separators, APA 7 style. */
export function joiner(i: number, total: number, reference = false): string {
  if (i === 0) return "";
  if (total === 2) return reference ? ", & " : " & ";
  return i === total - 1 ? ", & " : ", ";
}

export function joinAuthors(names: string[], reference = false): string {
  return names.map((n, i) => joiner(i, names.length, reference) + n).join("");
}

/** "Rohan K. Sen" -> "Sen, R. K." */
export function apaName(full: string): string {
  const parts = plainName(full).replace(/\./g, ". ").split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const initials = parts.slice(0, -1).map((p) => `${p.charAt(0).toUpperCase()}.`).join(" ");
  return `${last.charAt(0).toUpperCase()}${last.slice(1)}, ${initials}`;
}

/** Numbered affiliations in order of first appearance; authors get their index. */
export function affiliations(authors: AuthorRef[]): { orgs: string[]; marks: (number | null)[] } {
  const orgs: string[] = [];
  const marks = authors.map((a) => {
    const o = a.org?.trim();
    if (!o) return null;
    let i = orgs.indexOf(o);
    if (i < 0) { orgs.push(o); i = orgs.length - 1; }
    return i + 1;
  });
  return { orgs, marks };
}

export const CONFERENCE = "11th Pan-IIM World Management Conference";

export function apaCitation(authors: AuthorRef[], title: string): string {
  const names = authors.map((a) => apaName(a.name)).filter(Boolean);
  const who = names.length > 20 ? [...names.slice(0, 19), "…", names[names.length - 1]].join(", ") : joinAuthors(names, true);
  const t = title.trim().replace(/[.\s]+$/, "");
  return `${who} (2026, November 27–29). ${t} [Paper presentation]. ${CONFERENCE}, IIM Shillong, Meghalaya, India.`;
}

export function bibtex(authors: AuthorRef[], title: string, code?: string | null | undefined): string {
  const who = authors.map((a) => apaName(a.name).replace(/,\s*/, ", ")).join(" and ");
  return `@inproceedings{wmc2026_${code ?? "paper"},\n  author    = {${who}},\n  title     = {${title.trim()}},\n  booktitle = {Proceedings of the ${CONFERENCE}},\n  year      = {2026},\n  address   = {Shillong, India}\n}`;
}
