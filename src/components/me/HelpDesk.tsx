import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, HELP_CATEGORIES, isUrgent, statusLabel } from "@/lib/help-desk";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string; category: string; message: string; status: string; created_at: string;
  resolved_at: string | null; resolution_note: string | null; location: string | null; urgent: boolean;
};

export function HelpDesk({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const key = ["my-help", userId];
  const tickets = useQuery({
    queryKey: key, enabled: !!userId, refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("help_requests")
        .select("id, category, message, status, created_at, resolved_at, resolution_note, location, urgent")
        .eq("user_id", userId!).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as Ticket[];
    },
  });
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("help_requests").insert({
      message: message.trim(), category, user_id: userId, location: location.trim() || null, urgent: category === "medical",
    });
    setBusy(false);
    if (error) { toast.error("Couldn't send. Check your connection and try again."); return; }
    setMessage(""); setLocation(""); setOpen(false);
    toast.success("Sent. You'll see updates right here.");
    qc.invalidateQueries({ queryKey: key });
  }

  async function act(t: Ticket, kind: "close" | "reopen") {
    const { error } = kind === "close"
      ? await supabase.rpc("close_my_help", { _id: t.id, _note: "Closed by you" })
      : await supabase.rpc("reopen_my_help", { _id: t.id, _note: "Still need help" });
    if (error) { toast.error("Couldn't update. Try again."); return; }
    qc.invalidateQueries({ queryKey: key });
  }

  const list = tickets.data ?? [];
  const active = list.filter((t) => t.status !== "resolved");
  const done = list.filter((t) => t.status === "resolved");

  return (
    <section className="space-y-2.5">
      {active.map((t) => <TicketCard key={t.id} t={t} onAct={act} />)}

      {open ? (
        <form onSubmit={submit} className="help-ticket animate-in fade-in slide-in-from-bottom-1 px-4 py-4">
          <p className="text-display text-[1rem]">What do you need?</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HELP_CATEGORIES.map((c) => (
              <button type="button" key={c.value} onClick={() => setCategory(c.value)}
                className={cn("tap rounded-md border px-2.5 py-1 text-xs transition",
                  category === c.value ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-emboss)]" : "border-border bg-background/60")}>
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{HELP_CATEGORIES.find((c) => c.value === category)?.hint}</p>
          {category === "medical" ? (
            <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              For an emergency, call 112 first. We'll flag this as urgent for the desk.
            </p>
          ) : null}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Tell us in a line or two" className="mt-3 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where are you? (optional)" className="mt-2 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm" />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="tap rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={busy || !message.trim()} className="tap btn-sheen flex-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Sending" : "Send to help desk"}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="help-ticket flex w-full items-center justify-between px-4 py-3.5 text-left">
          <span>
            <span className="text-display block text-[1rem]">Ask the help desk</span>
            <span className="text-xs text-muted-foreground">A volunteer picks it up and replies here</span>
          </span>
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-primary text-lg text-primary-foreground shadow-[var(--shadow-emboss)]">+</span>
        </button>
      )}

      {done.length ? (
        <details className="group">
          <summary className="tap cursor-pointer list-none px-1 py-1 text-xs text-muted-foreground">
            Past requests ({done.length}) <span className="inline-block transition group-open:rotate-90">›</span>
          </summary>
          <div className="mt-2 space-y-2">{done.map((t) => <TicketCard key={t.id} t={t} onAct={act} />)}</div>
        </details>
      ) : null}
    </section>
  );
}

function TicketCard({ t, onAct }: { t: Ticket; onAct: (t: Ticket, k: "close" | "reopen") => void }) {
  const resolved = t.status === "resolved";
  const steps = ["open", "in_progress", "resolved"];
  const at = steps.indexOf(t.status);
  return (
    <article className={cn("help-ticket overflow-hidden", resolved && "opacity-80")}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground tabular-nums">
            {categoryLabel(t.category)}, {new Date(t.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">{t.message}</p>
        </div>
        <span className={cn("ticket-stamp shrink-0", resolved ? "text-primary" : isUrgent(t) ? "text-destructive" : "text-muted-foreground")}>
          {statusLabel(t.status)}
        </span>
      </div>
      <div className="mt-3 flex gap-1 px-4" aria-hidden>
        {steps.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", i <= at ? "bg-primary" : "bg-border")} />
        ))}
      </div>
      {t.resolution_note ? (
        <p className="mx-4 mt-3 rounded-md bg-secondary px-3 py-2 text-sm"><span className="text-xs text-muted-foreground">Desk: </span>{t.resolution_note}</p>
      ) : null}
      <div className="ticket-perf mt-3" />
      <div className="flex items-center justify-between px-4 py-2 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {resolved ? "Sorted" : t.status === "in_progress" ? "Someone's on it" : "Received"}
        </span>
        {resolved ? (
          <button onClick={() => onAct(t, "reopen")} className="tap rounded-full px-2 py-1 font-medium text-primary">Still stuck?</button>
        ) : (
          <button onClick={() => onAct(t, "close")} className="tap rounded-full px-2 py-1 text-muted-foreground">It's sorted</button>
        )}
      </div>
    </article>
  );
}
