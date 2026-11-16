// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { PHASE_1, parseModules, pathAllowed } from "./modules";

describe("module visibility", () => {
  test("missing settings fall back to Phase 1 (network hidden)", () => {
    expect(parseModules(null).network).toBe(false);
    expect(parseModules(undefined)).toEqual(PHASE_1);
  });
  test("saved flags override defaults", () => {
    expect(parseModules({ network: true }).network).toBe(true);
  });
  test("guests cannot open a hidden module", () => {
    expect(pathAllowed("/network/people", PHASE_1, false)).toBe(false);
    expect(pathAllowed("/guide/arrival", PHASE_1, false)).toBe(false);
  });
  test("Now, Calendar and Me always open", () => {
    for (const p of ["/", "/calendar", "/me"]) expect(pathAllowed(p, PHASE_1, false)).toBe(true);
  });
  test("launch drop: papers open while the rest of Network stays hidden", () => {
    expect(pathAllowed("/papers", PHASE_1, false)).toBe(true);
    expect(pathAllowed("/network", PHASE_1, false)).toBe(false);
  });
  test("organizers can preview hidden modules", () => {
    expect(pathAllowed("/network", PHASE_1, true)).toBe(true);
  });
});
