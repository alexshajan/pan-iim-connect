import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Download, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/registry-data";
import { PageHead } from "./console";
import { previewEmail, sendPersonEmail } from "@/lib/emails.functions";
import { audienceCsv, EMPTY_FILTER, filterAudience, institutionCounts, missingFields, type AudienceFilter, type AudiencePerson } from "@/lib/email-audience";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/console/emails")({ component: EmailsPage });

type Kind = "welcome-pass" | "missing-info" | "conference-update" | "app-nudge" | "presentation-slot";
const KINDS: { key: Kind; label: string; hint: string; preset: Partial<AudienceFilter>; oneToOne: boolean }[] = [
  { key: "welcome-pass", label: "Hello, pass ready", hint: "First contact: what the app is and where the pass lives.", preset: {}, oneToOne: true },
  { key: "missing-info", label: "Missing information", hint: "Lists exactly what each person still has to fill in.", preset: { missingOnly: true }, oneToOne: true },
  { key: "presentation-slot", label: "Presentation slot", hint: "Each presenter's paper, day, time and room, with online/in-person notes.", preset: { roles: ["presenter"] }, oneToOne: true },
  { key: "conference-update", label: "Update / notification", hint: "Schedule changes, venue notes, reminders. You write the text.", preset: {}, oneToOne: false },
  { key: "app-nudge", label: "Adoption nudge", hint: "For people who haven't signed in yet.", preset: { signedIn: "no" }, oneToOne: false },
];

async function loadPeople(): Promise<AudiencePerson[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("people")
      .select("id, full_name, email, email_missing, phone, organization, attendance_mode, user_id, delegate_code, is_placeholder, person_roles(role)")
      .eq("is_placeholder", false).order("full_name").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out.map((p) => ({ ...p, roles: (p.person_roles ?? []).map((r: { role: string }) => r.role) }));
}

function EmailsPage() {
  const people = useQuery({ queryKey: ["email-audience"], queryFn: loadPeople, staleTime: 5 * 60_000 });
  const [kind, setKind] = useState<Kind>("welcome-pass");
  const [filter, setFilter] = useState<AudienceFilter>(EMPTY_FILTER);
  const [draft, setDraft] = useState({ title: "", body: "", ctaLabel: "", ctaUrl: "", deadline: "" });
  const meta = KINDS.find((k) => k.key === kind)!;

  const all = people.data ?? [];
  const roles = useMemo(() => [...new Set(all.flatMap((p) => p.roles))].sort(), [all]);
  const institutions = useMemo(() => institutionCounts(all).slice(0, 40), [all]);
  const audience = useMemo(() => filterAudience(all, filter), [all, filter]);

  function pick(k: (typeof KINDS)[number]) {
    setKind(k.key);
    setFilter({ ...EMPTY_FILTER, ...k.preset });
  }

  function exportCsv() {
    const blob = new Blob([audienceCsv(audience)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pan-iim-${kind}-${audience.length}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHead eyebrow="Event ops" title="Emails" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <section className="card-surface px-5 py-4">
            <h2 className="text-sm font-medium">1, What are you sending?</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {KINDS.map((k) => (
                <button key={k.key} onClick={() => pick(k)}
                  className={cn("tap rounded-2xl border border-border px-3.5 py-3 text-left", kind === k.key && "border-primary bg-plate text-plate-foreground")}>
                  <span className="block text-sm font-semibold">{k.label}</span>
                  <span className={cn("mt-0.5 block text-xs", kind === k.key ? "opacity-80" : "text-muted-foreground")}>{k.hint}</span>
                </button>
              ))}
            </div>
          </section>

          {kind === "conference-update" && (
            <section className="card-surface space-y-2 px-5 py-4">
              <h2 className="text-sm font-medium">Message</h2>
              <Input placeholder="Headline, also the subject" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6}
                placeholder="Write the update. Leave a blank line between paragraphs."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Button text (optional)" value={draft.ctaLabel} onChange={(v) => setDraft({ ...draft, ctaLabel: v })} />
                <Input placeholder="Button link https://…" value={draft.ctaUrl} onChange={(v) => setDraft({ ...draft, ctaUrl: v })} />
              </div>
            </section>
          )}
          {kind === "missing-info" && (
            <section className="card-surface px-5 py-4">
              <h2 className="text-sm font-medium">Deadline (optional)</h2>
              <Input placeholder="e.g. 10 November" value={draft.deadline} onChange={(v) => setDraft({ ...draft, deadline: v })} />
            </section>
          )}

          <section className="card-surface px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">2, Who gets it?</h2>
              <span className="text-display text-xl tabular-nums">{people.isLoading ? "…" : audience.length}<span className="ml-1 text-xs text-muted-foreground">people</span></span>
            </div>
            <Label>Role</Label>
            <Chips options={roles.map((r) => ({ value: r, label: r.replace(/_/g, " ") }))} selected={filter.roles}
              onToggle={(v) => setFilter({ ...filter, roles: toggle(filter.roles, v) })} />
            <Label>Institution</Label>
            <Chips options={institutions.map((i) => ({ value: i.name, label: `${i.name}, ${i.count}` }))} selected={filter.institutions}
              onToggle={(v) => setFilter({ ...filter, institutions: toggle(filter.institutions, v) })} scroll />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Segment label="Attending" value={filter.attendance} options={[["any", "All"], ["offline", "On campus"], ["online", "Online"]]}
                onChange={(v) => setFilter({ ...filter, attendance: v as AudienceFilter["attendance"] })} />
              <Segment label="Signed in to app" value={filter.signedIn} options={[["any", "All"], ["yes", "Yes"], ["no", "Not yet"]]}
                onChange={(v) => setFilter({ ...filter, signedIn: v as AudienceFilter["signedIn"] })} />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filter.missingOnly} onChange={(e) => setFilter({ ...filter, missingOnly: e.target.checked })} />
              Only people with missing details
            </label>
            <p className="mt-2 text-xs text-muted-foreground">Test data and people without a usable email are always left out.</p>
          </section>

          <section className="card-surface px-5 py-4">
            <h2 className="text-sm font-medium">3, Send</h2>
            {meta.oneToOne ? (
              <p className="mt-1 text-xs text-muted-foreground">Send person by person from the list below. Each email is personal to that record.</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Mass sends go through the bulk channel, coming with the WhatsApp manager. For now, export the list with merge fields.
              </p>
            )}
            <button onClick={exportCsv} disabled={!audience.length}
              className="tap mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-40">
              <Download className="size-4" /> Export {audience.length} recipients
            </button>
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Preview kind={kind} draft={draft} sample={audience.find((p) => /[a-z]{2}/i.test(p.full_name))} />
          {meta.oneToOne && <Recipients kind={kind} people={audience} deadline={draft.deadline} />}
        </div>
      </div>
    </>
  );
}

function Preview({ kind, draft, sample }: { kind: Kind; draft: Record<string, string>; sample?: AudiencePerson | undefined }) {
  const run = useServerFn(previewEmail);
  const [debounced, setDebounced] = useState(draft);
  useEffect(() => { const t = setTimeout(() => setDebounced(draft), 400); return () => clearTimeout(t); }, [draft]);
  const data = {
    ...debounced,
    name: sample?.full_name, code: sample?.delegate_code,
    missing: sample ? missingFields(sample) : undefined,
  };
  const q = useQuery({
    queryKey: ["email-preview", kind, data, sample?.id],
    queryFn: () => run({ data: { template: kind, data, personId: kind === "presentation-slot" ? sample?.id : undefined } }),
    placeholderData: (prev) => prev,
  });
  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Mail className="size-4 text-primary" />
        <p className="min-w-0 truncate text-sm"><span className="text-muted-foreground">Subject, </span>{q.data?.subject ?? "…"}</p>
      </div>
      {q.error ? (
        <p className="px-4 py-6 text-sm text-destructive">Couldn't load the preview. {(q.error as Error).message}</p>
      ) : (
        <iframe title="Email preview" srcDoc={q.data?.html ?? ""} sandbox="" className={cn("h-[620px] w-full bg-card transition-opacity", q.isFetching && "opacity-60")} />
      )}
      <p className="border-t border-border px-4 py-2 text-[0.7rem] text-muted-foreground">
        {sample ? `Shown as ${sample.full_name} would see it.` : "Sample preview."} An unsubscribe line is added automatically.
      </p>
    </section>
  );
}

function Recipients({ kind, people, deadline }: { kind: Kind; people: AudiencePerson[]; deadline: string }) {
  const send = useServerFn(sendPersonEmail);
  const [q, setQ] = useState("");
  const [state, setState] = useState<Record<string, "busy" | "sent">>({});
  const rows = people.filter((p) => !q || `${p.full_name} ${p.email} ${p.organization}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
  async function go(p: AudiencePerson) {
    setState((s) => ({ ...s, [p.id]: "busy" }));
    try {
      const r = await send({ data: { personId: p.id, template: kind, deadline: deadline || undefined } });
      if (r.ok) { toast.success(r.message); setState((s) => ({ ...s, [p.id]: "sent" })); }
      else { toast.error(r.message); setState((s) => { const n = { ...s }; delete n[p.id]; return n; }); }
    } catch (e) {
      toast.error((e as Error).message);
      setState((s) => { const n = { ...s }; delete n[p.id]; return n; });
    }
  }
  return (
    <section className="card-surface px-4 py-3">
      <Input placeholder={`Search ${people.length} people`} value={q} onChange={setQ} />
      <ul className="mt-2 divide-y divide-border">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.email}{p.organization ? `, ${p.organization}` : ""}</p>
            </div>
            <button onClick={() => go(p)} disabled={!!state[p.id]}
              className={cn("tap inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                state[p.id] === "sent" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground", state[p.id] === "busy" && "opacity-60")}>
              <Send className="size-3.5" />{state[p.id] === "sent" ? "Sent" : state[p.id] === "busy" ? "Sending" : "Send"}
            </button>
          </li>
        ))}
        {!rows.length && <li className="py-6 text-center text-sm text-muted-foreground">Nobody matches.</li>}
      </ul>
      {people.length > 50 && !q && <p className="pt-1 text-xs text-muted-foreground">Showing 50, search to find others.</p>}
    </section>
  );
}

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const Label = ({ children }: { children: string }) => <p className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground">{children}</p>;

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />;
}

function Chips({ options, selected, onToggle, scroll }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void; scroll?: boolean }) {
  if (!options.length) return <p className="text-xs text-muted-foreground">None on record yet.</p>;
  return (
    <div className={cn("flex flex-wrap gap-1.5", scroll && "max-h-28 overflow-y-auto")}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onToggle(o.value)}
          className={cn("tap rounded-full border border-border px-2.5 py-1 text-xs capitalize", selected.includes(o.value) && "border-primary bg-plate text-plate-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Segment({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex rounded-full bg-muted p-0.5">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)}
            className={cn("tap flex-1 rounded-full px-2 py-1 text-xs", value === v && "bg-card font-semibold shadow-sm")}>{l}</button>
        ))}
      </div>
    </div>
  );
}
