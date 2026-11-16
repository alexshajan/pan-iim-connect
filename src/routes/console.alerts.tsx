import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { alertStatus, AUDIENCES, KINDS, type AlertRow } from "@/lib/alerts";
import { PageHead } from "./console";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { useConsoleAccess } from "@/components/console/access";
import { alertsNeedApproval } from "@/lib/console-access";
import { notifyAlertApprovers } from "@/lib/emails.functions";
import { ApprovalQueue, ApproverEmails, MyRequests, requestsQuery } from "@/components/console/AlertApprovals";

export const Route = createFileRoute("/console/alerts")({
  validateSearch: (r: Record<string, unknown>): { review?: string | undefined } => ({ review: typeof r["review"] === "string" ? (r["review"] as string) : undefined }),
  component: AlertsPage,
});

const listQuery = {
  queryKey: ["console", "alerts"],
  queryFn: async () => {
    const [a, s] = await Promise.all([
      supabase.from("announcements").select("*").order("published_at", { ascending: false }),
      supabase.from("sessions").select("id,title,starts_at,session_code,room,area,parallel_track,tracks(name),submissions(submission_code,title)").order("starts_at"),
    ]);
    if (a.error) throw a.error;
    return { alerts: (a.data ?? []) as AlertRow[], sessions: s.data ?? [] };
  },
};

const blank = { title: "", body: "", kind: "info", audience: "all", session_id: "", when: "now" as "now" | "later", at: "", ends: "" };

function AlertsPage() {
  const qc = useQueryClient();
  const q = useQuery(listQuery);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const { roles } = useConsoleAccess();
  const needsApproval = alertsNeedApproval(roles);
  const { review } = Route.useSearch();
  const notify = useServerFn(notifyAlertApprovers);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.body.trim()) { toast.error("Add a title and message"); return; }
    if (f.audience === "session" && !f.session_id) { toast.error("Pick the session"); return; }
    setBusy(true);
    if (needsApproval) {
      const { data: req, error: rErr } = await supabase.from("alert_requests").insert({
        title: f.title.trim(), body: f.body.trim(), kind: f.kind, audience: f.audience, urgent: f.kind === "urgent",
        session_id: f.audience === "session" ? f.session_id : null,
        ends_at: f.ends ? new Date(f.ends).toISOString() : null,
      }).select("id").single();
      setBusy(false);
      if (rErr || !req) { toast.error(rErr?.message ?? "Couldn't send for approval"); return; }
      notify({ data: { requestId: req.id, origin: window.location.origin } }).catch(() => undefined);
      toast.success("Sent to organizers for approval");
      setF(blank);
      qc.invalidateQueries({ queryKey: requestsQuery.queryKey });
      return;
    }
    const { error } = await supabase.from("announcements").insert({
      title: f.title.trim(), body: f.body.trim(), kind: f.kind, audience: f.audience, urgent: f.kind === "urgent",
      session_id: f.audience === "session" ? f.session_id : null,
      published_at: f.when === "later" && f.at ? new Date(f.at).toISOString() : new Date().toISOString(),
      ends_at: f.ends ? new Date(f.ends).toISOString() : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(f.when === "later" ? "Alert scheduled" : "Alert sent");
    setF(blank);
    qc.invalidateQueries({ queryKey: listQuery.queryKey });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  async function withdraw(id: string) {
    const { error } = await supabase.from("announcements").update({ withdrawn_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast("Alert withdrawn");
    qc.invalidateQueries({ queryKey: listQuery.queryKey });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  const sessions = q.data?.sessions ?? [];

  return (
    <div>
      <PageHead title="Alerts" />
      {!needsApproval ? <ApprovalQueue focusId={review} /> : null}
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <form onSubmit={send} className="card-surface space-y-3 px-5 py-5">
          <h2 className="flex items-center gap-2 text-sm font-medium"><Megaphone className="size-4" /> New alert</h2>
          <div className="flex flex-wrap gap-1">
            {KINDS.map((k) => (
              <button type="button" key={k.value} onClick={() => setF({ ...f, kind: k.value })}
                className={cn("tap rounded-full border px-3 py-1 text-xs", f.kind === k.value ? (k.value === "urgent" ? "border-destructive bg-destructive text-destructive-foreground" : "border-foreground bg-plate text-plate-foreground") : "border-border text-muted-foreground")}>
                {k.label}
              </button>
            ))}
          </div>
          <input className={input} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <textarea className={input} rows={3} placeholder="Message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <label className="block text-xs text-muted-foreground">Who sees it
            <select className={input} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          {f.audience === "session" && (
            <SessionPicker sessions={sessions} value={f.session_id} onChange={(id) => setF({ ...f, session_id: id })} />
          )}
          <div className="flex gap-2 text-sm">
            {(["now", "later"] as const).map((w) => (
              <label key={w} className="flex items-center gap-1.5"><input type="radio" checked={f.when === w} onChange={() => setF({ ...f, when: w })} />{w === "now" ? "Send now" : "Schedule"}</label>
            ))}
          </div>
          {needsApproval ? null : f.when === "later" && <input type="datetime-local" className={input} value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} />}
          <label className="block text-xs text-muted-foreground">Ends (optional)<input type="datetime-local" className={input} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></label>
          <button disabled={busy} className="tap w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {needsApproval ? "Ask an organizer to send" : f.when === "later" ? "Schedule alert" : "Send alert"}
          </button>
          {f.kind === "urgent" && <p className="text-xs text-muted-foreground">Urgent alerts stay pinned at the top of Home and Agenda until they end or are withdrawn.</p>}
        </form>

        {needsApproval ? (
          <div className="space-y-2"><h2 className="text-sm font-semibold">Your requests</h2><MyRequests /></div>
        ) : (
        <div className="space-y-4">
        <ApproverEmails />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2">Alert</th><th className="px-4 py-2">Who</th><th className="px-4 py-2">When</th><th className="px-4 py-2">Status</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(q.data?.alerts ?? []).map((a) => {
                const st = alertStatus(a);
                return (
                  <tr key={a.id} className={cn(st === "withdrawn" && "opacity-50")}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{a.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{KINDS.find((k) => k.value === a.kind)?.label ?? "Info"}, {a.body}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{AUDIENCES.find((x) => x.value === a.audience)?.label ?? a.audience}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs">{new Date(a.published_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", st === "live" ? (a.urgent ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary") : "bg-muted text-muted-foreground")}>{st}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {(st === "live" || st === "scheduled") && <button onClick={() => withdraw(a.id)} className="tap rounded-lg border border-border px-2 py-1 text-xs">Withdraw</button>}
                    </td>
                  </tr>
                );
              })}
              {!q.data?.alerts.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">No alerts yet</td></tr>}
            </tbody>
          </table>
        </div>
        </div>
        )}
      </div>
    </div>
  );
}

type PickSession = {
  id: string; title: string; starts_at: string; session_code?: string | null; room?: string | null; area?: string | null;
  parallel_track?: string | null; tracks?: { name: string } | null; submissions?: { submission_code: string; title: string | null }[] | null;
};

function SessionPicker({ sessions, value, onChange }: { sessions: PickSession[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = sessions.filter((s) => {
    if (!needle) return true;
    const hay = [s.title, s.session_code, s.room, s.area, s.parallel_track, s.tracks?.name,
      ...(s.submissions ?? []).flatMap((p) => [p.submission_code, p.title])].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(needle);
  }).slice(0, 40);
  const picked = sessions.find((s) => s.id === value);
  const time = (s: PickSession) => new Date(s.starts_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  return (
    <div className="space-y-2">
      <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Search code, paper ID, room, track"
        value={q} onChange={(e) => setQ(e.target.value)} />
      {picked && <p className="text-xs">Picked: <b>{picked.session_code ?? picked.title}</b> {time(picked)}</p>}
      <ul className="max-h-60 overflow-auto rounded-lg border border-border">
        {list.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onChange(s.id)}
              className={cn("w-full px-3 py-2 text-left text-xs hover:bg-muted", value === s.id && "bg-plate text-plate-foreground")}>
              <span className="font-medium">{s.session_code ? `${s.session_code} ` : ""}{s.title}</span>
              <span className="block opacity-70">{time(s)}{s.room ? `, Room ${s.room}` : ""}{s.tracks?.name ? `, ${s.tracks.name}` : ""}{s.submissions?.length ? `, ${s.submissions.length} papers` : ""}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="px-3 py-2 text-xs text-muted-foreground">No match</li>}
      </ul>
    </div>
  );
}
