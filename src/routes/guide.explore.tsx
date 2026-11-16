import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Minus, Plus, Siren } from "lucide-react";
import { AppShell, EmptyNote, FilterChip, SectionHeading } from "@/components/AppShell";
import { ItineraryCard } from "@/components/guide/GuideCards";
import { GuideSubHeader } from "@/components/guide/GuideHeader";
import { DARK_BY, planItineraries, type ItineraryInput } from "@/lib/guide";
import { placesQuery } from "@/lib/guide-data";

export const Route = createFileRoute("/guide/explore")({
  head: () => ({
    meta: [
      { title: "Explore Shillong & Meghalaya, Pan-IIM 2026 Trip Planner" },
      { name: "description", content: "Plan a feasible half-day or day trip around Shillong and Meghalaya by time, group size, interests, effort and budget." },
      { property: "og:title", content: "Meghalaya trip planner, Pan-IIM 2026" },
      { property: "og:description", content: "Itineraries from places our team and local guides have vetted, with costs per person." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplorePage,
});

const TAGS = ["nature", "culture", "food", "shopping", "adventure"] as const;
const WINDOWS = [
  { key: "morning", label: "Morning", start: "07:00", end: "13:00" },
  { key: "afternoon", label: "After 2pm", start: "14:00", end: "19:00" },
  { key: "full", label: "Full day", start: "07:00", end: "18:00" },
];

function ExplorePage() {
  const places = useQuery(placesQuery);
  const [win, setWin] = useState("full");
  const [group, setGroup] = useState(2);
  const [tags, setTags] = useState<string[]>([]);
  const [effort, setEffort] = useState<ItineraryInput["maxEffort"]>("moderate");
  const [area, setArea] = useState<ItineraryInput["area"]>("any");
  const [budget, setBudget] = useState("");

  const w = WINDOWS.find((x) => x.key === win)!;
  const plans = useMemo(
    () =>
      places.data
        ? planItineraries(
            { start: w.start, end: w.end, groupSize: group, tags, maxEffort: effort, area, budgetPerPerson: budget ? Number(budget) : null },
            places.data,
          )
        : [],
    [places.data, w, group, tags, effort, area, budget],
  );

  return (
    <AppShell hero={<GuideSubHeader eyebrow="Tourism assistant" title="Explore Meghalaya" />}>
      <div className="space-y-4 rounded-[var(--radius-pass)] bg-card p-4 shadow-card">
        <Row label="When">
          {WINDOWS.map((x) => <FilterChip key={x.key} active={win === x.key} onClick={() => setWin(x.key)}>{x.label}</FilterChip>)}
        </Row>
        <Row label="Where">
          {(["any", "shillong", "beyond"] as const).map((a) => (
            <FilterChip key={a} active={area === a} onClick={() => setArea(a)}>{a === "any" ? "Anywhere" : a === "shillong" ? "In Shillong" : "Out of town"}</FilterChip>
          ))}
        </Row>
        <Row label="Into">
          {TAGS.map((t) => (
            <FilterChip key={t} active={tags.includes(t)} onClick={() => setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </FilterChip>
          ))}
        </Row>
        <Row label="Effort">
          {(["easy", "moderate", "hard"] as const).map((e) => (
            <FilterChip key={e} active={effort === e} onClick={() => setEffort(e)}>{e === "easy" ? "Easy" : e === "moderate" ? "Some steps" : "Trek ok"}</FilterChip>
          ))}
        </Row>
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="mb-1.5 block text-[0.68rem] font-semibold text-muted-foreground">People</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Fewer people" onClick={() => setGroup((g) => Math.max(1, g - 1))} className="tap grid size-9 place-items-center rounded-full bg-surface-muted"><Minus className="size-4" /></button>
              <span className="text-display w-6 text-center text-lg">{group}</span>
              <button type="button" aria-label="More people" onClick={() => setGroup((g) => Math.min(20, g + 1))} className="tap grid size-9 place-items-center rounded-full bg-surface-muted"><Plus className="size-4" /></button>
            </div>
          </div>
          <label className="block flex-1">
            <span className="mb-1.5 block text-[0.68rem] font-semibold text-muted-foreground">Budget / person ₹</span>
            <input inputMode="numeric" placeholder="optional" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className="h-11 w-full rounded-xl bg-surface-muted px-3 text-sm outline-none" />
          </label>
        </div>
      </div>

      <SectionHeading title={plans.length ? `${plans.length} plan${plans.length > 1 ? "s" : ""} that fit` : "Plans"} />
      {places.isLoading ? (
        <EmptyNote>Loading places…</EmptyNote>
      ) : plans.length ? (
        <div className="space-y-3">{plans.map((p) => <ItineraryCard key={p.title} it={p} />)}</div>
      ) : (
        <EmptyNote>Nothing fits that window before dark ({DARK_BY}). Try a longer window, more effort, or anywhere.</EmptyNote>
      )}
      <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
        Costs are estimates: entry fees plus a shared cab. Want it tweaked? <Link to="/guide" className="font-semibold text-foreground underline">Ask the Guide</Link>.
      </p>

      <SectionHeading title="If something goes wrong" />
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {[
          { label: "Police", n: "112" },
          { label: "Ambulance", n: "108" },
          { label: "Tourist help", n: "1363" },
        ].map((c) => (
          <a key={c.n} href={`tel:${c.n}`} className="tap flex flex-col items-center gap-1 rounded-2xl bg-card px-2 py-3 shadow-card">
            <Siren className="size-4 text-destructive" />
            <span className="font-semibold">{c.label}</span>
            <span className="text-muted-foreground">{c.n}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-[0.68rem] font-semibold text-muted-foreground">{label}</span>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">{children}</div>
    </div>
  );
}
