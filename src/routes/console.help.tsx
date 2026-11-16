import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/registry-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { categoryLabel, HELP_CATEGORIES, isUrgent, sortQueue, statusLabel, waitedFor } from "@/lib/help-desk";
import { cn } from "@/lib/utils";
import { PageHead, useConsoleAccess } from "./console";
import { DetailQueue } from "@/components/console/DetailQueue";
import { ClaimsQueue } from "@/components/console/ClaimsQueue";

export const Route = createFileRoute("/console/help")({ component: Help });

type PersonInfo = {
  code: string; full_name: string; organization: string | null; email: string; phone: string | null; category: string | null;
  roles: string[]; stay: string | null; papers: { code: string; title: string | null; session_id: string | null }[];
  checked_in: boolean; past_requests: number;
};
type Req = {
  id: string; user_id: string | null; name: string | null; contact: string | null; category: string; message: string;
  location: string | null; urgent: boolean; status: string; created_at: string; resolved_at: string | null;
  assigned_to: string | null; resolution_note: string | null; person: PersonInfo | null;
};

const REPLIES = ["Sorted at the desk.", "Please come to the help desk near registration.", "A volunteer is on the way.", "Passed to the organising team, they'll contact you."];

function Help() {
  const { userId } = useConsoleAccess();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "mine" | "resolved" | "details" | "claims">("open");
  const [cat, setCat] = useState("all");
  const q = useQuery({
    queryKey: ["help"],
    queryFn: async () => {
      const { data, error } = await db.rpc("help_queue");
      if (error) throw error;
      return data as unknown as Req[];
    },
    refetchInterval: 15000,
  });
  const all = q.data ?? [];
  const list = useMemo(() => sortQueue(all.filter((r) =>
    (cat === "all" || r.category === cat) &&
    (tab === "resolved" ? r.status === "resolved" : tab === "mine" ? r.assigned_to === userId && r.status !== "resolved" : r.status !== "resolved"),
  )), [all, tab, cat, userId]);
  const waiting = all.filter((r) => r.status === "open");
  const urgent = waiting.filter(isUrgent).length;
  const oldest = waiting.reduce<string | null>((m, r) => (!m || r.created_at < m ? r.created_at : m), null);

  async function update(r: Req, patch: Record<string, unknown>) {
    const { error } = await db.from("help_requests").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["help"] });
  }

  return (
    <>
      <PageHead eyebrow="On-site" title="Help desk">
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          {(["open", "mine", "resolved", "details", "claims"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`tap rounded-full px-3 py-1 capitalize ${tab === t ? "bg-plate text-plate-foreground" : ""}`}>{t === "resolved" ? "Sorted" : t === "details" ? "Card details" : t === "claims" ? "Pass claims" : t}</button>
          ))}
        </div>
      </PageHead>

      {tab === "details" ? <DetailQueue /> : tab === "claims" ? <ClaimsQueue /> : <>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Gauge label="Waiting" value={String(waiting.length)} />
        <Gauge label="Urgent" value={String(urgent)} hot={urgent > 0} />
        <Gauge label="Longest wait" value={oldest ? waitedFor(oldest) : "none"} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {[{ value: "all", label: "All" }, ...HELP_CATEGORIES].map((c) => (
          <button key={c.value} onClick={() => setCat(c.value)} className={cn("tap rounded-md border px-2.5 py-1 text-xs", cat === c.value ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{c.label}</button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((r) => <TicketRow key={r.id} r={r} me={userId} onUpdate={update} />)}
      </div>
      {!list.length && <p className="help-ticket px-4 py-6 text-sm text-muted-foreground">{q.isLoading ? "Loading" : q.error ? "Couldn't load the queue." : "Nothing here. Nice."}</p>}
      </>}
    </>
  );
}

function Gauge({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="help-ticket px-3 py-2.5">
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
      <p className={cn("text-display text-lg tabular-nums", hot && "text-destructive")}>{value}</p>
    </div>
  );
}

function TicketRow({ r, me, onUpdate }: { r: Req; me: string | null; onUpdate: (r: Req, p: Record<string, unknown>) => void }) {
  const [note, setNote] = useState(r.resolution_note ?? "");
  const [closing, setClosing] = useState(false);
  const resolved = r.status === "resolved";
  const who = r.person?.full_name ?? r.name ?? "Guest without a pass";
  const urgent = isUrgent(r);

  return (
    <article className={cn("help-ticket flex flex-col overflow-hidden", urgent && !resolved && "ring-1 ring-destructive/50")}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <PersonChip r={r} who={who} />
        <span className={cn("ticket-stamp shrink-0", resolved ? "text-primary" : urgent ? "text-destructive" : "text-muted-foreground")}>
          {urgent && !resolved ? "Urgent" : statusLabel(r.status)}
        </span>
      </div>
      <p className="mt-2 px-4 text-xs text-muted-foreground tabular-nums">
        {categoryLabel(r.category)}, {waitedFor(r.created_at)} ago{r.location ? `, at ${r.location}` : ""}
        {r.assigned_to ? `, ${r.assigned_to === me ? "with you" : "taken"}` : ""}
      </p>
      <p className="mt-1 flex-1 whitespace-pre-line px-4 text-sm">{r.message}</p>
      {resolved && r.resolution_note ? <p className="mx-4 mt-2 rounded-md bg-secondary px-3 py-2 text-xs">Reply: {r.resolution_note}</p> : null}

      {closing ? (
        <div className="px-4 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {REPLIES.map((t) => <button key={t} onClick={() => setNote(t)} className="tap rounded-md border border-border px-2 py-1 text-[0.7rem]">{t}</button>)}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Reply the guest will see" className="mt-2 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm" />
        </div>
      ) : null}

      <div className="ticket-perf mt-3" />
      <div className="flex flex-wrap justify-end gap-2 px-4 py-2.5">
        {!resolved && r.assigned_to !== me && !closing ? (
          <button onClick={() => onUpdate(r, { assigned_to: me, status: "in_progress" })} className="tap rounded-md border border-border px-3 py-1.5 text-xs">Take it</button>
        ) : null}
        {resolved ? (
          <button onClick={() => onUpdate(r, { status: "open", resolved_at: null })} className="tap rounded-md border border-border px-3 py-1.5 text-xs">Reopen</button>
        ) : closing ? (
          <>
            <button onClick={() => setClosing(false)} className="tap rounded-md px-3 py-1.5 text-xs text-muted-foreground">Back</button>
            <button onClick={() => { onUpdate(r, { status: "resolved", resolved_at: new Date().toISOString(), resolution_note: note.trim() || null, assigned_to: r.assigned_to ?? me }); setClosing(false); }}
              className="tap rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Mark sorted and tell them</button>
          </>
        ) : (
          <button onClick={() => setClosing(true)} className="tap rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Resolve</button>
        )}
      </div>
    </article>
  );
}

function PersonChip({ r, who }: { r: Req; who: string }) {
  const p = r.person;
  const initials = who.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  if (!p) return (
    <div className="min-w-0">
      <p className="text-sm font-semibold">{who}</p>
      {r.contact ? <p className="text-xs text-muted-foreground">{r.contact}</p> : <p className="text-xs text-muted-foreground">Not linked to a registration</p>}
    </div>
  );
  return (
    <Popover>
      <PopoverTrigger className="tap flex min-w-0 items-center gap-2.5 rounded-md text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-[var(--shadow-emboss)]">{initials}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold underline decoration-border underline-offset-4">{who}</span>
          <span className="block truncate text-xs text-muted-foreground">{p.organization ?? p.code}</span>
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 border-border/60 bg-card/85 p-0 backdrop-blur-xl">
        <div className="px-4 pb-3 pt-4">
          <p className="text-display text-base">{p.full_name}</p>
          <p className="text-xs text-muted-foreground">{[p.organization, p.code].filter(Boolean).join(", ")}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(p.roles.length ? p.roles : [p.category ?? "delegate"]).map((x) => <span key={x} className="chip capitalize">{x.replace(/_/g, " ")}</span>)}
            <span className="chip">{p.checked_in ? "Checked in" : "Not checked in"}</span>
          </div>
        </div>
        <div className="ticket-perf" />
        <dl className="space-y-1.5 px-4 py-3 text-xs">
          <Line k="Email"><a className="text-primary" href={`mailto:${p.email}`}>{p.email}</a></Line>
          {p.phone ? <Line k="Phone"><a className="text-primary" href={`tel:${p.phone}`}>{p.phone}</a></Line> : null}
          {p.stay ? <Line k="Stay">{p.stay}</Line> : null}
          {p.papers.slice(0, 3).map((x) => (
            <Line key={x.code} k={`Paper ${x.code}`}>
              {x.session_id ? <Link to="/session/$sessionId" params={{ sessionId: x.session_id }} className="text-primary">{x.title ?? "Open slot"}</Link> : x.title}
            </Line>
          ))}
          {p.past_requests ? <Line k="Earlier">{p.past_requests} other request{p.past_requests > 1 ? "s" : ""}</Line> : null}
        </dl>
        <div className="flex gap-2 border-t border-border/60 px-4 py-2.5">
          <Link to="/console/people" search={{ q: p.email }} className="tap text-xs font-medium text-primary">Open in People</Link>
          <Link to="/id/$code" params={{ code: p.code }} className="tap ml-auto text-xs text-muted-foreground">Public profile</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[5.5rem_1fr] gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{children}</dd></div>;
}
