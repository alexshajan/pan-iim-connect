import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AUDIENCES } from "@/lib/alerts";
import { cn } from "@/lib/utils";

type Req = {
  id: string; title: string; body: string; audience: string; kind: string; status: string;
  requested_by: string; decided_at: string | null; decision_note: string | null; created_at: string;
};

export const requestsQuery = {
  queryKey: ["console", "alert-requests"],
  queryFn: async () => {
    const { data, error } = await supabase.from("alert_requests").select("*").order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return (data ?? []) as Req[];
  },
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Organizer queue: edit, approve or reject volunteer alerts. Shows clearly when someone else already decided. */
export function ApprovalQueue({ focusId }: { focusId?: string | undefined }) {
  const q = useQuery({ ...requestsQuery, refetchInterval: 20_000 });
  const pending = (q.data ?? []).filter((r) => r.status === "pending");
  const focused = focusId ? (q.data ?? []).find((r) => r.id === focusId) : undefined;
  if (!pending.length && !focused) return null;
  return (
    <section className="card-surface mb-6 px-5 py-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" /> Waiting for approval ({pending.length})</h2>
      {focused && focused.status !== "pending" ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
          &ldquo;{focused.title}&rdquo; was already {focused.status} {focused.decided_at ? `on ${fmt(focused.decided_at)}` : ""}. Nothing more to do.
        </p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {pending.map((r) => <RequestCard key={r.id} r={r} highlight={r.id === focusId} />)}
      </ul>
    </section>
  );
}

function RequestCard({ r, highlight }: { r: Req; highlight: boolean }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(r.title);
  const [body, setBody] = useState(r.body);
  const [busy, setBusy] = useState(false);
  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = await supabase.rpc("decide_alert_request", { _id: r.id, _approve: approve, _title: title, _body: body, _note: "" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { already: boolean; status: string; by?: string; at?: string };
    if (res.already) toast(`Already ${res.status}${res.by ? ` by ${res.by}` : ""}${res.at ? `, ${fmt(res.at)}` : ""}`);
    else toast.success(approve ? "Approved and sent" : "Rejected");
    qc.invalidateQueries({ queryKey: requestsQuery.queryKey });
    qc.invalidateQueries({ queryKey: ["console", "alerts"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <li className={cn("space-y-2 rounded-lg border border-border p-3", highlight && "ring-2 ring-primary")}>
      <p className="text-xs text-muted-foreground">{AUDIENCES.find((a) => a.value === r.audience)?.label ?? r.audience}, asked {fmt(r.created_at)}</p>
      <input className={cn(input, "font-medium")} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <textarea className={input} rows={2} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => decide(true)} className="tap inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"><Check className="size-4" /> Approve and send</button>
        <button disabled={busy} onClick={() => decide(false)} className="tap inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"><X className="size-4" /> Reject</button>
      </div>
    </li>
  );
}

/** A volunteer's own requests and where each stands. */
export function MyRequests() {
  const q = useQuery({ ...requestsQuery, refetchInterval: 30_000 });
  const rows = q.data ?? [];
  if (!rows.length) return <p className="text-sm text-muted-foreground">No requests yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{r.title}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{r.body}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", r.status === "approved" ? "bg-primary/15 text-primary" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>
            {r.status === "pending" ? "Waiting" : r.status === "approved" ? "Sent" : "Rejected"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Organizers set who gets approval emails. */
export function ApproverEmails() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["console", "alert-pocs"],
    queryFn: async () => {
      const { data } = await supabase.from("console_settings").select("value").eq("key", "alert_pocs").maybeSingle();
      return ((data?.value as string[] | null) ?? []).join(", ");
    },
  });
  const [v, setV] = useState<string | null>(null);
  const value = v ?? q.data ?? "";
  async function save() {
    const list = value.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    const { error } = await supabase.from("console_settings").upsert({ key: "alert_pocs", value: list });
    if (error) { toast.error(error.message); return; }
    toast.success(`${list.length} approver${list.length === 1 ? "" : "s"} saved`);
    setV(null);
    qc.invalidateQueries({ queryKey: ["console", "alert-pocs"] });
  }
  return (
    <div className="card-flat space-y-2 px-4 py-3">
      <label className="block text-xs text-muted-foreground">Approvers, emailed when a volunteer asks to send an alert
        <input className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="name@iimshillong.ac.in, ..." value={value} onChange={(e) => setV(e.target.value)} />
      </label>
      <button onClick={save} className="tap rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Save approvers</button>
    </div>
  );
}
