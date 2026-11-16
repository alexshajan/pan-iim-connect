import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  cleanName, KIND_LABEL, latestRequests, matchAuthor, statusText,
  type Author, type DetailKind, type DetailRequest,
} from "@/lib/detail-requests";
import { cn } from "@/lib/utils";

type Paper = { submission_id: string; submission_code: string; title: string | null; presenter_name: string | null; authors: Author[]; my_order: number | null; presenters: string[] | null };
type Me = { full_name: string; email: string; alt_email: string | null; organization: string | null; phone: string | null };

const norm = (n: string) => cleanName(n).toLowerCase().replace(/[^a-z]/g, "");
const SEEN_KEY = (u: string) => `wmc-details-ack:${u}`;

/** Home card: "Are your details right?" Collapsed by default, one-tap confirm, or request a change for organizer review. */
export function MyDetails({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["my-details", userId],
    queryFn: async () => {
      const [me, papers, reqs] = await Promise.all([
        supabase.from("people").select("full_name, email, alt_email, organization, phone").eq("user_id", userId).maybeSingle(),
        supabase.rpc("my_paper_authors"),
        supabase.from("detail_requests").select("id, kind, status, submission_id, author_index, proposed_name, proposed_email, proposed_org, note, decision_note, created_at, decided_at")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      ]);
      const all = (reqs.data ?? []) as unknown as (Omit<DetailRequest, "kind"> & { kind: DetailKind | "confirm" })[];
      return {
        me: (me.data ?? null) as Me | null,
        papers: (papers.data ?? []) as unknown as Paper[],
        confirmed: all.some((r) => r.kind === "confirm" && r.status === "approved"),
        reqs: all.filter((r) => r.kind !== "confirm") as DetailRequest[],
      };
    },
  });
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<null | { kind: DetailKind; paper?: Paper | undefined }>(null);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState<"confirmed" | "sent" | null>(null);
  const [acked, setAcked] = useState(true);
  const [alt, setAlt] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => { setAcked(localStorage.getItem(SEEN_KEY(userId)) === "1"); }, [userId]);

  const me = data.data?.me;
  if (!me) return null;
  const papers = data.data!.papers;
  const reqs = latestRequests(data.data!.reqs);
  const rejected = reqs.filter((r) => r.status === "rejected");
  const pending = reqs.filter((r) => r.status === "pending");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-details", userId] });
    qc.invalidateQueries({ queryKey: ["my-help", userId] });
  };
  const dismissAck = () => { localStorage.setItem(SEEN_KEY(userId), "1"); setAcked(true); setAck(null); };

  // Done: confirmed, or requests sent and none bounced back. Show the receipt once, then step aside.
  const settled = (data.data!.confirmed || reqs.length > 0) && rejected.length === 0;
  if (settled && !open) {
    const kind = ack ?? (!acked ? (data.data!.confirmed && !pending.length ? "confirmed" : "sent") : null);
    if (!kind) return null;
    return (
      <div role="status" className="details-receipt rise flex items-center gap-3 px-4 py-3">
        <span className="details-check grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="details-check-path" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{kind === "confirmed" ? "Details confirmed" : "Sent for review"}</span>
          <span className="block text-xs text-muted-foreground">{kind === "confirmed" ? "Thanks. Your ticket is in Help desk below." : "Track it in Help desk below. We'll tell you once it's done."}</span>
        </span>
        <button type="button" onClick={dismissAck} className="tap rounded-full px-3 py-1.5 text-xs font-semibold text-primary">Done</button>
      </div>
    );
  }

  async function confirm() {
    setBusy(true);
    const { error } = await supabase.rpc("confirm_my_details", { _alt_email: alt.trim(), _phone: phone.trim() });
    setBusy(false);
    if (error) { toast.error(error.message.replace(/^.*?:\s*/, "") || "Couldn't save. Check your connection and try again."); return; }
    navigator.vibrate?.(12);
    localStorage.removeItem(SEEN_KEY(userId)); setAcked(false);
    setAck("confirmed"); setExpanded(false); refresh();
  }

  return (
    <section className={cn("details-sheet rise overflow-hidden", expanded && "is-open")} aria-label="Check your details">
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
        className="tap flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="details-dot relative grid size-9 shrink-0 place-items-center rounded-full bg-warn/30 text-sm font-bold text-warn-foreground" aria-hidden>!</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-semibold leading-tight">{rejected.length ? "One change needs another look" : "Check your card details"}</span>
          <span className="block truncate text-xs text-muted-foreground">{cleanName(me.full_name)}{me.organization ? `, ${me.organization}` : ""}</span>
        </span>
        <svg viewBox="0 0 24 24" className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", expanded && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      <div className="details-body grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 px-4 pb-4">
            <div className="details-group divide-y divide-border/70">
              <Field k="Name">{cleanName(me.full_name)}</Field>
              <Field k="Affiliation">{me.organization || <span className="text-muted-foreground">Not on file</span>}</Field>
              <Field k="Email">{me.email}{me.alt_email ? <span className="block text-xs text-muted-foreground">{me.alt_email}</span> : null}</Field>
            </div>

            {papers.map((p) => {
              const coming = new Set((p.presenters ?? []).map(norm));
              return (
                <div key={p.submission_id} className="details-group px-3.5 py-3">
                  <p className="text-xs text-muted-foreground tabular-nums">Paper {p.submission_code}</p>
                  <p className="mt-0.5 text-sm font-semibold leading-snug">{p.title}</p>
                  <ol className="mt-2.5 space-y-1.5">
                    {p.authors.map((a, i) => {
                      const on = coming.has(norm(a.name));
                      return (
                        <li key={i} className="flex items-center gap-2.5 text-sm">
                          <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem] tabular-nums", on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate">{cleanName(a.name)}</span>
                          <span className={cn("shrink-0 text-[0.7rem] font-semibold", on ? "text-primary" : "text-muted-foreground")}>{on ? "Presenting" : "Not attending"}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}

            {rejected.map((r) => (
              <RequestCard key={r.id} r={r} paper={papers.find((p) => p.submission_id === r.submission_id)}
                onRetry={() => setOpen({ kind: r.kind, paper: papers.find((p) => p.submission_id === r.submission_id) })}
                onWithdraw={async () => { await supabase.rpc("withdraw_detail_change", { _id: r.id }); refresh(); }} />
            ))}

            {open ? (
              <RequestForm me={me} kind={open.kind} paper={open.paper}
                onDone={() => { setOpen(null); localStorage.removeItem(SEEN_KEY(userId)); setAcked(false); setAck("sent"); refresh(); }}
                onCancel={() => setOpen(null)} />
            ) : (
              <>
                <div className="details-group divide-y divide-border/70">
                  {!me.alt_email ? (
                    <label className="flex items-center gap-3 px-3.5 py-2 text-sm">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground">2nd email</span>
                      <input type="email" inputMode="email" autoComplete="email" value={alt} onChange={(e) => setAlt(e.target.value)}
                        placeholder="Optional, e.g. personal Gmail" className="min-w-0 flex-1 bg-transparent py-1 outline-none placeholder:text-muted-foreground/70" />
                    </label>
                  ) : null}
                  <label className="flex items-center gap-3 px-3.5 py-2 text-sm">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">Phone</span>
                    <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder={me.phone ? me.phone : "Optional, for event-day help"} className="min-w-0 flex-1 bg-transparent py-1 tabular-nums outline-none placeholder:text-muted-foreground/70" />
                  </label>
                </div>
                <p className="-mt-1 px-1 text-[0.7rem] text-muted-foreground">Only organizers see your phone. The second email lets you sign in with either.</p>
                <button type="button" onClick={confirm} disabled={busy}
                  className="tap btn-sheen details-cta w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {busy ? "Saving" : "All correct"}
                </button>
                <div>
                  <p className="px-1 pb-1.5 text-xs text-muted-foreground">Something off?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {papers.map((p) => (
                      <Chip key={p.submission_id} onClick={() => setOpen({ kind: "presenter", paper: p })}>
                        {papers.length > 1 ? `Who presents ${p.submission_code}?` : "Pick who presents"}
                      </Chip>
                    ))}
                    <Chip onClick={() => setOpen({ kind: "name" })}>Fix my name</Chip>
                    <Chip onClick={() => setOpen({ kind: "affiliation" })}>Update affiliation</Chip>
                    {!me.alt_email ? <Chip onClick={() => setOpen({ kind: "email" })}>Add a second email</Chip> : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 px-3.5 py-2.5 text-sm">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

function RequestForm({ me, kind, paper, onDone, onCancel }: { me: Me; kind: DetailKind; paper?: Paper | undefined; onDone: () => void; onCancel: () => void }) {
  const guess = paper ? matchAuthor(me.full_name, paper.authors) : null;
  const [pick, setPick] = useState<number | null>(guess);
  const [name, setName] = useState(me.full_name);
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = kind === "presenter" ? !!pick : kind === "name" ? name.trim().length > 1 && name.trim() !== me.full_name
    : kind === "affiliation" ? org.trim().length > 1 && org.trim() !== (me.organization ?? "") : /\S+@\S+\.\S+/.test(email);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = kind === "affiliation"
      ? await supabase.rpc("request_affiliation_change", { _org: org, _note: note })
      : await supabase.rpc("request_detail_change", {
          _kind: kind, _submission: paper?.submission_id ?? null, _author_index: pick, _name: name, _email: email, _note: note,
        } as never);
    setBusy(false);
    if (error) { toast.error(error.message.replace(/^.*?:\s*/, "") || "Couldn't send. Try again."); return; }
    toast.success("Sent. You'll see it here once it's approved.");
    onDone();
  }

  return (
    <form onSubmit={send} className="help-ticket animate-in fade-in slide-in-from-bottom-1 px-4 py-4">
      <p className="text-display text-[1rem]">{KIND_LABEL[kind]}</p>
      {kind === "presenter" && paper ? (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{paper.title}</p>
          <p className="mt-3 text-xs text-muted-foreground">Tap the author who is coming to present.</p>
          <div className="mt-1.5 space-y-1.5">
            {paper.authors.map((a, i) => (
              <button type="button" key={i} onClick={() => setPick(i + 1)}
                className={cn("tap flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition",
                  pick === i + 1 ? "border-primary bg-primary/10 shadow-[var(--shadow-emboss)]" : "border-border bg-background/60")}>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums", pick === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary")}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block">{cleanName(a.name)}</span>
                  {a.org ? <span className="block truncate text-xs text-muted-foreground">{a.org}</span> : null}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Name spelled differently? Pick the closest one, then use "Fix my name".</p>
        </>
      ) : kind === "name" ? (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">As it should print on your card. No Dr. or Prof. needed.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="mt-3 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm" />
        </>
      ) : kind === "affiliation" ? (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">Your institution, as you'd write it. We'll match it to the standard name used on cards.</p>
          <input value={org} onChange={(e) => setOrg(e.target.value)} maxLength={200} placeholder={me.organization ?? "e.g. IIM Shillong"} className="mt-3 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm" />
        </>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">Useful if your institute mail is slow or you registered with a typo. You can then sign in with either.</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-3 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm" />
        </>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything we should know? (optional)" className="mt-2 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm" />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="tap rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={busy || !ready} className="tap btn-sheen flex-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Sending" : "Send for approval"}
        </button>
      </div>
    </form>
  );
}

function RequestCard({ r, paper, onRetry, onWithdraw }: { r: DetailRequest; paper?: Paper | undefined; onRetry: () => void; onWithdraw: () => void }) {
  const what = r.kind === "email" ? r.proposed_email : r.kind === "affiliation" ? r.proposed_org : r.proposed_name ? cleanName(r.proposed_name) : "";
  return (
    <article className={cn("help-ticket px-4 py-3", r.status === "approved" && "opacity-80")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{KIND_LABEL[r.kind]}{paper ? `, paper ${paper.submission_code}` : ""}</p>
          <p className="mt-0.5 text-sm">{what}</p>
        </div>
        <span className={cn("ticket-stamp shrink-0", r.status === "approved" ? "text-primary" : r.status === "rejected" ? "text-destructive" : "text-muted-foreground")}>{statusText(r)}</span>
      </div>
      {r.status === "rejected" ? (
        <div className="mt-2 rounded-md bg-secondary px-3 py-2 text-sm">
          <p>{r.decision_note || "We couldn't match this to our records."}</p>
          <p className="mt-1 text-xs text-muted-foreground">No problem. Check the details and send again, or ask the help desk.</p>
          <button onClick={onRetry} className="tap mt-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Try again</button>
        </div>
      ) : r.status === "pending" ? (
        <button onClick={onWithdraw} className="tap mt-1 rounded-full px-0 py-1 text-xs text-muted-foreground">Withdraw</button>
      ) : r.decision_note ? <p className="mt-2 text-xs text-muted-foreground">{r.decision_note}</p> : null}
    </article>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="tap rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs transition hover:border-primary">{children}</button>;
}
