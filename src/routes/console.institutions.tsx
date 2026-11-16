import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Pencil } from "lucide-react";
import { db } from "@/lib/registry-data";
import { cn } from "@/lib/utils";
import { PageHead } from "./console";

export const Route = createFileRoute("/console/institutions")({ component: InstitutionsPage });

type Alias = { raw: string; canonical: string; method: string };

const aliasesQuery = queryOptions({
  queryKey: ["registry", "institution-aliases"],
  queryFn: async () => {
    const [a, p] = await Promise.all([
      db.from("institution_aliases").select("raw, canonical, method").order("canonical"),
      db.from("people").select("organization_raw").eq("is_placeholder", false).not("organization_raw", "is", null).range(0, 4999),
    ]);
    if (a.error) throw a.error;
    const uses = new Map<string, number>();
    for (const r of (p.data ?? []) as { organization_raw: string }[]) uses.set(r.organization_raw, (uses.get(r.organization_raw) ?? 0) + 1);
    return { aliases: (a.data ?? []) as Alias[], uses };
  },
});

/** Every raw institution spelling from the sheets and the standard name it maps to. */
function InstitutionsPage() {
  const qc = useQueryClient();
  const { data } = useQuery(aliasesQuery);
  const [q, setQ] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const groups = useMemo(() => {
    const m = new Map<string, Alias[]>();
    for (const a of data?.aliases ?? []) m.set(a.canonical, [...(m.get(a.canonical) ?? []), a]);
    return [...m.entries()].map(([canonical, list]) => ({ canonical, list, people: list.reduce((n, a) => n + (data?.uses.get(a.raw) ?? 0), 0) }));
  }, [data]);
  const names = groups.map((g) => g.canonical);

  const t = q.trim().toLowerCase();
  const shown = groups
    .filter((g) => !onlyChanged || g.list.some((a) => a.raw !== g.canonical))
    .filter((g) => !t || g.canonical.toLowerCase().includes(t) || g.list.some((a) => a.raw.toLowerCase().includes(t)))
    .sort((a, b) => b.people - a.people);

  async function save(raw: string) {
    const canonical = draft.trim();
    if (!canonical) return;
    const a = await db.from("institution_aliases").update({ canonical, method: "manual", updated_at: new Date().toISOString() }).eq("raw", raw);
    const p = await db.from("people").update({ organization: canonical }).eq("organization_raw", raw);
    if (a.error || p.error) toast.error((a.error ?? p.error).message);
    else {
      toast.success(`"${raw}" now shows as ${canonical}`);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["registry"] });
    }
  }

  return (
    <>
      <PageHead eyebrow={`${groups.length} institutions, ${data?.aliases.length ?? 0} spellings`} title="Institutions" />
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
        Each spelling from the registration sheets maps to one standard name, which is what guests see. Edit a spelling to move it to another
        name, everyone with that spelling updates.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search institution or spelling" className="w-full max-w-sm rounded-full border border-border bg-card px-4 py-2 text-sm" />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /> Only names we standardised
        </label>
      </div>
      <datalist id="inst-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <ul className="grid gap-2.5 lg:grid-cols-2">
        {shown.slice(0, 200).map((g) => (
          <li key={g.canonical} className="card-surface px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{g.canonical}</p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{g.people} people</span>
            </div>
            <ul className="mt-2 space-y-1">
              {g.list.map((a) => (
                <li key={a.raw} className="flex items-center gap-2 text-xs">
                  {editing === a.raw ? (
                    <>
                      <span className="shrink-0 text-muted-foreground">{a.raw} →</span>
                      <input autoFocus list="inst-names" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save(a.raw)}
                        className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1" />
                      <button onClick={() => save(a.raw)} aria-label="Save" className="rounded-full bg-primary p-1 text-primary-foreground"><Check className="size-3" /></button>
                    </>
                  ) : (
                    <>
                      <span className={cn("min-w-0 flex-1 truncate", a.raw === g.canonical && "text-muted-foreground")}>{a.raw}</span>
                      <span className="text-muted-foreground">{data?.uses.get(a.raw) ?? 0}</span>
                      <span className={cn("rounded-full px-1.5 text-[0.62rem]", a.method === "manual" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                        {a.method === "manual" ? "edited" : a.method === "auto" || a.method === "standardized" ? "standardized" : "as typed"}
                      </span>
                      <button onClick={() => { setEditing(a.raw); setDraft(g.canonical); }} aria-label={`Change ${a.raw}`}><Pencil className="size-3" /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
