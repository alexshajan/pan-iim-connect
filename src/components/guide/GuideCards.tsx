import { useEffect, useRef, useState } from "react";
import { Bus, Car, Clock, ExternalLink, MessageCircle, Phone, Plane, Plus, TrainFront, TriangleAlert, Users } from "lucide-react";
import type { ArrivalPlan, Itinerary, TravelLeg } from "@/lib/guide";
import { hrs, inr, MODE_LABEL, range, type Cab } from "@/lib/guide-data";
import { cn } from "@/lib/utils";

const MODE_ICON: Record<string, typeof Plane> = { air: Plane, train: TrainFront, bus: Bus, helicopter: Plane };

type LegWithLinks = TravelLeg & { links?: { label: string; url: string }[] };

function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function ArrivalPlanCard({ plan, highlight, index = 0 }: { plan: Omit<ArrivalPlan, "legs"> & { legs: LegWithLinks[] }; highlight?: boolean | undefined; index?: number }) {
  const lo = useCountUp(plan.fareMin), hi = useCountUp(plan.fareMax);
  const [open, setOpen] = useState<number | null>(highlight ? 0 : null);
  return (
    <article style={{ animationDelay: `${index * 90}ms` }} className={cn("ticket-in overflow-hidden rounded-[var(--radius-pass)] bg-card shadow-card transition-shadow", highlight && "ring-2 ring-hills")}>
      <header className="flex items-baseline justify-between gap-3 bg-hills-soft px-4 py-3">
        <p className="text-[0.65rem] font-semibold text-hills">{plan.label}</p>
        <p className="text-display text-lg tabular-nums">{range(lo, hi)}</p>
      </header>
      <ol className="relative px-4 py-3">
        {plan.legs.map((l, i) => {
          const Icon = MODE_ICON[l.mode] ?? Car;
          return (
            <li key={l.id + i} className="relative flex gap-3 pb-3 last:pb-0">
              {i < plan.legs.length - 1 ? <span aria-hidden style={{ animationDelay: `${index * 90 + 200 + i * 160}ms` }} className="draw-down absolute top-8 bottom-0 left-[0.95rem] border-l-2 border-dashed border-hills/50" /> : null}
              <span style={{ animationDelay: `${index * 90 + 120 + i * 160}ms` }} className={cn("pop-in z-10 grid size-8 shrink-0 place-items-center rounded-full transition-colors", open === i ? "bg-hills text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setOpen(open === i ? null : i)} className="block w-full text-left text-sm font-semibold leading-tight">
                  {l.from_place} → {l.to_place}
                </button>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {MODE_LABEL[l.mode] ?? l.mode}, {hrs(l.duration_min)}, {range(l.fare_min, l.fare_max)}
                  {l.frequency ? `, ${l.frequency}` : ""}
                </p>
                <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                {l.notes ? <p className="mt-1 text-xs text-muted-foreground">{l.notes}</p> : null}
                {l.links?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {l.links.map((k) => (
                      <a key={k.url} href={k.url} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[0.68rem] font-semibold text-primary-foreground">
                        {k.label} <ExternalLink className="size-3" />
                      </a>
                    ))}
                  </div>
                ) : null}
                </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <footer className="flex items-center gap-1.5 border-t border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> About {hrs(plan.minutes)} door to campus, excluding waits
        {plan.overBudget ? <span className="ml-auto font-semibold text-destructive">Over budget</span> : null}
      </footer>
    </article>
  );
}

export function ItineraryCard({ it }: { it: Itinerary }) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-pass)] bg-card shadow-card">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h3 className="text-display text-[1.05rem] leading-snug">{it.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Back on campus by {it.returnBy}</p>
        </div>
        <div className="text-right">
          <p className="text-display text-lg">{inr(it.perPerson)}</p>
          <p className="text-[0.65rem] text-muted-foreground">per person, est.</p>
        </div>
      </header>
      <ol className="mt-3 space-y-0 px-4">
        <li className="flex items-center gap-3 pb-2 text-xs text-muted-foreground">
          <span className="w-11 shrink-0 ">Start</span> Campus
        </li>
        {it.stops.map((s) => (
          <li key={s.place.id} className="flex gap-3 border-t border-dashed border-border py-2.5">
            <span className="w-11 shrink-0 text-xs font-semibold">{s.arrive}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{s.place.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.driveIn} min drive, stay till {s.leave}
                {s.place.entry_fee ? `, ${inr(s.place.entry_fee)} entry` : ""}
              </p>
              {s.place.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{s.place.notes}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      <footer className="mt-1 space-y-1.5 bg-surface-muted px-4 py-3 text-xs">
        <p className="flex items-center gap-1.5">
          <Users className="size-3.5" /> {it.cabs} cab{it.cabs > 1 ? "s" : ""} ≈ {inr(it.cabCost)} total, entry {inr(it.entryPerPerson)} each
        </p>
        {it.warnings.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" /> {w}
          </p>
        ))}
      </footer>
    </article>
  );
}

export function CabCard({ cab }: { cab: Pick<Cab, "name" | "phone" | "whatsapp" | "vehicle" | "seats" | "languages" | "routes" | "notes"> }) {
  return (
    <article className="rounded-[var(--radius-pass)] bg-card px-4 py-3.5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{cab.name}</h3>
          <p className="text-xs text-muted-foreground">
            {cab.vehicle ?? "Cab"}, {cab.seats} seats{cab.languages.length ? `, ${cab.languages.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <a href={`tel:${cab.phone.replace(/\s/g, "")}`} aria-label={`Call ${cab.name}`} className="tap grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Phone className="size-4" />
          </a>
          {cab.whatsapp ? (
            <a href={`https://wa.me/${cab.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${cab.name}`} className="tap grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <MessageCircle className="size-4" />
            </a>
          ) : null}
        </div>
      </div>
      {cab.routes.length ? (
        <ul className="mt-2.5 space-y-1">
          {cab.routes.map((r) => (
            <li key={r.route} className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{r.route}</span>
              <span className="font-semibold">{inr(r.fare)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {cab.notes ? <p className="mt-2 text-[0.7rem] text-muted-foreground">{cab.notes}</p> : null}
    </article>
  );
}

export function CabDisclaimer() {
  return (
    <p className="rounded-2xl bg-surface-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      These drivers are shared as a community resource. IIM Shillong does not employ or vouch for them. Agree the fare
      before you start, and share your trip with a friend.
    </p>
  );
}

export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-pass)] border-2 border-dashed border-border px-4 py-3.5">
      <Plus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
