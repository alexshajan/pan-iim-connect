/** Pure helpers for turning registration sheets into people, submissions and review items. */

export type RawRow = Record<string, unknown>;

export type ColumnMap = {
  name: string;
  email: string;
  phone: string;
  presenter: string;
  address: string;
  organization: string;
  category: string;
  submission1: string;
  submission2: string;
  payment: string;
};

export const DEFAULT_MAP: ColumnMap = {
  name: "Name of presenter/payer",
  email: "Email",
  phone: "Phone No.",
  presenter: "Presenting author if not the payer",
  address: "Address",
  organization: "Organization",
  category: "Type",
  submission1: "Submission ID",
  submission2: "Submission ID 2 need to pay again",
  payment: "",
};

export const KNOWN_CATEGORIES = [
  "Academics & Faculty",
  "Research Scholars",
  "Industry Professionals",
  "Attendees (Non- Presenters)",
  "International Presenter (USD)",
];

const str = (v: unknown) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

export function normEmail(v: unknown) {
  return str(v).toLowerCase().replace(/\s/g, "");
}

export function isValidEmail(e: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

/** Indian 10-digit mobiles get +91; existing country codes are kept. Returns null if unusable. */
export function normPhone(v: unknown): string | null {
  const raw = str(v);
  if (!raw) return null;
  let digits = raw.replace(/\.0+$/, "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.length >= 9 ? digits : null;
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

export function normSubmissionId(v: unknown): string | null {
  const s = str(v).replace(/\.0+$/, "");
  return s ? s : null;
}

export function normName(v: unknown) {
  return str(v)
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/g, "")
    .replace(/[^a-z ]/g, "");
}

export function titleCaseName(v: unknown) {
  const s = str(v);
  if (s && s === s.toUpperCase()) return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return s;
}

export type ParsedPerson = {
  email: string;
  full_name: string;
  phone: string | null;
  organization: string | null;
  address: string | null;
  category: string | null;
};

export type ParsedRegistration = {
  email: string;
  source_row: number;
  payment_status: string | null;
  raw: RawRow;
};

export type ParsedSubmission = {
  submission_code: string;
  presenter_name: string | null;
  payment_status: string | null;
  payer_email: string;
};

export type Issue = { row: number; kind: string; message: string };

export type Duplicate = { kind: "same_name_org" | "same_phone"; emails: string[]; label: string };

export type ParsedImport = {
  people: ParsedPerson[];
  registrations: ParsedRegistration[];
  submissions: ParsedSubmission[];
  issues: Issue[];
  duplicates: Duplicate[];
};

export function parseRows(rows: RawRow[], map: ColumnMap = DEFAULT_MAP): ParsedImport {
  const people = new Map<string, ParsedPerson>();
  const registrations: ParsedRegistration[] = [];
  const submissions = new Map<string, ParsedSubmission>();
  const issues: Issue[] = [];

  rows.forEach((row, i) => {
    const line = i + 2;
    const email = normEmail(row[map.email]);
    const name = titleCaseName(row[map.name]);
    if (!email || !isValidEmail(email)) {
      issues.push({ row: line, kind: "missing_email", message: `No usable email for "${name || "unnamed"}"` });
      return;
    }
    const phone = normPhone(row[map.phone]);
    if (str(row[map.phone]) && !phone)
      issues.push({ row: line, kind: "bad_phone", message: `Phone "${str(row[map.phone])}" looks wrong` });
    const category = str(row[map.category]) || null;
    if (category && !KNOWN_CATEGORIES.includes(category))
      issues.push({ row: line, kind: "unknown_category", message: `Unknown category "${category}"` });

    const existing = people.get(email);
    people.set(email, {
      email,
      full_name: existing?.full_name || name || email,
      phone: existing?.phone ?? phone,
      organization: existing?.organization ?? (str(row[map.organization]) || null),
      address: existing?.address ?? (str(row[map.address]) || null),
      category: existing?.category ?? category,
    });

    const payment = map.payment ? str(row[map.payment]) || null : "paid";
    registrations.push({ email, source_row: line, payment_status: payment, raw: row });

    const presenterRaw = str(row[map.presenter]);
    const presenter = presenterRaw && normName(presenterRaw) !== normName(name) ? titleCaseName(presenterRaw) : null;
    [row[map.submission1], row[map.submission2]].forEach((v) => {
      const code = normSubmissionId(v);
      if (!code) return;
      const prev = submissions.get(code);
      if (prev && prev.payer_email !== email) {
        issues.push({
          row: line,
          kind: "duplicate_submission",
          message: `Submission ${code} also paid by ${prev.payer_email}`,
        });
      }
      if (!prev) submissions.set(code, { submission_code: code, presenter_name: presenter, payment_status: payment, payer_email: email });
    });
  });

  const list = [...people.values()];
  return {
    people: list,
    registrations,
    submissions: [...submissions.values()],
    issues,
    duplicates: findDuplicates(list),
  };
}

export function findDuplicates(people: ParsedPerson[]): Duplicate[] {
  const out: Duplicate[] = [];
  const group = (key: (p: ParsedPerson) => string | null, kind: Duplicate["kind"]) => {
    const m = new Map<string, ParsedPerson[]>();
    people.forEach((p) => {
      const k = key(p);
      if (!k) return;
      m.set(k, [...(m.get(k) ?? []), p]);
    });
    m.forEach((ps) => {
      if (ps.length > 1) out.push({ kind, emails: ps.map((p) => p.email), label: ps[0]!.full_name });
    });
  };
  group((p) => {
    const n = normName(p.full_name);
    return n ? `${n}|${normName(p.organization)}` : null;
  }, "same_name_org");
  group((p) => p.phone, "same_phone");
  return out;
}
