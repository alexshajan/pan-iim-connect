import { askMergeEmail } from "@/components/console/MergeEmailDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/registry-data";
import { cn } from "@/lib/utils";

type P = { id: string; full_name: string; email: string; alt_email: string | null; delegate_code: string; organization: string | null; user_id: string | null; submission_ref: string | null };
type Sub = { id: string; submission_code: string; title: string | null; presenter_name: string | null; presentation_mode: string; authors: { name: string; org?: string | null }[] | null };
type Claim = {
  id: string; user_id: string; role: string; submission_code: string | null; note: string | null; created_at: string;
  visitor: P | null; sub: Sub | null; candidates: (P & { why: string; presents: boolean })[];
};

const PCOLS = "id, full_name, email, alt_email, delegate_code, organization, user_id, submission_ref";
const norm = (s: string) => s.toLowerCase().replace(/^(dr|prof|mr|ms|mrs|shri)\.?\s+/g, "").replace(/[^a-z ]/g, "").trim();

/** Visitors who signed in with an email we don't know and claim a registered paper. Organizer checks the paper's authors, then merges. */
export function ClaimsQueue() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["registry", "role_claims", "match"],
    queryFn: async (): Promise<Claim[]> => {
      const { data: c, error } = await db.from("role_claims").select("*").eq("status", "open").order("created_at");
      if (error) throw error;
      return Promise.all((c ?? []).map(async (x: Claim) => {
        const { data: v } = await db.from("people").select(PCOLS).eq("user_id", x.user_id).maybeSingle();
        const code = x.submission_code?.trim().replace(/^#/, "") ?? "";
        const { data: sub } = code ? await db.from("submissions").select("id, submission_code, title, presenter_name, presentation_mode, authors").eq("submission_code", code).maybeSingle() : { data: null };
        const found = new Map<string, P & { why: string; presents: boolean }>();
        const add = (rows: P[] | null, why: string) => (rows ?? []).forEach((r) => { if (r.id !== v?.id && !found.has(r.id)) found.set(r.id, { ...r, why, presents: !!sub?.presenter_name && norm(sub.presenter_name) === norm(r.full_name) }); });
        if (sub) {
          const { data: links } = await db.from("submission_people").select(`people(${PCOLS})`).eq("submission_id", sub.id);
          add((links ?? []).map((l: { people: P }) => l.people).filter(Boolean), `Linked to #${code}`);
          const { data: refs } = await db.from("people").select(PCOLS).eq("submission_ref", code);
          add(refs, `Registered for #${code}`);
        }
        const emails = (x.note ?? "").match(/[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}/gi) ?? [];
        for (const e of emails) {
          const { data } = await db.from("people").select(PCOLS).or(`email.ilike.${e},alt_email.ilike.${e}`);
          add(data, `Email in their note`);
        }
        if (v?.full_name && !v.full_name.includes("@")) {
          const { data } = await db.from("people").select(PCOLS).ilike("full_name", `%${v.full_name.split(/\s+/).filter((w: string) => w.length > 2)[0] ?? v.full_name}%`).limit(5);
          add(data, "Similar name");
        }
        const cands = [...found.values()].sort((a, b) => Number(b.presents) - Number(a.presents));
        return { ...x, visitor: v, sub, candidates: cands };
      }));
    },
  });

  const [ask, setAsk] = useState<{ id: string; msg: string; go: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);
  const done = () => { qc.invalidateQueries({ queryKey: ["registry"] }); };

  async function decide(c: Claim, approve: boolean) {
    const { error } = await db.rpc("resolve_role_claim", { _claim: c.id, _approve: approve });
    if (error) throw error;
  }
  const act = (id: string, msg: string, go: () => Promise<void>) => setAsk({ id, msg, go });
  async function run() {
    if (!ask) return;
    setBusy(true);
    try { await ask.go(); done(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't finish that"); }
    finally { setBusy(false); setAsk(null); }
  }

  const list = q.data ?? [];
  if (q.isLoading) return <p className="help-ticket px-4 py-6 text-sm text-muted-foreground">Loading</p>;
  if (!list.length) return <p className="help-ticket px-4 py-6 text-sm text-muted-foreground">No pass claims waiting.</p>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((c) => (
        <article key={c.id} className="help-ticket flex flex-col px-4 py-3.5 text-sm">
          <p className="text-[0.65rem] text-muted-foreground">Signed in with a new email, says they present {c.submission_code ? `#${c.submission_code}` : "a paper (no ID given)"}</p>
          <p className="mt-1 font-medium">{c.visitor?.full_name ?? "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{c.visitor?.email}{c.visitor?.organization ? `, ${c.visitor.organization}` : ""}</p>
          {c.note && <p className="mt-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">"{c.note}"</p>}

          {c.sub ? (
            <div className="mt-2.5 rounded-lg border border-border px-3 py-2">
              <p className="text-xs tabular-nums text-muted-foreground">#{c.sub.submission_code}, {c.sub.presentation_mode === "online" ? "Online" : "In person"}</p>
              <p className="text-sm leading-snug">{c.sub.title}</p>
              <ol className="mt-1 space-y-0.5 text-xs">
                {(c.sub.authors ?? []).map((a, i) => {
                  const pres = !!c.sub?.presenter_name && norm(a.name) === norm(c.sub.presenter_name);
                  return <li key={i} className={cn(pres && "font-semibold text-primary")}>{i + 1}. {a.name}{a.org ? <span className="font-normal text-muted-foreground">, {a.org}</span> : null}{pres ? " (presenting)" : ""}</li>;
                })}
              </ol>
            </div>
          ) : c.submission_code ? <p className="mt-2 text-xs text-destructive">No paper #{c.submission_code} in our records.</p> : null}

          <p className="mt-3 text-[0.65rem] text-muted-foreground">Existing profiles to merge into</p>
          {c.candidates.length ? (
            <ul className="mt-1 space-y-1.5">
              {c.candidates.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                  <span className="min-w-0">
                    <b>{p.full_name}</b>{p.presents && <span className="ml-1 text-primary">presenting</span>}
                    <span className="block text-muted-foreground">{p.delegate_code}, {p.email}{p.user_id ? ", has signed in" : ""} · {p.why}</span>
                  </span>
                  <button type="button" disabled={busy}
                    onClick={() => act(c.id, `Merge ${c.visitor?.full_name} into ${p.full_name} (${p.delegate_code})? ${c.visitor?.email} becomes their second email and they keep code ${p.delegate_code}.`, async () => {
                      if (c.visitor) { const { error } = await db.rpc("merge_people", { _keep: p.id, _drop: c.visitor.id }); if (error) throw error; }
                      await decide(c, true);
                      toast.success("Merged. They can sign in with either email.");
                      if (c.visitor) askMergeEmail(p.id);
                    })}
                    className="tap shrink-0 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground disabled:opacity-50">Merge</button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-xs text-muted-foreground">No matching profile found. Search them in People if you know them.</p>}

          {ask?.id === c.id ? (
            <div className="mt-3 rounded-xl border border-primary/40 bg-card px-3 py-2.5 text-xs">
              <p>{ask.msg}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={run} className="tap rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Working…" : "Yes, go ahead"}</button>
                <button type="button" onClick={() => setAsk(null)} className="tap rounded-full border border-border px-3 py-1">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-auto flex gap-3 pt-3 text-xs">
              <button type="button" onClick={() => act(c.id, `Approve ${c.visitor?.full_name} as a presenter on their own new profile, without merging?`, async () => { await decide(c, true); toast.success("Approved"); })} className="underline">Approve without merge</button>
              <button type="button" onClick={() => act(c.id, `Turn down this claim? They stay on a visitor pass.`, async () => { await decide(c, false); toast("Claim closed"); })} className="text-muted-foreground underline">Reject</button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
