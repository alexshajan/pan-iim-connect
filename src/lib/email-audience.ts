// Pure audience logic for organizer emails (tested). No I/O.

export type AudiencePerson = {
  id: string;
  full_name: string;
  email: string;
  email_missing?: boolean;
  phone: string | null;
  organization: string | null;
  attendance_mode: string;
  user_id: string | null;
  delegate_code: string;
  roles: string[];
  is_placeholder?: boolean;
};

export type AudienceFilter = {
  roles: string[]; // any of; empty = everyone
  institutions: string[]; // any of; empty = everyone
  attendance: "any" | "offline" | "online";
  signedIn: "any" | "yes" | "no";
  missingOnly: boolean;
};

export const EMPTY_FILTER: AudienceFilter = { roles: [], institutions: [], attendance: "any", signedIn: "any", missingOnly: false };

/** Human labels of details a person still has to supply. */
export function missingFields(p: AudiencePerson): string[] {
  const out: string[] = [];
  if (!p.phone?.trim()) out.push("Phone number");
  if (!p.organization?.trim()) out.push("Institution");
  return out;
}

export const hasUsableEmail = (p: AudiencePerson) =>
  !p.email_missing && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) && !/\.test$|@placeholder\./i.test(p.email);

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

export function filterAudience(people: AudiencePerson[], f: AudienceFilter): AudiencePerson[] {
  const inst = new Set(f.institutions.map((i) => i.toLowerCase()));
  return people.filter((p) => {
    if (p.is_placeholder || !hasUsableEmail(p)) return false;
    if (f.roles.length && !p.roles.some((r) => f.roles.includes(r))) return false;
    if (inst.size && !inst.has(norm(p.organization))) return false;
    if (f.attendance === "offline" && p.attendance_mode === "online") return false;
    if (f.attendance === "online" && p.attendance_mode !== "online") return false;
    if (f.signedIn === "yes" && !p.user_id) return false;
    if (f.signedIn === "no" && p.user_id) return false;
    if (f.missingOnly && !missingFields(p).length) return false;
    return true;
  });
}

/** Institutions by headcount, merged case-insensitively. */
export function institutionCounts(people: AudiencePerson[]): { name: string; count: number }[] {
  const m = new Map<string, { name: string; count: number }>();
  for (const p of people) {
    const k = norm(p.organization);
    if (!k) continue;
    const e = m.get(k) ?? { name: p.organization!.trim(), count: 0 };
    e.count++;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Recipient sheet with merge fields, ready for a bulk sender or WhatsApp list. */
export function audienceCsv(people: AudiencePerson[]): string {
  const head = ["name", "first_name", "email", "phone", "institution", "delegate_code", "roles", "missing"];
  const rows = people.map((p) => [
    p.full_name, p.full_name.split(" ")[0] ?? "", p.email, p.phone ?? "", p.organization ?? "",
    p.delegate_code, p.roles.join("; "), missingFields(p).join("; "),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
