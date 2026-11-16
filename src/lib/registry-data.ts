import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ParsedImport } from "@/lib/registry";

// The registry tables are added by a staged schema change; generated types arrive after it applies.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export type Person = {
  id: string;
  delegate_code: string;
  email: string;
  alt_email?: string | null;
  full_name: string;
  phone: string | null;
  organization: string | null;
  address: string | null;
  category: string | null;
  user_id: string | null;
  consent_networking: boolean;
  consent_photo: boolean;
  consent_whatsapp: boolean;
  consent_calls: boolean;
  notes: string | null;
  directory_opt_in?: boolean;
  linkedin_url?: string | null;
  is_placeholder: boolean;
  card_role?: string | null;
  attendance_mode?: string | null;
  submission_ref?: string | null;
  person_roles?: { role: string }[];
  accommodations?: { residence: string; room_no: string | null }[];
};

export type Submission = {
  id: string;
  submission_code: string;
  title: string | null;
  track: string | null;
  presenter_name: string | null;
  payment_status: string | null;
  session_id: string | null;
  is_placeholder: boolean;
  submission_people?: { id: string; role: string; people: { id: string; full_name: string; email: string } | null }[];
};

const one = async <T,>(p: Promise<{ data: T; error: unknown }>) => {
  const { data, error } = await p;
  if (error) throw error;
  return data;
};

export const ROLES = ["presenter", "author", "reviewer", "track_chair", "keynote", "volunteer", "organizer", "delegate", "steering_committee", "co_convener", "convener"];

export const peopleQuery = queryOptions({
  queryKey: ["registry", "people"],
  queryFn: () =>
    allPages<Person>((from, to) =>
      db
        .from("people")
        .select("*, person_roles(role), accommodations(residence, room_no)")
        .order("full_name")
        .order("id")
        .range(from, to),
    ),
});

/** Reads every row; the API returns at most 1,000 rows per request. */
async function allPages<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

export const directoryQuery = queryOptions({
  queryKey: ["registry", "directory"],
  queryFn: () => one<Person[]>(db.from("people_directory").select("*").order("full_name")),
});

export const submissionsQuery = queryOptions({
  queryKey: ["registry", "submissions"],
  queryFn: () =>
    one<Submission[]>(
      db
        .from("submissions")
        .select("*, submission_people(id, role, people(id, full_name, email))")
        .order("submission_code"),
    ),
});

export const batchesQuery = queryOptions({
  queryKey: ["registry", "batches"],
  queryFn: () => one<{ id: string; file_name: string; row_count: number; summary: Record<string, number>; created_at: string; rolled_back_at: string | null }[]>(
    db.from("import_batches").select("*").order("created_at", { ascending: false }),
  ),
});

export const reviewQuery = queryOptions({
  queryKey: ["registry", "review"],
  queryFn: () =>
    one<{ id: string; kind: string; status: string; person_ids: string[]; detail: Record<string, unknown>; created_at: string }[]>(
      db.from("review_items").select("*").eq("status", "open").order("created_at"),
    ),
});

export const auditQuery = queryOptions({
  queryKey: ["registry", "audit"],
  queryFn: () =>
    one<{ id: string; table_name: string; action: string; at: string; actor: string | null }[]>(
      db.from("audit_log").select("id, table_name, action, at, actor").order("at", { ascending: false }).limit(20),
    ),
});

export const myPersonQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["registry", "me", userId],
    enabled: !!userId,
    queryFn: async () => {
      await db.rpc("claim_my_person");
      const person = await one<Person | null>(
        db.from("people").select("*, person_roles(role), accommodations(residence, room_no)").eq("user_id", userId).maybeSingle(),
      );
      if (!person) return null;
      const subs = await one<{ role: string; submissions: { submission_code: string; title: string | null; track: string | null; session_id: string | null; presentation_mode: string | null } | null }[]>(
        db.from("submission_people").select("role, submissions(submission_code, title, track, session_id, presentation_mode)").eq("person_id", person.id),
      );
      return { person, subs };
    },
  });

const chunk = <T,>(a: T[], n = 400) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Writes a parsed sheet: new people insert, known emails update, submissions upsert by ID. */
export async function commitImport(fileName: string, parsed: ParsedImport) {
  const batch = await one<{ id: string }>(
    db
      .from("import_batches")
      .insert({
        file_name: fileName,
        row_count: parsed.registrations.length,
        summary: {
          people: parsed.people.length,
          submissions: parsed.submissions.length,
          issues: parsed.issues.length,
          duplicates: parsed.duplicates.length,
        },
      })
      .select("id")
      .single(),
  );

  const existing = new Set<string>();
  for (const c of chunk(parsed.people.map((p) => p.email))) {
    const rows = await one<{ email: string }[]>(db.from("people").select("email").in("email", c));
    rows.forEach((r) => existing.add(r.email));
  }
  const fresh = parsed.people.filter((p) => !existing.has(p.email)).map((p) => ({ ...p, created_batch_id: batch.id }));
  const known = parsed.people.filter((p) => existing.has(p.email));
  for (const c of chunk(fresh)) await one(db.from("people").insert(c));
  for (const c of chunk(known)) await one(db.from("people").upsert(c, { onConflict: "email" }));

  const ids = new Map<string, string>();
  for (const c of chunk(parsed.people.map((p) => p.email))) {
    const rows = await one<{ id: string; email: string }[]>(db.from("people").select("id, email").in("email", c));
    rows.forEach((r) => ids.set(r.email, r.id));
  }

  for (const c of chunk(parsed.registrations))
    await one(
      db.from("registrations").insert(
        c.map((r) => ({ batch_id: batch.id, person_id: ids.get(r.email), source_row: r.source_row, payment_status: r.payment_status, raw: r.raw })),
      ),
    );

  const existingSubs = new Set<string>();
  for (const c of chunk(parsed.submissions.map((s) => s.submission_code))) {
    const rows = await one<{ submission_code: string }[]>(db.from("submissions").select("submission_code").in("submission_code", c));
    rows.forEach((r) => existingSubs.add(r.submission_code));
  }
  const subRow = (s: ParsedImport["submissions"][number]) => ({
    submission_code: s.submission_code,
    presenter_name: s.presenter_name,
    payment_status: s.payment_status,
  });
  const newSubs = parsed.submissions.filter((s) => !existingSubs.has(s.submission_code));
  for (const c of chunk(newSubs)) await one(db.from("submissions").insert(c.map((s) => ({ ...subRow(s), created_batch_id: batch.id }))));
  for (const c of chunk(parsed.submissions.filter((s) => existingSubs.has(s.submission_code))))
    await one(db.from("submissions").upsert(c.map(subRow), { onConflict: "submission_code" }));

  const subIds = new Map<string, string>();
  for (const c of chunk(parsed.submissions.map((s) => s.submission_code))) {
    const rows = await one<{ id: string; submission_code: string }[]>(db.from("submissions").select("id, submission_code").in("submission_code", c));
    rows.forEach((r) => subIds.set(r.submission_code, r.id));
  }
  const links = parsed.submissions.map((s) => ({
    submission_id: subIds.get(s.submission_code),
    person_id: ids.get(s.payer_email),
    role: s.presenter_name ? "payer" : "presenter",
  }));
  for (const c of chunk(links))
    await one(db.from("submission_people").upsert(c, { onConflict: "submission_id,person_id,role", ignoreDuplicates: true }));

  const review = [
    ...parsed.duplicates.map((d) => ({
      kind: d.kind,
      batch_id: batch.id,
      person_ids: d.emails.map((e) => ids.get(e)).filter(Boolean),
      detail: { label: d.label, emails: d.emails },
    })),
    ...parsed.issues
      .filter((i) => i.kind !== "unknown_category")
      .map((i) => ({ kind: i.kind, batch_id: batch.id, detail: { row: i.row, message: i.message } })),
  ];
  for (const c of chunk(review)) await one(db.from("review_items").insert(c));
  return batch.id;
}
