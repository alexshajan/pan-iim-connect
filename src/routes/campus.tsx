import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigation, Phone, ExternalLink, Utensils, Clock } from "lucide-react";
import { AppShell, EmptyNote, FilterChip, PillTag, SectionHeading } from "@/components/AppShell";
import { pinsQuery } from "@/lib/conference";
import {
  campusServicesQuery,
  currentOrNextMeal,
  messMealsQuery,
  SERVICE_CATEGORIES,
  type CampusService,
  type MessMeal,
} from "@/lib/campus";
import { CAMPUS, directionsUrl, embedUrl } from "@/lib/maps";
import { dayLabel, dayKey, relativeToNow, timeOf, rangeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CampusNavigator } from "@/components/campus/CampusNavigator";

export const Route = createFileRoute("/campus")({
  head: () => ({
    meta: [
      { title: "Campus: Map, Mess Menu & Services, Pan-IIM 2026" },
      {
        name: "description",
        content:
          "Navigate the IIM Shillong campus, see what the mess is serving at every meal, and reach campus services, food delivery, laundry, medical, shuttle and the help desk.",
      },
      { property: "og:title", content: "Campus, 11th Pan-IIM WMC 2026" },
      {
        property: "og:description",
        content: "Venues with one-tap directions, the full mess menu, and every campus service.",
      },
    ],
  }),
  component: CampusPage,
});

const TABS = [
  { key: "places", label: "Places" },
  { key: "mess", label: "Mess menu" },
  { key: "services", label: "Services" },
] as const;

function CampusPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("places");

  return (
    <AppShell eyebrow="IIM Shillong, Umsawli" title="Campus">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TABS.map((t) => (
          <FilterChip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </FilterChip>
        ))}
      </div>

      <div className="mt-4">
        {tab === "places" ? <Places /> : null}
        {tab === "mess" ? <Mess /> : null}
        {tab === "services" ? <Services /> : null}
      </div>
    </AppShell>
  );
}

/* ---------------------------------- Places --------------------------------- */

const PLACE_CATEGORIES = [
  { key: "all", label: "Everything" },
  { key: "venue", label: "Session venues" },
  { key: "residence", label: "Stay" },
  { key: "dining", label: "Eat" },
  { key: "help", label: "Help desk" },
  { key: "medical", label: "Medical" },
  { key: "transport", label: "Transport" },
  { key: "parking", label: "Parking" },
];

function Places() {
  const [venue, setVenue] = useState<string | undefined>();
  useEffect(() => {
    setVenue(new URLSearchParams(window.location.search).get("venue") ?? undefined);
  }, []);
  return <CampusNavigator initialId={venue} />;
}

export function LegacyPlaces() {
  const pins = useQuery(pinsQuery);
  const [category, setCategory] = useState("all");
  const [focus, setFocus] = useState<{ lat: number; lng: number; name: string }>({
    ...CAMPUS,
    name: CAMPUS.label,
  });
  const list = (pins.data ?? []).filter((p) => category === "all" || p.category === category);

  return (
    <div>
      <div className="card-surface overflow-hidden">
        <iframe
          title={`Map of ${focus.name}`}
          className="h-60 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl(focus.lat, focus.lng)}
        />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{focus.name}</span>
          </p>
          <a
            href={directionsUrl(focus.lat, focus.lng, focus.name)}
            target="_blank"
            rel="noreferrer"
            className="tap shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
          >
            Walk me there
          </a>
        </div>
      </div>

      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {PLACE_CATEGORIES.map((c) => (
          <FilterChip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
            {c.label}
          </FilterChip>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {pins.isLoading ? (
          <EmptyNote>Loading places…</EmptyNote>
        ) : list.length ? (
          list.map((p) => {
            const active = focus.name === p.name;
            return (
              <div
                key={p.id}
                className={cn(
                  "card-surface flex items-start gap-3 px-5 py-4",
                  active && "ring-2 ring-primary/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => setFocus({ lat: p.lat, lng: p.lng, name: p.name })}
                  className="min-w-0 flex-1 text-left"
                >
                  <h3 className="text-display text-[1rem] leading-snug">{p.name}</h3>
                  {p.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  ) : null}
                  <p className="mt-1.5 text-[0.7rem] font-semibold text-primary">
                    {active ? "Shown on the map above" : "Tap to preview on the map"}
                  </p>
                </button>
                <a
                  href={directionsUrl(p.lat, p.lng, p.name)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Walking directions to ${p.name}`}
                  className="tap rounded-full border border-border p-2.5 text-primary"
                >
                  <Navigation className="h-4 w-4" strokeWidth={1.9} />
                </a>
              </div>
            );
          })
        ) : (
          <EmptyNote>Nothing pinned in this category yet.</EmptyNote>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------- Mess ---------------------------------- */

function Mess() {
  const meals = useQuery(messMealsQuery);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const all = meals.data ?? [];
  const days = [...new Set(all.map((m) => dayKey(m.starts_at)))];
  const todayKey = dayKey(now.toISOString());
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day && days.includes(day) ? day : (days.find((d) => d >= todayKey) ?? days[0]);
  const list = all.filter((m) => dayKey(m.starts_at) === activeDay);
  const next = currentOrNextMeal(all, now);

  if (meals.isLoading) return <EmptyNote>Loading the menu…</EmptyNote>;
  if (!all.length) return <EmptyNote>The mess menu hasn&apos;t been published yet.</EmptyNote>;

  return (
    <div>
      {next ? (
        <div className="rise rounded-[var(--radius)] bg-primary px-6 py-6 text-primary-foreground">
          <p className="text-[0.68rem] font-semibold opacity-75">
            {next.serving ? "Serving now" : "Next meal"}
          </p>
          <p className="text-display mt-2 text-[1.55rem] leading-[1.1]">
            {next.meal.meal}, {next.meal.highlight}
          </p>
          <p className="mt-2 text-sm opacity-85">
            {rangeLabel(next.meal.starts_at, next.meal.ends_at)} , {" "}
            {next.serving
              ? `ends ${relativeToNow(next.meal.ends_at, now)}`
              : relativeToNow(next.meal.starts_at, now)}
          </p>
          {next.meal.location_name ? (
            <p className="mt-1 text-sm opacity-75">{next.meal.location_name}</p>
          ) : null}
        </div>
      ) : null}

      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {days.map((d) => (
          <FilterChip key={d} active={activeDay === d} onClick={() => setDay(d)}>
            {dayLabel(`${d}T06:00:00Z`)}
          </FilterChip>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {list.map((m) => (
          <MealCard key={m.id} meal={m} now={now} />
        ))}
      </div>

      <p className="mt-4 px-1 text-xs text-muted-foreground">
        Dietary needs, allergies or a packed meal for an early flight? Tell the help desk a day
        ahead and the mess will arrange it.
      </p>
    </div>
  );
}

function MealCard({ meal, now }: { meal: MessMeal; now: Date }) {
  const serving =
    now.getTime() >= new Date(meal.starts_at).getTime() &&
    now.getTime() <= new Date(meal.ends_at).getTime();
  const cancelled = meal.status === "cancelled";

  return (
    <div className={cn("card-surface px-5 py-4", cancelled && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Utensils className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
            <h3 className="text-display text-[1.05rem] leading-snug">{meal.meal}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {timeOf(meal.starts_at)} – {timeOf(meal.ends_at)}
            {meal.location_name ? `, ${meal.location_name}` : ""}
          </p>
        </div>
        {cancelled ? (
          <PillTag tone="destructive">Cancelled</PillTag>
        ) : serving ? (
          <PillTag tone="live">Serving</PillTag>
        ) : null}
      </div>

      <p className="mt-2.5 text-sm font-medium">{meal.highlight}</p>

      {meal.items.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {meal.items.map((item) => (
            <span
              key={item}
              className="rounded-full bg-surface-muted px-2.5 py-1 text-[0.72rem] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {meal.tags.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {meal.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-2.5 py-0.5 text-[0.66rem] font-semibold text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {meal.note ? <p className="mt-2.5 text-xs text-muted-foreground">{meal.note}</p> : null}
    </div>
  );
}

/* --------------------------------- Services -------------------------------- */

function Services() {
  const services = useQuery(campusServicesQuery);
  const [category, setCategory] = useState("all");
  const list = (services.data ?? []).filter(
    (s) => category === "all" || s.category === category,
  );
  const present = new Set((services.data ?? []).map((s) => s.category));
  const cats = SERVICE_CATEGORIES.filter((c) => c.key === "all" || present.has(c.key));

  return (
    <div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {cats.map((c) => (
          <FilterChip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
            {c.label}
          </FilterChip>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {services.isLoading ? (
          <EmptyNote>Loading services…</EmptyNote>
        ) : list.length ? (
          list.map((s) => <ServiceCard key={s.id} service={s} />)
        ) : (
          <EmptyNote>Nothing listed here yet.</EmptyNote>
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: CampusService }) {
  return (
    <div className="card-surface px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-display text-[1.05rem] leading-snug">{service.name}</h3>
        {service.featured ? <PillTag tone="primary">Popular</PillTag> : null}
      </div>
      {service.description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {service.description}
        </p>
      ) : null}
      {service.hours ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" strokeWidth={2.2} /> {service.hours}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {service.action_url ? (
          <a
            href={service.action_url}
            target="_blank"
            rel="noreferrer"
            className="tap inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            {service.action_label ?? "Open"}
          </a>
        ) : null}
        {service.phone ? (
          <a
            href={`tel:${service.phone.replace(/\s/g, "")}`}
            className="tap inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold"
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={2} /> {service.phone}
          </a>
        ) : null}
        {service.lat != null && service.lng != null ? (
          <a
            href={directionsUrl(service.lat, service.lng, service.name)}
            target="_blank"
            rel="noreferrer"
            className="tap inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold"
          >
            <Navigation className="h-3.5 w-3.5" strokeWidth={2} /> Directions
          </a>
        ) : null}
      </div>
    </div>
  );
}
