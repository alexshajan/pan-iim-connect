/** Pure checks for the console "Needs attention" panel. */
export type IssuePerson = {
  id: string;
  delegate_code: string;
  email: string;
  alt_email?: string | null;
  full_name: string;
  phone: string | null;
  organization: string | null;
  user_id: string | null;
  is_placeholder?: boolean;
};

export type IssueKind = "shared_email" | "similar_name" | "same_phone" | "placeholder_email" | "bad_code" | "not_signed_in";
export type Issue = { kind: IssueKind; ids: string[]; label: string };

export const ISSUE_LABELS: Record<IssueKind, string> = {
  shared_email: "Same email on two profiles",
  similar_name: "Possible duplicates",
  same_phone: "Same phone number",
  placeholder_email: "Made-up email",
  bad_code: "Code not WMC-XXXX",
  not_signed_in: "Never signed in",
};

export const CODE_RE = /^WMC-[A-Z0-9]{4,5}$/;
export const isPlaceholderEmail = (e: string) => /\.local$|\.test$|@cards\.paniim/i.test(e.trim());
export const normPhone = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
export const normName = (n: string) =>
  n.toLowerCase().replace(/\b(prof|dr|mr|ms|mrs)\.?\s+/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

function groupBy(people: IssuePerson[], key: (p: IssuePerson) => string[]) {
  const m = new Map<string, Set<string>>();
  for (const p of people) for (const k of key(p)) if (k) (m.get(k) ?? m.set(k, new Set()).get(k)!).add(p.id);
  return [...m.entries()].filter(([, s]) => s.size > 1).map(([k, s]) => ({ k, ids: [...s] }));
}

export function findIssues(people: IssuePerson[]): Issue[] {
  const out: Issue[] = [];
  for (const g of groupBy(people, (p) => [p.email.toLowerCase(), (p.alt_email ?? "").toLowerCase()]))
    out.push({ kind: "shared_email", ids: g.ids, label: g.k });
  for (const g of groupBy(people, (p) => [`${normName(p.full_name)}|${(p.organization ?? "").toLowerCase().trim()}`]))
    out.push({ kind: "similar_name", ids: g.ids, label: g.k.split("|")[0]! });
  for (const g of groupBy(people, (p) => [normPhone(p.phone).length === 10 ? normPhone(p.phone) : ""]))
    out.push({ kind: "same_phone", ids: g.ids, label: g.k });
  for (const p of people) {
    if (p.is_placeholder) continue;
    if (isPlaceholderEmail(p.email)) out.push({ kind: "placeholder_email", ids: [p.id], label: p.email });
    if (!CODE_RE.test(p.delegate_code)) out.push({ kind: "bad_code", ids: [p.id], label: p.delegate_code });
    if (!p.user_id) out.push({ kind: "not_signed_in", ids: [p.id], label: p.full_name });
  }
  return out;
}

/** Checks a console edit before saving; returns an error message or null. */
export function validateEdit(p: IssuePerson, others: IssuePerson[]): string | null {
  const email = p.email.trim().toLowerCase();
  const alt = (p.alt_email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Main email doesn't look right";
  if (alt && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alt)) return "Second email doesn't look right";
  if (!p.full_name.trim()) return "Name is needed";
  const code = p.delegate_code.trim().toUpperCase();
  if (!CODE_RE.test(code)) return "Code must look like WMC-AB12";
  for (const o of others) {
    if (o.id === p.id) continue;
    if (o.delegate_code.toUpperCase() === code) return `Code ${code} already belongs to ${o.full_name}`;
    const theirs = [o.email.toLowerCase(), (o.alt_email ?? "").toLowerCase()].filter(Boolean);
    if (theirs.includes(email) || (alt && theirs.includes(alt))) return `That email is already on ${o.full_name}`;
  }
  return null;
}
