import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, Check, Clock, AlertTriangle, Send, Search, Plus, Trash2, RefreshCw, ExternalLink, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead } from "./console";
import { cn } from "@/lib/utils";
import { fillParam, MERGE_FIELDS, prettyWa, toWaId, varCount, windowLeft, type MergeField } from "@/lib/whatsapp";
import { waBroadcast, waCreateTemplate, waDeleteTemplate, waHealth, waReply } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/console/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp Studio · Console" }, { name: "robots", content: "noindex" }] }),
  component: Studio,
});

type Tab = "desk" | "broadcast" | "templates" | "delivery" | "number";
const TABS: { k: Tab; l: string }[] = [
  { k: "desk", l: "Live desk" }, { k: "broadcast", l: "Broadcast" }, { k: "templates", l: "Templates" }, { k: "delivery", l: "Delivery" }, { k: "number", l: "Number & profile" },
];

const db = supabase as any;
const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const hrs = (ms: number) => (ms >= 3600_000 ? `${Math.floor(ms / 3600_000)} h ${Math.floor((ms % 3600_000) / 60_000)} min` : `${Math.ceil(ms / 60_000)} min`);

function Studio() {
  const [tab, setTab] = useState<Tab>("desk");
  const health = useServerFn(waHealth);
  const h = useQuery({ queryKey: ["wa", "health"], queryFn: () => health(), staleTime: 60_000 });
  const approved = (h.data?.templates ?? []).filter((t: any) => t.status === "APPROVED");
  return (
    <div>
      <PageHead title="WhatsApp Studio">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("size-2 rounded-full", h.data?.phone ? "bg-primary" : "bg-destructive")} />
          {h.data?.phone ? `${h.data.phone.verified_name} · ${h.data.phone.display_phone_number}` : h.isLoading ? "Checking number…" : "Number unreachable"}
        </span>
      </PageHead>
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={cn("press -mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === t.k ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground")}>{t.l}</button>
        ))}
      </nav>
      {tab === "desk" ? <Desk /> : null}
      {tab === "broadcast" ? <Broadcast templates={approved} onTemplates={() => setTab("templates")} /> : null}
      {tab === "templates" ? <Templates list={h.data?.templates ?? []} error={h.data?.templateError ?? null} loading={h.isLoading} /> : null}
      {tab === "delivery" ? <Delivery /> : null}
      {tab === "number" ? <NumberPanel phone={h.data?.phone} error={h.data?.phoneError ?? null} /> : null}
    </div>
  );
}

/* ---------------- Live desk ---------------- */
type Msg = { id: string; direction: "in" | "out"; wa_id: string; person_id: string | null; kind: string; body: string | null; template_name: string | null; status: string; error: any; created_at: string; people?: { full_name: string; delegate_code: string; organization: string | null } | null };

function Tick({ s }: { s: string }) {
  if (s === "read") return <CheckCheck className="size-3.5 text-primary" aria-label="Read" />;
  if (s === "delivered") return <CheckCheck className="size-3.5" aria-label="Delivered" />;
  if (s === "sent") return <Check className="size-3.5" aria-label="Sent" />;
  if (s === "failed") return <AlertTriangle className="size-3.5 text-destructive" aria-label="Failed" />;
  return <Clock className="size-3.5" aria-label="Accepted" />;
}

function Desk() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wa", "msgs"], refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await db.from("whatsapp_messages").select("id,direction,wa_id,person_id,kind,body,template_name,status,error,created_at,people(full_name,delegate_code,organization)").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as Msg[];
    },
  });
  const [sel, setSel] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const threads = useMemo(() => {
    const m = new Map<string, { wa: string; last: Msg; lastIn: string | null; person: Msg["people"]; unanswered: boolean }>();
    for (const x of q.data ?? []) {
      const t = m.get(x.wa_id) ?? { wa: x.wa_id, last: x, lastIn: null, person: null, unanswered: x.direction === "in" };
      if (x.direction === "in" && !t.lastIn) t.lastIn = x.created_at;
      if (!t.person && x.people) t.person = x.people;
      m.set(x.wa_id, t);
    }
    const s = find.trim().toLowerCase();
    return [...m.values()].filter((t) => !s || t.wa.includes(s.replace(/\D/g, "") || "~") || t.person?.full_name.toLowerCase().includes(s) || t.person?.delegate_code.toLowerCase().includes(s));
  }, [q.data, find]);
  const cur = threads.find((t) => t.wa === sel) ?? null;
  const msgs = useMemo(() => (q.data ?? []).filter((x) => x.wa_id === sel).reverse(), [q.data, sel]);

  return (
    <div className="grid min-h-[60vh] overflow-hidden rounded-[var(--radius-pass)] border border-border bg-card md:grid-cols-[18rem_1fr]">
      <aside className={cn("border-border md:border-r", sel && "hidden md:block")}>
        <label className="flex items-center gap-2 border-b border-border px-3 py-2.5"><Search className="size-4 text-muted-foreground" /><input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Name, code or number" className="w-full bg-transparent text-sm outline-none" /></label>
        {q.isLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : null}
        {!q.isLoading && !threads.length ? <p className="p-4 text-sm text-muted-foreground">No conversations yet. When a guest writes to the number, it shows up here.</p> : null}
        <ul className="max-h-[70vh] overflow-y-auto">
          {threads.map((t) => {
            const open = windowLeft(t.lastIn) > 0;
            return (
              <li key={t.wa}><button onClick={() => setSel(t.wa)} className={cn("press flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left", sel === t.wa && "bg-secondary")}>
                <span className="flex items-center justify-between gap-2 text-sm font-medium">{t.person?.full_name ?? prettyWa(t.wa)}{t.unanswered ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Awaiting reply" /> : null}</span>
                <span className="truncate text-xs text-muted-foreground">{t.last.direction === "out" ? "You: " : ""}{t.last.body ?? `[${t.last.kind}]`}</span>
                <span className="text-[0.7rem] tabular-nums text-muted-foreground">{fmt(t.last.created_at)}{open ? " · window open" : ""}</span>
              </button></li>
            );
          })}
        </ul>
      </aside>
      <section className={cn("flex min-h-[60vh] flex-col", !sel && "hidden md:flex")}>
        {cur ? <Thread key={cur.wa} wa={cur.wa} person={cur.person} lastIn={cur.lastIn} msgs={msgs} onBack={() => setSel(null)} onSent={() => qc.invalidateQueries({ queryKey: ["wa", "msgs"] })} />
          : <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">Pick a conversation.<br />Replies are free-form for 24 hours after the guest last wrote.</div>}
      </section>
    </div>
  );
}

const QUICK = [
  "Thanks for writing in. A volunteer is on it and will reply shortly.",
  "The Help Desk is at the main academic block entrance, open 8 AM to 7 PM.",
  "Your session details are in the app under Calendar: https://paniim.planos.in/calendar",
  "Please show your pass QR at the registration desk to check in.",
];

function Thread({ wa, person, lastIn, msgs, onBack, onSent }: { wa: string; person: Msg["people"]; lastIn: string | null; msgs: Msg[]; onBack: () => void; onSent: () => void }) {
  const reply = useServerFn(waReply);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const left = windowLeft(lastIn);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try { await reply({ data: { waId: wa, text } }); setText(""); onSent(); } catch (e) { toast.error((e as Error).message); onSent(); }
    setBusy(false);
  }
  return <>
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <button onClick={onBack} className="press text-sm text-muted-foreground md:hidden">Back</button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{person?.full_name ?? "Unmatched number"}</p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">{prettyWa(wa)}{person ? ` · ${person.delegate_code}${person.organization ? ` · ${person.organization}` : ""}` : " · no delegate with this phone"}</p>
      </div>
      <span className={cn("rounded-md px-2 py-1 text-xs tabular-nums", left ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>{left ? `${hrs(left)} left to reply` : "Window closed"}</span>
    </header>
    <div className="flex-1 space-y-2 overflow-y-auto bg-muted/40 px-4 py-4">
      {msgs.map((m) => (
        <div key={m.id} className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-card", m.direction === "out" ? "ml-auto bg-primary text-primary-foreground" : "bg-card")}>
          {m.template_name ? <p className="mb-0.5 text-[0.7rem] opacity-70">Template · {m.template_name}</p> : null}
          <p className="whitespace-pre-wrap break-words">{m.body ?? `[${m.kind}]`}</p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[0.7rem] opacity-70 tabular-nums">{fmt(m.created_at)}{m.direction === "out" ? <Tick s={m.status} /> : null}</p>
          {m.status === "failed" ? <p className="mt-1 text-[0.7rem]">{m.error?.[0]?.title ?? m.error?.message ?? "Not delivered"}</p> : null}
        </div>
      ))}
      <div ref={end} />
    </div>
    <footer className="border-t border-border p-3">
      {left ? <>
        <div className="mb-2 flex gap-1.5 overflow-x-auto">{QUICK.map((s) => <button key={s} onClick={() => setText(s)} className="press shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{s.slice(0, 34)}…</button>)}</div>
        <div className="flex gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} rows={2} placeholder="Reply as IIM Shillong" className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <button disabled={busy || !text.trim()} onClick={send} className="press grid w-11 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50" aria-label="Send"><Send className="size-4" /></button>
        </div>
      </> : <p className="text-sm text-muted-foreground">The guest hasn't written in the last 24 hours. Reach them with an approved template from Broadcast.</p>}
    </footer>
  </>;
}

/* ---------------- Broadcast ---------------- */
type P = { id: string; full_name: string; delegate_code: string; organization: string | null; phone: string | null; attendance_mode: string; consent_whatsapp: boolean; user_id: string | null; roles: string[] };
const ROLE_CHIPS = ["presenter", "author", "attendee", "visitor", "track_chair", "reviewer", "volunteer", "organizer"];

async function loadPeople(): Promise<P[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("people").select("id, full_name, delegate_code, organization, phone, attendance_mode, consent_whatsapp, user_id, person_roles(role)").eq("is_placeholder", false).order("full_name").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out.map((p) => ({ ...p, roles: (p.person_roles ?? []).map((r: any) => r.role) }));
}

const bodyOf = (t: any) => (t?.components ?? []).find((c: any) => c.type === "BODY")?.text ?? "";

function Broadcast({ templates, onTemplates }: { templates: any[]; onTemplates: () => void }) {
  const send = useServerFn(waBroadcast);
  const qc = useQueryClient();
  const people = useQuery({ queryKey: ["wa", "people"], queryFn: loadPeople, staleTime: 5 * 60_000 });
  const [roles, setRoles] = useState<string[]>([]);
  const [att, setAtt] = useState<"any" | "offline" | "online">("any");
  const [signed, setSigned] = useState<"any" | "yes" | "no">("any");
  const [tplKey, setTplKey] = useState("");
  const [map, setMap] = useState<{ field: MergeField; custom: string }[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const tpl = templates.find((t) => `${t.name}|${t.language}` === tplKey);
  const body = bodyOf(tpl);
  useEffect(() => { setMap(Array.from({ length: varCount(body) }, (_, i) => ({ field: i === 0 ? "first_name" : "custom", custom: "" }))); }, [tplKey]);

  const all = people.data ?? [];
  const matched = all.filter((p) => (!roles.length || p.roles.some((r) => roles.includes(r))) && (att === "any" || (att === "online" ? p.attendance_mode === "online" : p.attendance_mode !== "online")) && (signed === "any" || (signed === "yes") === !!p.user_id));
  const reach = matched.filter((p) => p.consent_whatsapp && toWaId(p.phone));
  const noConsent = matched.filter((p) => !p.consent_whatsapp).length;
  const noPhone = matched.filter((p) => p.consent_whatsapp && !toWaId(p.phone)).length;
  const sample = reach[0];
  const preview = sample ? map.reduce((s, m, i) => s.replaceAll(`{{${i + 1}}}`, m.field === "custom" && !m.custom ? `{{${i + 1}}}` : fillParam(m.field, m.custom, sample)), body) : body;
  const ready = tpl && reach.length && map.every((m) => m.field !== "custom" || m.custom.trim());

  async function go() {
    setBusy(true);
    try {
      const r = await send({ data: { personIds: reach.map((p) => p.id), template: tpl.name, language: tpl.language, body, mapping: map, audience: { roles, attendance: att, signedIn: signed } } });
      toast.success(`Sent to ${r.accepted} of ${r.total}${r.failed ? `, ${r.failed} failed` : ""}`);
      qc.invalidateQueries({ queryKey: ["wa"] });
      setConfirm(false);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        <section className="rounded-[var(--radius-pass)] bg-card p-4 shadow-card">
          <h2 className="mb-3 text-sm font-medium">1 · Who</h2>
          <div className="flex flex-wrap gap-1.5">{ROLE_CHIPS.map((r) => <button key={r} onClick={() => setRoles((s) => s.includes(r) ? s.filter((x) => x !== r) : [...s, r])} className={cn("press rounded-md border px-2.5 py-1 text-xs capitalize", roles.includes(r) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{r.replace("_", " ")}</button>)}</div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Seg v={att} set={setAtt} opts={[["any", "Everyone"], ["offline", "On campus"], ["online", "Online"]]} />
            <Seg v={signed} set={setSigned} opts={[["any", "Any"], ["yes", "Signed in"], ["no", "Not signed in"]]} />
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm tabular-nums"><Users className="size-4" /><b>{reach.length}</b> reachable of {matched.length} matched
            <span className="text-xs text-muted-foreground">· {noConsent} haven't opted in · {noPhone} no valid phone</span></p>
        </section>
        <section className="rounded-[var(--radius-pass)] bg-card p-4 shadow-card">
          <h2 className="mb-3 text-sm font-medium">2 · Approved template</h2>
          {templates.length ? <select value={tplKey} onChange={(e) => setTplKey(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Pick a template</option>
            {templates.map((t) => <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} · {t.language} · {t.category.toLowerCase()}</option>)}
          </select> : <p className="text-sm text-muted-foreground">No approved templates yet. Messages to people who haven't written in need one. <button onClick={onTemplates} className="text-primary underline">Create a template</button></p>}
          {map.length ? <div className="mt-3 space-y-2">{map.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-sm"><span className="w-10 tabular-nums text-muted-foreground">{`{{${i + 1}}}`}</span>
              <select value={m.field} onChange={(e) => setMap((s) => s.map((x, k) => k === i ? { ...x, field: e.target.value as MergeField } : x))} className="rounded-md border border-border bg-background px-2 py-1.5">{MERGE_FIELDS.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}</select>
              {m.field === "custom" ? <input value={m.custom} onChange={(e) => setMap((s) => s.map((x, k) => k === i ? { ...x, custom: e.target.value } : x))} placeholder="Same text for everyone" className="flex-1 rounded-md border border-border bg-background px-2 py-1.5" /> : null}
            </div>))}</div> : null}
        </section>
      </div>
      <aside className="space-y-3">
        <div className="rounded-[var(--radius-pass)] bg-muted/60 p-4">
          <p className="mb-2 text-xs text-muted-foreground">Preview{sample ? ` for ${sample.full_name}` : ""}</p>
          <div className="rounded-xl bg-card px-3 py-2 text-sm shadow-card"><p className="whitespace-pre-wrap">{preview || "Pick a template to preview."}</p></div>
        </div>
        {!confirm ? <button disabled={!ready} onClick={() => setConfirm(true)} className="press w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Review send to {reach.length}</button>
          : <div className="space-y-2 rounded-[var(--radius-pass)] border border-border bg-card p-3 text-sm">
            <p>Send <b>{tpl?.name}</b> to <b className="tabular-nums">{reach.length}</b> people? {tpl?.category === "MARKETING" ? "Marketing messages are charged by Meta." : "Utility messages."}</p>
            <div className="flex gap-2"><button onClick={() => setConfirm(false)} className="press flex-1 rounded-md border border-border py-2">Back</button><button disabled={busy} onClick={go} className="press flex-1 rounded-md bg-primary py-2 text-primary-foreground disabled:opacity-50">{busy ? "Sending…" : "Send now"}</button></div>
          </div>}
        <p className="text-xs text-muted-foreground">Only people who opted in to WhatsApp updates are messaged. This is checked again on the server.</p>
      </aside>
    </div>
  );
}

function Seg<T extends string>({ v, set, opts }: { v: T; set: (x: T) => void; opts: [T, string][] }) {
  return <div className="inline-flex overflow-hidden rounded-md border border-border">{opts.map(([k, l]) => <button key={k} onClick={() => set(k)} className={cn("press px-2.5 py-1 text-xs", v === k ? "bg-secondary font-medium" : "text-muted-foreground")}>{l}</button>)}</div>;
}

/* ---------------- Templates ---------------- */
const STARTERS = [
  { name: "room_change", body: "Hello {{1}}, a change for the 11th Pan-IIM WMC: {{2}}. The app has the latest schedule. Reply here if you need help." },
  { name: "session_reminder", body: "Hello {{1}}, a reminder that your session at the 11th Pan-IIM WMC starts soon: {{2}}. Please reach the room 10 minutes early." },
  { name: "pass_ready", body: "Hello {{1}}, your delegate pass for the 11th Pan-IIM WMC at IIM Shillong is ready in the app. Your delegate code is {{2}}." },
  { name: "certificate_ready", body: "Hello {{1}}, thank you for being part of the 11th Pan-IIM WMC. Your participation certificate is now ready to download in the app." },
];

function Templates({ list, error, loading }: { list: any[]; error: string | null; loading: boolean }) {
  const qc = useQueryClient();
  const create = useServerFn(waCreateTemplate);
  const del = useServerFn(waDeleteTemplate);
  const [f, setF] = useState({ name: "", category: "UTILITY", language: "en", header: "", body: "", footer: "11th Pan-IIM WMC · IIM Shillong", samples: [] as string[], btnText: "", btnUrl: "" });
  const n = varCount(f.body);
  const samples = Array.from({ length: n }, (_, i) => f.samples[i] ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await create({ data: { name: f.name, category: f.category, language: f.language, header: f.header, body: f.body, footer: f.footer, samples, url: f.btnUrl ? { text: f.btnText, url: f.btnUrl } : undefined } });
      toast.success("Submitted to Meta for review. Approval usually takes minutes, sometimes up to 48 hours.");
      setF((s) => ({ ...s, name: "", body: "", samples: [] }));
      qc.invalidateQueries({ queryKey: ["wa", "health"] });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  const badge = (s: string) => cn("rounded px-1.5 py-0.5 text-[0.7rem] font-medium", s === "APPROVED" ? "bg-primary/15 text-primary" : s === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">On the account</h2><button onClick={() => qc.invalidateQueries({ queryKey: ["wa", "health"] })} className="press text-muted-foreground" aria-label="Refresh"><RefreshCw className="size-4" /></button></div>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !list.length && !error ? <p className="text-sm text-muted-foreground">No templates yet. Start from one on the right.</p> : null}
        <ul className="space-y-2">{list.map((t) => (
          <li key={`${t.name}${t.language}`} className="rounded-[var(--radius-pass)] bg-card p-3 shadow-card">
            <div className="flex items-center gap-2"><b className="text-sm">{t.name}</b><span className={badge(t.status)}>{t.status.toLowerCase()}</span><span className="text-xs text-muted-foreground">{t.language} · {String(t.category).toLowerCase()}</span>
              <button onClick={async () => { if (!confirm(`Delete ${t.name}? This removes it for every language.`)) return; try { await del({ data: { name: t.name } }); qc.invalidateQueries({ queryKey: ["wa", "health"] }); } catch (e) { toast.error((e as Error).message); } }} className="press ml-auto text-muted-foreground" aria-label="Delete"><Trash2 className="size-4" /></button></div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{bodyOf(t)}</p>
            {t.rejected_reason && t.rejected_reason !== "NONE" ? <p className="mt-1 text-xs text-destructive">Rejected: {t.rejected_reason}</p> : null}
          </li>))}</ul>
      </section>
      <section className="space-y-3 rounded-[var(--radius-pass)] bg-card p-4 shadow-card">
        <h2 className="text-sm font-medium">New template</h2>
        <div className="flex flex-wrap gap-1.5">{STARTERS.map((s) => <button key={s.name} onClick={() => setF((x) => ({ ...x, name: s.name, body: s.body, samples: [] }))} className="press rounded-md border border-border px-2 py-1 text-xs"><Plus className="mr-1 inline size-3" />{s.name.replace("_", " ")}</button>)}</div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="name_in_lowercase" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="rounded-md border border-border bg-background px-2 text-sm"><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option></select>
          <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} className="rounded-md border border-border bg-background px-2 text-sm"><option value="en">English</option><option value="en_US">English (US)</option><option value="hi">Hindi</option></select>
        </div>
        <input value={f.header} onChange={(e) => setF({ ...f, header: e.target.value })} placeholder="Header (optional, 60 characters)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={5} placeholder="Body. Use {{1}}, {{2}} for per-person details." className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        {samples.map((s, i) => <input key={i} value={s} onChange={(e) => setF({ ...f, samples: samples.map((x, k) => (k === i ? e.target.value : x)) })} placeholder={`Sample for {{${i + 1}}} (required by Meta)`} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />)}
        <input value={f.footer} onChange={(e) => setF({ ...f, footer: e.target.value })} placeholder="Footer (optional)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <div className="grid grid-cols-[8rem_1fr] gap-2"><input value={f.btnText} onChange={(e) => setF({ ...f, btnText: e.target.value })} placeholder="Button text" className="rounded-md border border-border bg-background px-3 py-2 text-sm" /><input value={f.btnUrl} onChange={(e) => setF({ ...f, btnUrl: e.target.value })} placeholder="https://paniim.planos.in/…" className="rounded-md border border-border bg-background px-3 py-2 text-sm" /></div>
        <button disabled={busy || !f.name || !f.body || samples.some((s) => !s.trim())} onClick={submit} className="press w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Submitting…" : "Submit for Meta review"}</button>
        <p className="text-xs text-muted-foreground">Templates can't be edited after submitting; create a new one instead. Write full sentences around variables or Meta rejects them.</p>
      </section>
    </div>
  );
}

/* ---------------- Delivery ---------------- */
function Delivery() {
  const q = useQuery({
    queryKey: ["wa", "broadcasts"], refetchInterval: 15000,
    queryFn: async () => {
      const [b, m] = await Promise.all([
        db.from("whatsapp_broadcasts").select("*").order("created_at", { ascending: false }).limit(50),
        db.from("whatsapp_messages").select("broadcast_id,status").not("broadcast_id", "is", null).limit(10000),
      ]);
      if (b.error) throw b.error;
      const tally = new Map<string, Record<string, number>>();
      for (const r of m.data ?? []) { const t = tally.get(r.broadcast_id) ?? {}; t[r.status] = (t[r.status] ?? 0) + 1; tally.set(r.broadcast_id, t); }
      return (b.data ?? []).map((x: any) => ({ ...x, t: tally.get(x.id) ?? {} }));
    },
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!q.data?.length) return <p className="text-sm text-muted-foreground">No broadcasts yet. Delivery and read receipts appear here as WhatsApp reports them.</p>;
  return (
    <ul className="space-y-2">{q.data.map((b: any) => {
      const st = ["read", "delivered", "sent", "accepted", "failed"] as const;
      const tot = Math.max(1, b.total);
      return <li key={b.id} className="rounded-[var(--radius-pass)] bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-baseline gap-2"><b className="text-sm">{b.template_name}</b><span className="text-xs text-muted-foreground tabular-nums">{fmt(b.created_at)} · {b.total} recipients</span></div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">{st.map((s) => <span key={s} style={{ width: `${((b.t[s] ?? 0) / tot) * 100}%` }} className={cn(s === "read" ? "bg-primary" : s === "delivered" ? "bg-primary/60" : s === "sent" ? "bg-primary/30" : s === "failed" ? "bg-destructive" : "bg-muted-foreground/30")} />)}</div>
        <p className="mt-1.5 flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">{st.map((s) => <span key={s}>{s} {b.t[s] ?? 0}</span>)}</p>
      </li>;
    })}</ul>
  );
}

/* ---------------- Number & profile ---------------- */
function NumberPanel({ phone, error }: { phone: any; error: string | null }) {
  const rows: [string, string][] = phone ? [
    ["Display name", phone.verified_name], ["Name review", String(phone.name_status ?? "—").toLowerCase()], ["Number", phone.display_phone_number],
    ["Quality", String(phone.quality_rating ?? "—").toLowerCase()], ["Daily limit tier", phone.messaging_limit_tier ?? "—"], ["Platform", phone.platform_type ?? "—"],
  ] : [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-[var(--radius-pass)] bg-card p-4 shadow-card">
        <h2 className="mb-2 text-sm font-medium">Number health</h2>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <dl className="divide-y divide-border text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between py-2"><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums capitalize">{v}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-muted-foreground">Incoming messages and receipts arrive at this app once WhatsApp's Incoming messages destination points here.</p>
      </section>
      <section className="space-y-3 rounded-[var(--radius-pass)] bg-card p-4 shadow-card text-sm">
        <h2 className="font-medium">Profile photo, about and description</h2>
        <p className="text-muted-foreground">These are set in Meta's WhatsApp Manager, not from here. The display name ("{phone?.verified_name ?? "IIM Shillong"}") changes only through Meta's name review.</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Photo: 640×640 square, logo centred (WhatsApp crops to a circle).</li>
          <li>About: up to 139 characters.</li>
          <li>Description, email, website, address: shown on the business info card.</li>
        </ul>
        <a href="https://business.facebook.com/latest/whatsapp_manager/phone_numbers" target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 font-medium">Open WhatsApp Manager <ExternalLink className="size-4" /></a>
      </section>
    </div>
  );
}
