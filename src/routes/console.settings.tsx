import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/registry-data";
import { PageHead } from "./console";
import { modulesQuery } from "@/hooks/useModules";
import { ATMOSPHERE_LABELS, type AtmosphereSetting } from "@/lib/atmosphere";
import { atmosphereQuery, ShillongNowCard } from "@/components/home/atmosphere/ShillongNowCard";
import { ALL_ON, MODULE_LABELS, PHASE_1, type ModuleFlags, type ModuleKey } from "@/lib/modules";

export const Route = createFileRoute("/console/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const s = useQuery({
    queryKey: ["settings", "deck_grouping"],
    queryFn: async () => {
      const { data } = await db.from("console_settings").select("value").eq("key", "deck_grouping").maybeSingle();
      return (data?.value as string) ?? "room";
    },
  });
  async function set(v: string) {
    const { error } = await db.from("console_settings").upsert({ key: "deck_grouping", value: v, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }
  return (
    <>
      <PageHead eyebrow="Admin" title="Settings" />
      <ModuleSwitches />
      <AtmospherePicker />
      <section className="card-surface mt-4 max-w-xl px-5 py-4">
        <h2 className="text-sm font-medium">Deck drive folders</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">How room volunteers see slide folders by default.</p>
        <div className="mt-3 flex gap-2">
          {["room", "track", "day"].map((v) => (
            <button key={v} onClick={() => set(v)} className={`tap rounded-full border border-border px-3 py-1 text-sm capitalize ${s.data === v ? "bg-plate text-plate-foreground" : ""}`}>
              By {v}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ModuleSwitches() {
  const qc = useQueryClient();
  const flags = useQuery(modulesQuery).data ?? PHASE_1;
  async function save(next: ModuleFlags) {
    const { error } = await db.from("console_settings").upsert({ key: "modules", value: next, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Guests will see this within a minute");
    qc.invalidateQueries({ queryKey: modulesQuery.queryKey });
  }
  return (
    <section className="card-surface max-w-xl px-5 py-4">
      <h2 className="text-sm font-medium">Sections guests can see</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Home, Calendar and Me are always on. Hidden sections vanish from tabs and links; organizers still see everything.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => save(PHASE_1)} className="tap rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Phase 1 preset</button>
        <button onClick={() => save(ALL_ON)} className="tap rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Open everything</button>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((k) => (
          <li key={k} className="flex items-center justify-between py-2.5 text-sm">
            <span>{MODULE_LABELS[k]}</span>
            <button
              role="switch"
              aria-checked={flags[k]}
              onClick={() => save({ ...flags, [k]: !flags[k] })}
              className={`tap rounded-full px-3 py-1 text-xs font-semibold ${flags[k] ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {flags[k] ? "Visible" : "Hidden"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AtmospherePicker() {
  const qc = useQueryClient();
  const cur = useQuery(atmosphereQuery).data ?? "auto";
  const now = new Date();
  async function save(v: AtmosphereSetting) {
    const { error } = await db.from("console_settings").upsert({ key: "atmosphere_card", value: v, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Home card updated");
    qc.invalidateQueries({ queryKey: atmosphereQuery.queryKey });
  }
  const opts: { v: AtmosphereSetting; hint: string }[] = [
    { v: "barometer", hint: "Tap through temperature, air and sunset" },
    { v: "ridge", hint: "Live sky over the hills, swipe for a breeze" },
    { v: "scrubber", hint: "Drag through today, see what to wear" },
    { v: "auto", hint: "A different one each day" },
  ];
  return (
    <section className="card-surface mt-4 max-w-3xl px-5 py-4">
      <h2 className="text-sm font-medium">Shillong card on Home</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">The live weather card next to the countdown. Try each one below before choosing.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {opts.map((o) => (
          <div key={o.v} className={`rounded-[var(--radius)] border p-3 ${cur === o.v ? "border-primary bg-primary/5" : "border-border"}`}>
            {o.v !== "auto" ? <ShillongNowCard now={now} force={o.v} /> : <div className="grid h-[5.25rem] place-items-center rounded-[var(--radius)] bg-secondary text-xs text-muted-foreground">Rotates barometer, ridge, scrubber</div>}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="min-w-0"><span className="block text-sm font-semibold">{ATMOSPHERE_LABELS[o.v]}</span><span className="block text-xs text-muted-foreground">{o.hint}</span></span>
              <button onClick={() => save(o.v)} className={`tap shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cur === o.v ? "bg-primary text-primary-foreground" : "border border-border"}`}>{cur === o.v ? "Showing" : "Use this"}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
