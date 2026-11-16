import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Loader2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseTimetable } from "@/lib/schedule-import.functions";
import { matchRows, rowEndIso, rowStartIso, type MatchedRow, type Match } from "@/lib/schedule-import";
import { canEditRegistry } from "@/lib/console-access";
import { PageHead, useConsoleAccess } from "./console";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/console/schedule/import")({ component: ImportPage });

type Batch = { id: string; at: string; added: string[]; updated: { id: string; starts_at: string; ends_at: string; venue_id: string | null; track_id: string | null; chair: string | null; title: string }[] };
const LS = "schedule-import-batches";
const loadBatches = (): Batch[] => { try { return JSON.parse(localStorage.getItem(LS) ?? "[]"); } catch { return []; } };

function Dot({ m }: { m: Match }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", m.confidence === "exact" ? "bg-primary" : m.confidence === "close" ? "bg-amber-500" : "bg-destructive")} />;
}

async function toBase64(f: File) {
  const buf = new Uint8Array(await f.arrayBuffer());
  let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

function ImportPage() {
  const { roles } = useConsoleAccess();
  const parse = useServerFn(parseTimetable);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"read" | "apply" | null>(null);
  const [rows, setRows] = useState<(MatchedRow & { skip?: boolean })[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  useEffect(() => setBatches(loadBatches()), []);

  if (!canEditRegistry(roles)) return <p className="text-sm text-muted-foreground">Only admins and editors can import timetables.</p>;

  async function onFile(f: File) {
    setBusy("read"); setRows([]);
    try {
      let payload: { fileName: string; mediaType: string; base64?: string; text?: string };
      if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer());
        const text = wb.SheetNames.map((n) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!)}`).join("\n\n");
        payload = { fileName: f.name, mediaType: "text/csv", text };
      } else if (f.type === "application/pdf" || f.type.startsWith("image/")) {
        payload = { fileName: f.name, mediaType: f.type, base64: await toBase64(f) };
      } else {
        throw new Error("Use a PDF, image, Excel or CSV file");
      }
      const res = await parse({ data: payload });
      if (res.error) throw new Error(res.error);
      const [v, t, s, sub] = await Promise.all([
        supabase.from("venues").select("id,name,short_name"),
        supabase.from("tracks").select("id,name"),
        supabase.from("sessions").select("id,title,starts_at,ends_at,venue_id,chair"),
        supabase.from("submissions").select("id,submission_code,title"),
      ]);
      const matched = matchRows(res.rows, {
        venues: (v.data ?? []).map((x) => ({ id: x.id, name: x.name, alt: x.short_name })),
        tracks: t.data ?? [], sessions: s.data ?? [], subs: sub.data ?? [],
      });
      setRows(matched);
      if (!matched.length) toast("No sessions found in that file");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  }

  async function apply() {
    setBusy("apply");
    const batch: Batch = { id: `imp-${Date.now()}`, at: new Date().toISOString(), added: [], updated: [] };
    const venueCache = new Map<string, string>(), trackCache = new Map<string, string>();
    async function ensure(table: "venues" | "tracks", m: Match, raw: string | null, cache: Map<string, string>) {
      if (m.id) return m.id;
      if (!raw?.trim()) return null;
      const k = raw.trim().toLowerCase();
      if (cache.has(k)) return cache.get(k)!;
      const { data, error } = await supabase.from(table).insert({ name: raw.trim() }).select("id").single();
      if (error) throw error;
      cache.set(k, data.id); return data.id;
    }
    try {
      for (const r of rows) {
        if (r.skip || r.action === "same") continue;
        const venue_id = await ensure("venues", r.venueMatch, r.venue, venueCache);
        const track_id = await ensure("tracks", r.trackMatch, r.track, trackCache);
        const fields = { title: r.title, starts_at: rowStartIso(r), ends_at: rowEndIso(r), venue_id, track_id, chair: r.chair };
        let sid: string;
        if (r.sessionMatch.id) {
          const { data: prev } = await supabase.from("sessions").select("id,starts_at,ends_at,venue_id,track_id,chair,title").eq("id", r.sessionMatch.id).single();
          if (prev) batch.updated.push(prev);
          const { error } = await supabase.from("sessions").update(fields).eq("id", r.sessionMatch.id);
          if (error) throw error;
          sid = r.sessionMatch.id;
        } else {
          const { data, error } = await supabase.from("sessions").insert({ ...fields, import_batch: batch.id }).select("id").single();
          if (error) throw error;
          sid = data.id; batch.added.push(sid);
          if (r.papers.length) {
            const { error: pe } = await supabase.from("papers").insert(r.papers.map((p, i) => ({ session_id: sid, title: p.title, authors: p.authors ?? "", slot_order: i, import_batch: batch.id })));
            if (pe) throw pe;
          }
        }
        const subIds = r.paperMatches.filter((m) => m.id && m.confidence === "exact").map((m) => m.id!);
        if (subIds.length) await supabase.from("submissions").update({ session_id: sid }).in("id", subIds);
      }
      const next = [batch, ...loadBatches()].slice(0, 10);
      localStorage.setItem(LS, JSON.stringify(next)); setBatches(next);
      toast.success(`Applied: ${batch.added.length} added, ${batch.updated.length} updated`);
      setRows([]);
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  }

  async function undoBatch(b: Batch) {
    if (!confirm("Undo this import? Added sessions are deleted and updated ones go back to how they were.")) return;
    if (b.added.length) await supabase.from("sessions").delete().eq("import_batch", b.id);
    for (const u of b.updated) { const { id, ...rest } = u; await supabase.from("sessions").update(rest).eq("id", id); }
    const next = loadBatches().filter((x) => x.id !== b.id);
    localStorage.setItem(LS, JSON.stringify(next)); setBatches(next);
    qc.invalidateQueries();
    toast.success("Import undone");
  }

  const counts = { add: rows.filter((r) => !r.skip && r.action === "add").length, update: rows.filter((r) => !r.skip && r.action === "update").length, same: rows.filter((r) => r.action === "same").length };
  const edit = (i: number, patch: Partial<MatchedRow & { skip?: boolean }>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <PageHead eyebrow="Schedule" title="Import a timetable">
        <Link to="/console/schedule" className="tap inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm"><ArrowLeft className="size-4" /> Board</Link>
      </PageHead>

      <label className={cn("card-surface flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-10 text-center", busy && "pointer-events-none opacity-60")}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
        {busy === "read" ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6 text-muted-foreground" />}
        <span className="text-sm font-medium">{busy === "read" ? "Reading the timetable…" : "Drop a PDF, photo, Excel or CSV timetable"}</span>
        <span className="text-xs text-muted-foreground">The AI reads it, then you check every row before anything changes.</span>
        <input type="file" className="hidden" accept=".pdf,image/*,.xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </label>

      {rows.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span><b>{counts.add}</b> to add</span><span><b>{counts.update}</b> to change</span><span className="text-muted-foreground">{counts.same} unchanged</span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Dot m={{ id: "x", label: null, confidence: "exact" }} />exact</span>
              <span className="flex items-center gap-1"><Dot m={{ id: "x", label: null, confidence: "close" }} />close, check</span>
              <span className="flex items-center gap-1"><Dot m={{ id: null, label: null, confidence: "new" }} />new</span>
            </span>
            <button disabled={!!busy || !(counts.add + counts.update)} onClick={apply} className="tap ml-auto rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
              {busy === "apply" ? "Applying…" : "Apply"}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Use</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Session</th><th className="px-3 py-2">Room</th><th className="px-3 py-2">Track</th><th className="px-3 py-2">Chair</th><th className="px-3 py-2">Papers</th><th className="px-3 py-2">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={i} className={cn(r.skip && "opacity-40")}>
                    <td className="px-3 py-2"><input type="checkbox" checked={!r.skip} onChange={(e) => edit(i, { skip: !e.target.checked })} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{r.date.slice(5)} {r.start}–{r.end}</td>
                    <td className="px-3 py-2">
                      <input className="w-full bg-transparent outline-none" value={r.title} onChange={(e) => edit(i, { title: e.target.value })} />
                      {r.sessionMatch.id && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Dot m={r.sessionMatch} /> matches “{r.sessionMatch.label}”</p>}
                    </td>
                    <td className="px-3 py-2"><span className="flex items-center gap-1.5"><Dot m={r.venueMatch} />{r.venueMatch.label ?? r.venue ?? ""}</span></td>
                    <td className="px-3 py-2"><span className="flex items-center gap-1.5"><Dot m={r.trackMatch} />{r.trackMatch.label ?? r.track ?? ""}</span></td>
                    <td className="px-3 py-2"><input className="w-full bg-transparent outline-none" value={r.chair ?? ""} onChange={(e) => edit(i, { chair: e.target.value || null })} /></td>
                    <td className="px-3 py-2">
                      {r.papers.map((p, k) => (
                        <p key={k} className="flex items-center gap-1.5 text-xs"><Dot m={r.paperMatches[k]!} /><span className="truncate">{r.paperMatches[k]?.label ? `${r.paperMatches[k]!.label}, ` : ""}{p.title}</span></p>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium">{r.action === "add" ? "Add" : r.action === "update" ? "Change" : "Same"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {batches.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium">Recent imports on this device</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {batches.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2">
                <span className="text-xs text-muted-foreground">{new Date(b.at).toLocaleString("en-IN")}</span>
                <span>{b.added.length} added, {b.updated.length} changed</span>
                <button onClick={() => undoBatch(b)} className="tap ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs"><Undo2 className="size-3.5" /> Undo</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
