import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Loader2, Link2, Plus, Trash2, Unlink, UserRound } from "lucide-react";
import { db, type Person } from "@/lib/registry-data";
import { cn } from "@/lib/utils";

export type EditorLink = { id: string; is_presenter: boolean; people: { id: string; full_name: string; email: string; organization: string | null; delegate_code: string } | null };
export type EditorPaper = {
  id: string; submission_code: string; title: string | null; track: string | null; presentation_mode: string;
  presenter_name: string | null; authors: { name: string; org?: string | null }[]; submission_people: EditorLink[];
};
type Row = { key: string; name: string; org: string; person_id: string | null; presenting: boolean };

export const normName = (n: string) => n.toLowerCase().replace(/^(dr|prof|mr|ms|mrs)\.?\s+/g, "").replace(/[^a-z]/g, "");

/** Build editable rows: each byline author matched to a linked profile by name; presenters from links or presenter_name. */
export function rowsFor(p: EditorPaper): { rows: Row[]; extra: EditorLink[] } {
  const used = new Set<string>();
  const named = (p.presenter_name ?? "").split(",").map((n) => normName(n)).filter(Boolean);
  const rows = (p.authors ?? []).map((a, i) => {
    const l = p.submission_people.find((x) => x.people && !used.has(x.people.id) && normName(x.people.full_name) === normName(a.name));
    if (l?.people) used.add(l.people.id);
    return { key: `a${i}`, name: a.name, org: a.org ?? "", person_id: l?.people?.id ?? null, presenting: l ? l.is_presenter : named.includes(normName(a.name)) };
  });
  return { rows, extra: p.submission_people.filter((l) => l.people && !used.has(l.people.id)) };
}

export function PaperEditor({ paper, people, onDone }: { paper: EditorPaper; people: Person[]; onDone: () => void }) {
  const init = useMemo(() => rowsFor(paper), [paper]);
  const [title, setTitle] = useState(paper.title ?? "");
  const [track, setTrack] = useState(paper.track ?? "");
  const [rows, setRows] = useState<Row[]>(init.rows);
  const [extra, setExtra] = useState(init.extra.map((l) => ({ link: l, presenting: l.is_presenter, keep: true })));
  const [linking, setLinking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ask, setAsk] = useState(false);
  const [askDel, setAskDel] = useState(false);
  const saveRef = useRef<() => void>(() => {});
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const set = (k: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setRows((r) => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const presenters = rows.filter((r) => r.presenting && r.name.trim()).length + extra.filter((e) => e.keep && e.presenting).length;

  const newProfiles = rows.filter((r) => r.presenting && !r.person_id && r.name.trim()).map((r) => r.name);
  const dropped = extra.filter((e) => !e.keep).map((e) => e.link.people?.full_name ?? "");

  // No window.confirm: it is silently blocked inside the preview frame, which made Save look dead.
  async function save(confirmed = false) {
    if (busy) return;
    if (rows.some((r) => !r.name.trim())) { toast.error("Every author needs a name, or remove the empty row"); return; }
    if (dropped.length && !confirmed) { setAsk(true); return; }
    setAsk(false);
    setBusy(true);
    const t = toast.loading(`Saving #${paper.submission_code}…`);
    try {
      const { error } = await db.rpc("save_paper_authors", {
        _submission: paper.id, _title: title, _track: track,
        _authors: rows.map((r) => ({ name: r.name.trim(), org: r.org.trim(), person_id: r.person_id, presenting: r.presenting })),
        _extra: extra.filter((e) => e.keep).map((e) => ({ person_id: e.link.people!.id, presenting: e.presenting })),
      });
      if (error) throw error;
      toast.success(`#${paper.submission_code} saved`, { id: t, description: [newProfiles.length ? `New profile: ${newProfiles.join(", ")}` : "", `${presenters} presenting`].filter(Boolean).join(" · ") });
      setDone(true);
      setTimeout(onDone, 650);
    } catch (e) {
      toast.error("Couldn't save", { id: t, description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
    } finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    const t = toast.loading(`Deleting #${paper.submission_code}…`);
    try {
      const { data, error } = await db.rpc("delete_paper", { _submission: paper.id });
      if (error) throw error;
      const n = (data as { now_remote?: number } | null)?.now_remote ?? 0;
      toast.success(`#${paper.submission_code} deleted`, { id: t, description: n ? `${n} author${n > 1 ? "s" : ""} no longer coming to campus` : "Removed from the programme" });
      setDone(true);
      setTimeout(onDone, 400);
    } catch (e) {
      toast.error("Couldn't delete", { id: t, description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
    } finally { setBusy(false); }
  }
  saveRef.current = () => void save();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveRef.current(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-6 pt-12 sm:px-6">
      <div>
        <p className="text-xs font-bold tabular-nums text-muted-foreground">#{paper.submission_code} · {paper.presentation_mode === "online" ? "Online" : "In person"}</p>
        <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-medium" placeholder="Title" />
        <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track" className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Authors, in byline order</h3>
          <span className={cn("text-xs", presenters ? "text-muted-foreground" : "font-semibold text-warn-foreground")}>{presenters ? `${presenters} presenting` : "No presenter yet"}</span>
        </div>
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const p = r.person_id ? byId.get(r.person_id) : null;
            return (
              <li key={r.key} className={cn("rounded-lg border p-2.5 transition-colors duration-200 animate-in fade-in", r.presenting ? "border-primary/60 bg-primary/5" : "border-border")}>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <input value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Author name" className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="tap rounded p-1 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" className="tap rounded p-1 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                  <button onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label={`Remove ${r.name}`} className="tap rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>
                <input value={r.org} onChange={(e) => set(r.key, { org: e.target.value })} placeholder="Institution" className="mt-1.5 ml-5.5 w-[calc(100%-1.375rem)] rounded-md border border-border bg-card px-2 py-1 text-xs" />
                <div className="mt-1.5 ml-5.5 flex flex-wrap items-center gap-2">
                  <label className="tap inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
                    <input type="checkbox" checked={r.presenting} onChange={(e) => set(r.key, { presenting: e.target.checked })} className="accent-primary" /> Presenting
                  </label>
                  {p ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <UserRound className="size-3" /> {p.full_name} · {p.delegate_code}{p.email.endsWith(".invalid") ? " · no email" : ""}
                      <button onClick={() => set(r.key, { person_id: null })} aria-label="Unlink profile" className="ml-0.5 hover:text-destructive"><Unlink className="size-3" /></button>
                    </span>
                  ) : (
                    <button onClick={() => setLinking(linking === r.key ? null : r.key)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Link2 className="size-3" /> {r.presenting ? "New profile on save, or link existing" : "Link a profile"}
                    </button>
                  )}
                </div>
                {linking === r.key ? <PersonPicker people={people} seed={r.name} onPick={(pp) => { set(r.key, { person_id: pp.id }); setLinking(null); }} /> : null}
              </li>
            );
          })}
        </ol>
        <button onClick={() => setRows((r) => [...r, { key: `n${Date.now()}`, name: "", org: "", person_id: null, presenting: false }])}
          className="tap mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm">
          <Plus className="size-4" /> Add author
        </button>
      </section>

      {extra.length ? (
        <section>
          <h3 className="text-sm font-semibold">Linked, not on the byline</h3>
          <p className="mb-2 text-xs text-muted-foreground">Usually the person who registered or paid. Keep them linked, or unlink.</p>
          <ul className="space-y-1.5">
            {extra.map((e, i) => (
              <li key={e.link.id} className={cn("flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm", !e.keep && "opacity-50 line-through")}>
                <span className="min-w-0 flex-1 truncate">{e.link.people?.full_name} <span className="text-xs text-muted-foreground">{e.link.people?.delegate_code}</span></span>
                <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" disabled={!e.keep} checked={e.presenting} onChange={(ev) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, presenting: ev.target.checked } : y)))} className="accent-primary" /> Presenting</label>
                <button onClick={() => { setRows((r) => [...r, { key: `x${e.link.id}`, name: e.link.people!.full_name, org: e.link.people!.organization ?? "", person_id: e.link.people!.id, presenting: e.presenting }]); setExtra((x) => x.filter((_, j) => j !== i)); }}
                  className="text-xs text-primary hover:underline" disabled={!e.keep}>Add to byline</button>
                <button onClick={() => setExtra((x) => x.map((y, j) => (j === i ? { ...y, keep: !y.keep } : y)))} className="text-xs text-muted-foreground hover:text-destructive">{e.keep ? "Unlink" : "Undo"}</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {newProfiles.length || paper.presentation_mode === "offline" ? (
        <div className="space-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {newProfiles.length ? <p><span className="font-semibold text-foreground">On save:</span> new profile for {newProfiles.join(", ")}.</p> : null}
          {paper.presentation_mode === "offline" ? <p>Presenters are marked as coming to campus. Anyone no longer presenting in person leaves discovery and the card list, unless they hold a card role.</p> : null}
        </div>
      ) : null}

      </div>
      <div className="shrink-0 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        {askDel ? (
          <div className="mb-2 animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
            <p className="font-semibold">Delete #{paper.submission_code} for good?</p>
            <p className="mt-0.5 text-muted-foreground">It leaves the programme, sessions and slides. Authors with no other in-person paper and no card role stop being marked as coming to campus, so they drop off the ID card list.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void remove()} disabled={busy} className="tap inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1 font-semibold text-destructive-foreground">{busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Delete paper</button>
              <button type="button" onClick={() => setAskDel(false)} className="tap rounded-full border border-border px-3 py-1">Keep</button>
            </div>
          </div>
        ) : null}
        {ask ? (
          <div className="mb-2 animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
            <p>Unlink {dropped.join(", ")} from #{paper.submission_code}?</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void save(true)} className="tap rounded-full bg-destructive px-3 py-1 font-semibold text-destructive-foreground">Unlink and save</button>
              <button type="button" onClick={() => setAsk(false)} className="tap rounded-full border border-border px-3 py-1">Back</button>
            </div>
          </div>
        ) : null}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setAsk(false); setAskDel((v) => !v); }} disabled={busy || done} aria-label="Delete paper" title="Delete paper" className="tap rounded-full border border-border px-3 py-2 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"><Trash2 className="size-4" /></button>
          <button type="button" onClick={onDone} disabled={busy} className="tap flex-1 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={busy || done}
            className={cn("tap inline-flex flex-[2] items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground transition-all duration-300 active:scale-[0.97]", done ? "bg-primary scale-[1.02]" : "bg-primary", busy && "opacity-80")}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : done ? <><Check className="size-4 animate-in zoom-in" /> Saved</> : <>Save paper <kbd className="hidden text-[0.65rem] font-normal opacity-70 sm:inline">Ctrl ↵</kbd></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonPicker({ people, seed, onPick }: { people: Person[]; seed: string; onPick: (p: Person) => void }) {
  const [q, setQ] = useState(seed.replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, ""));
  const t = q.trim().toLowerCase();
  const hits = t.length < 2 ? [] : people.filter((p) => p.full_name.toLowerCase().includes(t) || p.email.toLowerCase().includes(t) || p.delegate_code.toLowerCase().includes(t)).slice(0, 8);
  return (
    <div className="mt-2 ml-5.5 rounded-md border border-border bg-card p-2">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or WMC code" className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
      <ul className="mt-1 max-h-48 overflow-y-auto">
        {hits.map((p) => (
          <li key={p.id}><button onClick={() => onPick(p)} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-muted">
            <span className="font-medium">{p.full_name}</span> <span className="text-muted-foreground">{p.delegate_code} · {p.organization ?? p.email}</span>
          </button></li>
        ))}
        {t.length >= 2 && !hits.length ? <li className="px-2 py-1 text-xs text-muted-foreground">No match. Tick Presenting and save to create a profile.</li> : null}
      </ul>
    </div>
  );
}
