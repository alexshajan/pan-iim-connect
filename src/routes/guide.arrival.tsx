import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell, EmptyNote, FilterChip, SectionHeading } from "@/components/AppShell";
import { ArrivalPlanCard, ComingSoon } from "@/components/guide/GuideCards";
import { GuideSubHeader } from "@/components/guide/GuideHeader";
import { bookingLinks, CONFERENCE_START, guidePhase, isStale, LAST_SAFE_GUWAHATI_DEPARTURE, planArrival } from "@/lib/guide";
import { legsQuery } from "@/lib/guide-data";

export const Route = createFileRoute("/guide/arrival")({
  head: () => ({
    meta: [
      { title: "Plan your arrival at IIM Shillong, Pan-IIM 2026" },
      { name: "description", content: "Door-to-campus travel plans to IIM Shillong with flights, trains, Guwahati–Shillong cabs and estimated fares." },
      { property: "og:title", content: "Plan your arrival, Pan-IIM 2026" },
      { property: "og:description", content: "Cheapest, fastest and balanced routes to IIM Shillong with estimated costs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArrivalPage,
});

const MODES = [
  { key: "air", label: "Flight" },
  { key: "train", label: "Train" },
];

function ArrivalPage() {
  const legs = useQuery(legsQuery);
  const archived = guidePhase(new Date()) === "tourism";
  const origins = useMemo(
    () => [...new Set((legs.data ?? []).filter((l) => l.kind === "main").map((l) => l.from_place))],
    [legs.data],
  );
  const [from, setFrom] = useState("");
  const [modes, setModes] = useState<string[]>([]);
  const [date, setDate] = useState("2026-11-26");
  const [budget, setBudget] = useState("");

  const plans = useMemo(() => {
    if (!from || !legs.data) return [];
    return planArrival({ from, modes, budget: budget ? Number(budget) : null }, legs.data).map((p) => ({
      ...p,
      legs: p.legs.map((l) => ({ ...l, links: bookingLinks(l, date) })),
    }));
  }, [from, modes, budget, date, legs.data]);
  const stale = plans.some((p) => p.legs.some((l) => isStale(l.last_verified, new Date())));
  const sample = (legs.data ?? []).some((l) => l.is_placeholder);

  return (
    <AppShell
      hero={
        <GuideSubHeader eyebrow={archived ? "Archive, Departures too" : "Arrival assistant"} title={archived ? "Travel plans" : "Getting to campus"}>
          {archived ? <p className="mt-2 text-sm text-muted-foreground">The conference is on. Use this to plan your trip home, routes work in reverse.</p> : null}
        </GuideSubHeader>
      }
    >
      <div className="space-y-4 rounded-[var(--radius-pass)] bg-card p-4 shadow-card">
        <Field label="Coming from">
          <div className="no-scrollbar -mx-1 flex flex-wrap gap-2 px-1">
            {[...origins, "Guwahati"].map((o, i) => (
              <button key={o} type="button" onClick={() => setFrom(o === from ? "" : o)} style={{ animationDelay: `${i * 40}ms` }}
                className={`pop-in tap rounded-full border px-3.5 py-2 text-sm transition-all duration-300 ${from === o ? "border-hills bg-hills text-primary-foreground shadow-card" : "border-border bg-surface-muted"}`}>
                {o === "Guwahati" ? "Already in the Northeast" : o}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Travel by (optional)">
          <div className="flex gap-2">
            {MODES.map((m) => (
              <FilterChip key={m.key} active={modes.includes(m.key)} onClick={() => setModes((s) => (s.includes(m.key) ? s.filter((x) => x !== m.key) : [...s, m.key]))}>
                {m.label}
              </FilterChip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Travel date">
            <input type="date" value={date} max={CONFERENCE_START} onChange={(e) => setDate(e.target.value)} className="h-11 w-full rounded-xl bg-surface-muted px-3 text-sm outline-none" />
          </Field>
          <Field label="Budget ₹ (optional)">
            <input inputMode="numeric" placeholder="e.g. 12000" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className="h-11 w-full rounded-xl bg-surface-muted px-3 text-sm outline-none" />
          </Field>
        </div>
      </div>

      {from ? (
        <>
          <SectionHeading title={`${plans.length} plan${plans.length === 1 ? "" : "s"} from ${from === "Guwahati" ? "the Northeast" : from}`} />
          {plans.length ? (
            <div className="space-y-3">
              {plans.map((p, i) => <ArrivalPlanCard key={`${from}-${p.label}`} plan={p} highlight={i === 0} index={i} />)}
            </div>
          ) : (
            <EmptyNote>No verified routes from {from} yet. Ask the Guide or the help desk.</EmptyNote>
          )}
          <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
            Fares are typical ranges collected by the organizing team, not live prices.
            {sample ? " Sample figures are shown until the team publishes verified data." : ""}
            {stale ? " Some figures were checked a while ago." : ""}
          </p>
        </>
      ) : null}

      <SectionHeading title="Before you go" />
      <div className="rounded-[var(--radius-pass)] bg-hills-soft px-4 py-4">
        <ul className="space-y-2 text-sm">
          {[
            `Leave Guwahati for Shillong by ${LAST_SAFE_GUWAHATI_DEPARTURE}, hill roads get dark by 5 pm.`,
            "Carry a photo ID and some cash; card and UPI can fail on the highway.",
            "Download offline Google Maps for Guwahati–Shillong.",
            "Pack warm layers: late-November evenings drop to about 8°C.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-hills" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <SectionHeading title="Also" />
      <div className="space-y-3">
        <Link to="/guide/cabs" className="press block rounded-[var(--radius-pass)] bg-card px-4 py-3.5 text-sm font-semibold shadow-card">
          Cab contacts and fare asks →
        </Link>
        <ComingSoon title="Cab pooling" body="Find others arriving at the same time and share a cab. Coming soon." />
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.68rem] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
