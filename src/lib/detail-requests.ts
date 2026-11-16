// Guest "fix my details" requests: pure helpers shared by Me and the console.

export type DetailKind = "presenter" | "name" | "email" | "affiliation";
export type DetailStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type DetailRequest = {
  id: string; kind: DetailKind; status: DetailStatus; submission_id: string | null;
  author_index: number | null; proposed_name: string | null; proposed_email: string | null; proposed_org?: string | null;
  note: string | null; decision_note: string | null; created_at: string; decided_at: string | null;
};
export type Author = { name: string; org?: string | null };

const HONORIFIC = /^\s*(dr|prof|mr|ms|mrs)\.?\s+/i;

/** Name as it prints on a card: honorifics and extra spaces removed. */
export function cleanName(name: string): string {
  let n = name.replace(/\s+/g, " ").trim();
  while (HONORIFIC.test(n)) n = n.replace(HONORIFIC, "");
  return n;
}

export const KIND_LABEL: Record<DetailKind, string> = {
  presenter: "I'm presenting this paper",
  name: "Fix my name",
  email: "Add a second sign-in email",
  affiliation: "Update my affiliation",
};

/** Latest request per (kind, paper); a newer one replaces older ones. */
export function latestRequests(list: DetailRequest[]): DetailRequest[] {
  const seen = new Map<string, DetailRequest>();
  for (const r of [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (r.status === "withdrawn") continue;
    const k = `${r.kind}:${r.kind === "presenter" ? r.submission_id : ""}`;
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

/** Name to show the guest on their own pass while a change waits for review. */
export function nameOnPass(current: string, list: DetailRequest[]): { name: string; pending: boolean } {
  const p = latestRequests(list).find((r) => r.status === "pending" && (r.kind === "name" || r.kind === "presenter") && r.proposed_name);
  return p ? { name: cleanName(p.proposed_name!), pending: true } : { name: current, pending: false };
}

/** Index (1-based) of the author that best matches the person's name, or null. */
export function matchAuthor(fullName: string, authors: Author[]): number | null {
  const tok = (s: string) => cleanName(s).toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean);
  const me = tok(fullName);
  if (!me.length) return null;
  const exact = authors.findIndex((a) => tok(a.name).join(" ") === me.join(" "));
  if (exact >= 0) return exact + 1;
  const loose = authors.findIndex((a) => { const t = tok(a.name); return t.length > 0 && t.every((x) => me.includes(x)) || me.every((x) => t.includes(x)); });
  return loose >= 0 ? loose + 1 : null;
}

export function statusText(r: DetailRequest): string {
  if (r.status === "pending") return "Waiting for the organizers";
  if (r.status === "approved") return "Updated";
  if (r.status === "rejected") return "Needs another look";
  return "Withdrawn";
}
