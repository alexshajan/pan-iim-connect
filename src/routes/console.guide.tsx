import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { cabsQuery, legsQuery, placesQuery, promptsQuery } from "@/lib/guide-data";
import { isStale } from "@/lib/guide";
import { cn } from "@/lib/utils";
import { PageHead, useConsoleAccess } from "./console";

export const Route = createFileRoute("/console/guide")({ component: GuideConsole });

type TableKey = "travel_legs" | "tourism_places" | "cab_drivers" | "guide_prompts";

/** Spreadsheet column templates. Lists use ";" and cab routes use "Route=Fare;Route=Fare". */
const TEMPLATES: Record<TableKey, Record<string, string | number>> = {
  travel_legs: { kind: "main", from_place: "Delhi", to_place: "Guwahati", mode: "air", fare_min: 4500, fare_max: 9500, duration_min: 150, frequency: "Daily", notes: "", last_verified: "2026-10-18" },
  tourism_places: { name: "Ward's Lake", area: "shillong", region: "Central Shillong", summary: "", tags: "nature;culture", effort: "easy", drive_min: 35, visit_min: 45, opens: "08:30", closes: "17:00", entry_fee: 30, notes: "", no_atm: "false", low_signal: "false", step_free: "true", lat: "", lng: "", last_verified: "2026-10-18" },
  cab_drivers: { name: "", phone: "", whatsapp: "", vehicle: "Innova", seats: 6, languages: "English;Hindi", routes: "Guwahati Airport → Campus=3800", notes: "" },
  guide_prompts: { text: "", module: "any", sort_order: 1 },
};
const NUM = new Set(["fare_min", "fare_max", "duration_min", "drive_min", "visit_min", "entry_fee", "seats", "sort_order", "lat", "lng"]);
const BOOL = new Set(["no_atm", "low_signal", "step_free", "closed", "active"]);
const LIST = new Set(["tags", "languages"]);

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function toRow(table: TableKey, r: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!(k in TEMPLATES[table])) continue;
    if (v === "") continue;
    if (NUM.has(k)) out[k] = Number(v);
    else if (BOOL.has(k)) out[k] = /^(true|yes|1)$/i.test(v);
    else if (LIST.has(k)) out[k] = v.split(";").map((s) => s.trim()).filter(Boolean);
    else if (k === "routes") out[k] = v.split(";").map((s) => { const [route, fare] = s.split("="); return { route: route?.trim(), fare: Number(fare) }; });
    else out[k] = v;
  }
  return out;
}

const TABS: { key: TableKey; label: string }[] = [
  { key: "travel_legs", label: "Routes & fares" },
  { key: "tourism_places", label: "Places" },
  { key: "cab_drivers", label: "Cab drivers" },
  { key: "guide_prompts", label: "Suggested prompts" },
];

function GuideConsole() {
  const { canEdit } = useConsoleAccess();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TableKey>("travel_legs");
  const legs = useQuery(legsQuery);
  const places = useQuery(placesQuery);
  const cabs = useQuery(cabsQuery);
  const prompts = useQuery(promptsQuery);
  const refresh = () => qc.invalidateQueries({ queryKey: ["guide"] });
  const now = new Date();

  async function importFile(file: File) {
    const rows = parseCsv(await file.text()).map((r) => toRow(tab, r));
    if (!rows.length) { toast.error("No rows found in that file."); return; }
    const { error } = await supabase.from(tab).insert(rows as never);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${rows.length} rows`);
    refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from(tab).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function toggle(id: string, field: "active" | "closed", value: boolean) {
    const { error } = await supabase.from(tab as "cab_drivers").update({ [field]: value } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function clearSamples() {
    if (!confirm("Remove all sample routes, places and drivers?")) return;
    const { error } = await supabase.rpc("clear_guide_placeholders");
    if (error) { toast.error(error.message); return; }
    toast.success("Sample data removed");
    refresh();
  }

  const rows: { id: string; title: string; sub: string; sample: boolean; stale?: boolean; toggle?: { field: "active" | "closed"; on: boolean; label: string } }[] =
    tab === "travel_legs"
      ? (legs.data ?? []).map((l) => ({ id: l.id, title: `${l.from_place} → ${l.to_place}`, sub: `${l.mode}, ₹${l.fare_min}–${l.fare_max}, ${l.duration_min} min`, sample: l.is_placeholder, stale: isStale(l.last_verified, now) }))
      : tab === "tourism_places"
        ? (places.data ?? []).map((p) => ({ id: p.id, title: p.name, sub: `${p.area}, ${p.effort}, ${p.drive_min} min, ₹${p.entry_fee}`, sample: p.is_placeholder, stale: isStale(p.last_verified, now), toggle: { field: "closed", on: p.closed, label: p.closed ? "Closed" : "Open" } }))
        : tab === "cab_drivers"
          ? (cabs.data ?? []).map((c) => ({ id: c.id, title: c.name, sub: `${c.phone}, ${c.vehicle ?? ""}, ${c.routes.length} routes`, sample: c.is_placeholder, toggle: { field: "active", on: c.active, label: c.active ? "Listed" : "Hidden" } }))
          : (prompts.data ?? []).map((p) => ({ id: p.id, title: p.text, sub: p.module, sample: false }));

  return (
    <>
      <PageHead eyebrow="Arrival & Tourism" title="Guide data">
        {canEdit ? (
          <button onClick={clearSamples} className="tap rounded-full border border-border bg-card px-4 py-2 text-sm">Remove sample data</button>
        ) : null}
      </PageHead>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Everything the Guide assistant and planners say comes from these lists. Import a spreadsheet (CSV) per list, download the
        template to see the columns. Items older than 45 days are marked for re-checking.
      </p>
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("tap shrink-0 rounded-full px-4 py-2 text-sm", tab === t.key ? "bg-primary text-primary-foreground" : "bg-card")}>
            {t.label}
          </button>
        ))}
      </div>
      {canEdit ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => downloadCsv(`${tab}-template.csv`, [TEMPLATES[tab]])} className="tap rounded-full bg-secondary px-4 py-2 text-sm">Download template</button>
          <label className="tap cursor-pointer rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
            Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
          </label>
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-card">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="truncate text-xs text-muted-foreground">{r.sub}</p>
            </div>
            {r.sample ? <span className="rounded-full bg-warn px-2 py-0.5 text-[0.65rem] font-semibold text-warn-foreground">Sample</span> : null}
            {r.stale ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem]">Re-check</span> : null}
            {r.toggle && canEdit ? (
              <button onClick={() => toggle(r.id, r.toggle!.field, !r.toggle!.on)} className="tap rounded-full border border-border px-3 py-1 text-xs">{r.toggle.label}</button>
            ) : null}
            {canEdit ? (
              <button aria-label="Delete" onClick={() => confirm("Delete this item?") && remove(r.id)} className="tap text-muted-foreground"><Trash2 className="size-4" /></button>
            ) : null}
          </li>
        ))}
        {!rows.length ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet.</li> : null}
      </ul>
    </>
  );
}
