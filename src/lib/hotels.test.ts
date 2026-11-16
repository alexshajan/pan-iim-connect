import { describe, expect, it } from "bun:test";
import { HOTELS, filterHotels, fromRate } from "./hotels";

describe("partner hotels", () => {
  it("lists all 21 institute partners", () => expect(HOTELS.length).toBe(21));
  it("sorts nearest first by default", () => expect(filterHotels(HOTELS, "all", "", "distance")[0].id).toBe("leikyrpad"));
  it("budget keeps only rates up to 2,500", () => {
    const l = filterHotels(HOTELS, "budget", "", "price");
    expect(l.every((h) => (fromRate(h) ?? 99999) <= 2500)).toBe(true);
    expect(l[0].id).toBe("zostel");
  });
  it("near campus means within 4.5 km", () => expect(filterHotels(HOTELS, "near", "", "distance").every((h) => h.km <= 4.5)).toBe(true));
  it("hotels without rates sort last by price", () => {
    const l = filterHotels(HOTELS, "all", "", "price");
    expect(fromRate(l[l.length - 1])).toBeNull();
  });
});
