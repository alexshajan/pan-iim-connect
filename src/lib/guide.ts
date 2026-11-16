/**
 * Guide planners, pure and deterministic. The AI assistant calls these as tools;
 * it may choose and explain, but every place, fare and time comes from here.
 */

export type TravelLeg = {
  id: string;
  kind: "main" | "last_mile" | string;
  from_place: string;
  to_place: string;
  mode: string;
  fare_min: number;
  fare_max: number;
  duration_min: number;
  frequency: string | null;
  notes: string | null;
  last_verified: string | null;
};

export type Place = {
  id: string;
  name: string;
  area: "shillong" | "beyond" | string;
  region: string | null;
  summary: string | null;
  tags: string[];
  effort: "easy" | "moderate" | "hard" | string;
  drive_min: number;
  visit_min: number;
  opens: string;
  closes: string;
  entry_fee: number;
  notes: string | null;
  no_atm: boolean;
  low_signal: boolean;
  step_free: boolean;
  closed: boolean;
  lat: number | null;
  lng: number | null;
  last_verified: string | null;
};

/* ---------- phase ---------- */

export const CONFERENCE_START = "2026-11-27";
export const CONFERENCE_END = "2026-11-29";

/** India-time calendar date for an instant. */
export function istDate(now: Date) {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
export function guidePhase(now: Date): "arrival" | "tourism" {
  return istDate(now) < CONFERENCE_START ? "arrival" : "tourism";
}

/** Days older than this are flagged "may be outdated". */
export const STALE_DAYS = 45;
export function isStale(lastVerified: string | null, now: Date) {
  if (!lastVerified) return true;
  return now.getTime() - new Date(lastVerified).getTime() > STALE_DAYS * 86_400_000;
}

/* ---------- arrival ---------- */

export type ArrivalInput = { from: string; modes?: string[] | undefined; budget?: number | null | undefined };
export type ArrivalPlan = {
  label: string;
  legs: TravelLeg[];
  fareMin: number;
  fareMax: number;
  minutes: number;
  overBudget: boolean;
};

const norm = (s: string) => s.trim().toLowerCase();
const matches = (a: string, b: string) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));

function cheapest(legs: TravelLeg[]) {
  return [...legs].sort((a, b) => a.fare_max - b.fare_max)[0];
}
function fastest(legs: TravelLeg[]) {
  return [...legs].sort((a, b) => a.duration_min - b.duration_min)[0];
}

/** Last-mile chains from where the main leg lands to campus. */
function lastMileChains(arrivePoint: string, mode: string, all: TravelLeg[]): TravelLeg[][] {
  const lm = all.filter((l) => l.kind === "last_mile");
  const toCampus = (from: string) => lm.filter((l) => matches(l.from_place, from) && /campus/i.test(l.to_place));
  if (/umroi/i.test(arrivePoint)) return toCampus("Umroi").map((l) => [l]);
  const hub = mode === "train" ? "Guwahati Railway" : "Guwahati Airport";
  const toShillong = lm.filter((l) => matches(l.from_place, hub) && norm(l.to_place) === "shillong");
  const finalHop = cheapest(toCampus("Shillong"));
  const chains: TravelLeg[][] = [];
  for (const leg of toShillong) chains.push(finalHop ? [leg, finalHop] : [leg]);
  return chains;
}

export function planArrival(input: ArrivalInput, legs: TravelLeg[]): ArrivalPlan[] {
  const modes = input.modes?.length ? input.modes.map(norm) : null;
  const mains = legs.filter(
    (l) => l.kind === "main" && matches(l.from_place, input.from) && (!modes || modes.includes(norm(l.mode))),
  );
  // From the Northeast or unknown origin: start at Guwahati airport.
  const starts: { main: TravelLeg | null; chains: TravelLeg[][] }[] = mains.length
    ? mains.map((m) => ({ main: m, chains: lastMileChains(m.to_place, m.mode, legs) }))
    : [{ main: null, chains: lastMileChains("Guwahati", "air", legs) }];

  const all: ArrivalPlan[] = [];
  for (const s of starts) {
    for (const chain of s.chains) {
      const parts = s.main ? [s.main, ...chain] : chain;
      const fareMin = parts.reduce((t, l) => t + l.fare_min, 0);
      const fareMax = parts.reduce((t, l) => t + l.fare_max, 0);
      all.push({
        label: "",
        legs: parts,
        fareMin,
        fareMax,
        minutes: parts.reduce((t, l) => t + l.duration_min, 0),
        overBudget: input.budget != null && fareMin > input.budget,
      });
    }
  }
  const pool = all.filter((p) => !p.overBudget).length ? all.filter((p) => !p.overBudget) : all;
  const byCost = [...pool].sort((a, b) => a.fareMax - b.fareMax);
  const byTime = [...pool].sort((a, b) => a.minutes - b.minutes);
  const picked = new Set<ArrivalPlan>();
  const out: ArrivalPlan[] = [];
  const add = (p: ArrivalPlan | undefined, label: string) => {
    if (!p || picked.has(p)) return;
    picked.add(p);
    out.push({ ...p, label });
  };
  add(byCost[0], "Cheapest");
  add(byTime.find((p) => !picked.has(p)), "Fastest");
  add([...pool].sort((a, b) => a.fareMax * a.minutes - b.fareMax * b.minutes).find((p) => !picked.has(p)), "Balanced");
  return out;
}

/** Leave Guwahati by this time to reach Shillong before dark (hill road). */
export const LAST_SAFE_GUWAHATI_DEPARTURE = "14:30";

/* ---------- tourism ---------- */

export type ItineraryInput = {
  start: string; // HH:MM
  end: string; // HH:MM
  groupSize: number;
  tags?: string[] | undefined;
  maxEffort?: "easy" | "moderate" | "hard" | undefined;
  area?: "shillong" | "beyond" | "any" | undefined;
  budgetPerPerson?: number | null | undefined;
};
export type Stop = { place: Place; arrive: string; leave: string; driveIn: number };
export type Itinerary = {
  title: string;
  stops: Stop[];
  returnBy: string;
  cabs: number;
  cabCost: number;
  entryPerPerson: number;
  perPerson: number;
  warnings: string[];
};

/** Late November: sunset ~16:50 in Shillong. Be back on campus roads by this. */
export const DARK_BY = "17:30";
const EFFORT = { easy: 0, moderate: 1, hard: 2 } as const;
const CAB_SEATS = 4;
const CAB_RATE_PER_MIN = 15;
const CAB_MIN_FARE = 600;

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

function hop(prev: Place | null, next: Place) {
  if (!prev) return next.drive_min;
  if (prev.region && prev.region === next.region) return 20;
  return Math.abs(prev.drive_min - next.drive_min) + 30;
}

export function cabCount(group: number) {
  return Math.max(1, Math.ceil(group / CAB_SEATS));
}
export function cabFare(driveMinutes: number) {
  return Math.max(CAB_MIN_FARE, Math.round((driveMinutes * CAB_RATE_PER_MIN) / 50) * 50);
}

export function eligiblePlaces(input: ItineraryInput, places: Place[]) {
  const max = EFFORT[input.maxEffort ?? "hard"];
  return places.filter(
    (p) =>
      !p.closed &&
      (EFFORT[p.effort as keyof typeof EFFORT] ?? 0) <= max &&
      (!input.area || input.area === "any" || p.area === input.area),
  );
}

function score(p: Place, tags: string[]) {
  const hits = tags.length ? p.tags.filter((t) => tags.includes(t)).length : 1;
  return hits * 100 - p.drive_min / 10;
}

function build(seed: Place, pool: Place[], input: ItineraryInput): Itinerary | null {
  const startM = toMin(input.start);
  const endM = Math.min(toMin(input.end), toMin(DARK_BY) + (pool.every((p) => p.area === "shillong") ? 180 : 0));
  const tags = input.tags ?? [];
  const ordered = [seed, ...pool.filter((p) => p !== seed).sort((a, b) => score(b, tags) - score(a, tags))];
  const stops: Stop[] = [];
  let t = startM;
  let driving = 0;
  let prev: Place | null = null;
  for (const p of ordered) {
    if (tags.length && !p.tags.some((x) => tags.includes(x)) && p !== seed) continue;
    const drive = hop(prev, p);
    const arrive = Math.max(t + drive, toMin(p.opens));
    const leave = arrive + p.visit_min;
    const back = leave + p.drive_min;
    if (leave > toMin(p.closes) || back > endM) continue;
    stops.push({ place: p, arrive: fromMin(arrive), leave: fromMin(leave), driveIn: drive });
    driving += drive;
    t = leave;
    prev = p;
  }
  if (!stops.length || !prev) return null;
  driving += prev.drive_min;
  const groupSize = Math.max(1, input.groupSize);
  const cabs = cabCount(groupSize);
  const cabCost = cabs * cabFare(driving);
  const entryPerPerson = stops.reduce((s, x) => s + x.place.entry_fee, 0);
  const perPerson = Math.round(entryPerPerson + cabCost / groupSize);
  const warnings: string[] = [];
  if (stops.some((s) => s.place.no_atm)) warnings.push("No ATM at some stops, carry cash.");
  if (stops.some((s) => s.place.low_signal)) warnings.push("Weak phone signal on the way, download offline maps.");
  if (stops.some((s) => s.place.effort !== "easy")) warnings.push("Includes steps or trails, wear good shoes.");
  if (input.budgetPerPerson != null && perPerson > input.budgetPerPerson)
    warnings.push(`About ₹${perPerson - input.budgetPerPerson} over your budget per person.`);
  return {
    title: stops.map((s) => s.place.name).slice(0, 2).join(" + "),
    stops,
    returnBy: fromMin(t + prev.drive_min),
    cabs,
    cabCost,
    entryPerPerson,
    perPerson,
    warnings,
  };
}

/** Up to 3 distinct feasible itineraries, each seeded by a different best-fit place. */
export function planItineraries(input: ItineraryInput, places: Place[]): Itinerary[] {
  const pool = eligiblePlaces(input, places);
  const tags = input.tags ?? [];
  const seeds = [...pool]
    .filter((p) => !tags.length || p.tags.some((t) => tags.includes(t)))
    .sort((a, b) => score(b, tags) - score(a, tags));
  const out: Itinerary[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    const it = build(seed, pool, input);
    if (!it) continue;
    const key = it.stops.map((s) => s.place.id).sort().join();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length === 3) break;
  }
  const within = out.filter((i) => input.budgetPerPerson == null || i.perPerson <= input.budgetPerPerson);
  return (within.length ? within : out).sort((a, b) => b.stops.length - a.stops.length);
}

/* ---------- deep links (no paid fare API) ---------- */

const IATA: Record<string, string> = {
  delhi: "DEL", mumbai: "BOM", kolkata: "CCU", bengaluru: "BLR", bangalore: "BLR",
  chennai: "MAA", hyderabad: "HYD", pune: "PNQ", ahmedabad: "AMD", lucknow: "LKO",
  guwahati: "GAU", shillong: "SHL", "shillong (umroi)": "SHL",
};
export function iata(city: string) {
  return IATA[norm(city)] ?? null;
}
/** date: YYYY-MM-DD */
export function bookingLinks(leg: TravelLeg, date?: string) {
  const from = iata(leg.from_place);
  const to = iata(leg.to_place);
  if (leg.mode === "air" && from && to) {
    const d = date ? date.split("-").reverse().join("/") : "";
    return [
      { label: "Google Flights", url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`flights from ${from} to ${to}${date ? ` on ${date}` : ""}`)}` },
      { label: "MakeMyTrip", url: `https://www.makemytrip.com/flight/search?itinerary=${from}-${to}-${d}&tripType=O&paxType=A-1_C-0_I-0&cabinClass=E` },
    ];
  }
  if (leg.mode === "train") return [{ label: "IRCTC", url: "https://www.irctc.co.in/nget/train-search" }];
  if (leg.mode === "helicopter") return [{ label: "Pawan Hans", url: "https://www.pawanhans.co.in/" }];
  return [];
}
