import { describe, expect, test } from "vitest";
import { venuePoint } from "./maps";

describe("venuePoint", () => {
  test("Admin Block rooms go to the Admin Block, not old placeholder coords", () => {
    expect(venuePoint({ name: "Main Auditorium, Academic Block", lat: 25.6751, lng: 91.9155 })).toMatchObject({ lat: 25.616056, lng: 91.954139 });
  });
  test("NAB rooms go to the New Academic Block", () => {
    expect(venuePoint({ name: "NAB Room 104", lat: null, lng: null })).toMatchObject({ lat: 25.616948, lng: 91.953143 });
  });
  test("offsite venues keep their own coordinates", () => {
    expect(venuePoint({ name: "Hotel Polo Towers", kind: "offsite", lat: 25.5697, lng: 91.8836 })).toMatchObject({ lat: 25.5697 });
  });
});
