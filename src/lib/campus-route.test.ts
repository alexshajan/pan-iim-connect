// @ts-expect-error bun provides this module at test time
import { describe, expect, it } from "bun:test";
import { minutesFor, walkRoute } from "./campus-route";
import { LANDMARKS } from "./landmarks";

const L = (id: string) => LANDMARKS.find((l) => l.id === id)!;

describe("campus walking router", () => {
  it("starts and ends exactly at the chosen places", () => {
    const r = walkRoute(L("admin"), L("mess"));
    expect(r.path[0]).toEqual([L("admin").lat, L("admin").lng]);
    expect(r.path.at(-1)).toEqual([L("mess").lat, L("mess").lng]);
  });
  it("is never shorter than the straight line", () => {
    const r = walkRoute(L("admin"), L("hostel-3"));
    expect(r.meters).toBeGreaterThan(700);
  });
  it("walking pace is 65 metres per minute, at least 1 minute", () => {
    expect(minutesFor(650)).toBe(10);
    expect(minutesFor(10)).toBe(1);
  });
});
