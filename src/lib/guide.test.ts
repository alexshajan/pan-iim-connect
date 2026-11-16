// @ts-expect-error bun provides this module at test time
import { describe, expect, it } from "bun:test";
import { cabCount, cabFare, guidePhase, planArrival, planItineraries, type Place, type TravelLeg } from "./guide";

const leg = (o: Partial<TravelLeg>): TravelLeg => ({
  id: Math.random().toString(36), kind: "main", from_place: "", to_place: "", mode: "air",
  fare_min: 0, fare_max: 0, duration_min: 0, frequency: null, notes: null, last_verified: null, ...o,
});
const LEGS = [
  leg({ from_place: "Delhi", to_place: "Guwahati", mode: "air", fare_min: 4500, fare_max: 9500, duration_min: 150 }),
  leg({ from_place: "Delhi", to_place: "Guwahati", mode: "train", fare_min: 1800, fare_max: 4800, duration_min: 1680 }),
  leg({ kind: "last_mile", from_place: "Guwahati Airport", to_place: "Shillong", mode: "cab", fare_min: 2800, fare_max: 3800, duration_min: 180 }),
  leg({ kind: "last_mile", from_place: "Guwahati Airport", to_place: "Shillong", mode: "shared_taxi", fare_min: 500, fare_max: 700, duration_min: 210 }),
  leg({ kind: "last_mile", from_place: "Guwahati Railway Station", to_place: "Shillong", mode: "bus", fare_min: 250, fare_max: 450, duration_min: 240 }),
  leg({ kind: "last_mile", from_place: "Shillong", to_place: "IIM Shillong campus", mode: "cab", fare_min: 400, fare_max: 700, duration_min: 35 }),
];

describe("guide phase", () => {
  it("is arrival until 26 Nov and tourism from 27 Nov (India time)", () => {
    expect(guidePhase(new Date("2026-11-26T18:00:00Z"))).toBe("arrival"); // 23:30 IST 26th
    expect(guidePhase(new Date("2026-11-26T18:31:00Z"))).toBe("tourism"); // 00:01 IST 27th
  });
});

describe("planArrival", () => {
  it("chains main leg, Guwahati→Shillong and Shillong→campus with summed fares", () => {
    const plans = planArrival({ from: "Delhi", modes: ["air"] }, LEGS);
    const cheapest = plans[0]!;
    expect(cheapest.label).toBe("Cheapest");
    expect(cheapest.legs.map((l) => l.mode)).toEqual(["air", "shared_taxi", "cab"]);
    expect(cheapest.fareMin).toBe(4500 + 500 + 400);
    expect(cheapest.fareMax).toBe(9500 + 700 + 700);
  });
  it("train arrivals use the railway-station last mile", () => {
    const plans = planArrival({ from: "delhi", modes: ["train"] }, LEGS);
    expect(plans[0]!.legs[1]!.from_place).toBe("Guwahati Railway Station");
  });
  it("respects the budget when any plan fits", () => {
    const plans = planArrival({ from: "Delhi", budget: 3000 }, LEGS);
    expect(plans.every((p) => !p.overBudget)).toBe(true);
    expect(plans[0]!.legs[0]!.mode).toBe("train");
  });
});

const place = (o: Partial<Place>): Place => ({
  id: Math.random().toString(36), name: "P", area: "shillong", region: "A", summary: null, tags: ["nature"],
  effort: "easy", drive_min: 40, visit_min: 60, opens: "08:00", closes: "17:00", entry_fee: 50, notes: null,
  no_atm: false, low_signal: false, step_free: true, closed: false, lat: null, lng: null, last_verified: null, ...o,
});

describe("planItineraries", () => {
  it("never schedules a return after dark for out-of-town trips", () => {
    const far = place({ name: "Far falls", area: "beyond", drive_min: 150, visit_min: 180 });
    const its = planItineraries({ start: "10:00", end: "20:00", groupSize: 2, area: "beyond" }, [far]);
    expect(its).toHaveLength(0); // 10:00 + 150 + 180 + 150 = 18:00 > 17:30
  });
  it("excludes places harder than the chosen effort and closed places", () => {
    const its = planItineraries({ start: "09:00", end: "17:00", groupSize: 1, maxEffort: "easy" }, [
      place({ name: "Trek", effort: "hard" }),
      place({ name: "Shut", closed: true }),
      place({ name: "Lake" }),
    ]);
    expect(its[0]!.stops.map((s) => s.place.name)).toEqual(["Lake"]);
  });
  it("splits cab cost across the group with one cab per 4 people", () => {
    expect(cabCount(5)).toBe(2);
    expect(cabFare(10)).toBe(600);
    const its = planItineraries({ start: "09:00", end: "17:00", groupSize: 4 }, [place({ entry_fee: 100 })]);
    const it0 = its[0]!;
    expect(it0.cabs).toBe(1);
    expect(it0.perPerson).toBe(Math.round(100 + it0.cabCost / 4));
  });
});
