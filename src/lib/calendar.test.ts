// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import type { Session } from "./conference";
import { buildDayStream, nowIndex, onlyMine } from "./calendar";

const s = (id: string, type: string, start: string, end: string): Session => ({
  id, title: id, summary: null, session_type: type, track_id: null, venue_id: null,
  starts_at: `2026-11-27T${start}:00+05:30`, ends_at: `2026-11-27T${end}:00+05:30`,
  chair: null, capacity: null, status: "scheduled", status_note: null,
});

const day = [
  s("keynote", "keynote", "09:00", "10:00"),
  s("tea", "break", "10:00", "10:30"),
  s("roomA", "paper", "10:30", "12:00"),
  s("roomB", "paper", "10:30", "12:00"),
];

describe("calendar stream", () => {
  test("parallel rooms collapse into one row", () => {
    const rows = buildDayStream(day, new Set());
    expect(rows.map((r) => r.kind)).toEqual(["common", "pause", "parallel"]);
  });
  test("two picks in the same slot is a clash", () => {
    const row = buildDayStream(day, new Set(["roomA", "roomB"]))[2]!;
    expect(row.kind === "parallel" && row.clash).toBe(true);
  });
  test("my plan keeps keynotes and my room, drops breaks and unpicked slots", () => {
    expect(onlyMine(buildDayStream(day, new Set()), new Set()).length).toBe(1);
    expect(onlyMine(buildDayStream(day, new Set(["roomA"])), new Set(["roomA"])).length).toBe(2);
  });
  test("now points at the running row", () => {
    const rows = buildDayStream(day, new Set());
    expect(nowIndex(rows, new Date("2026-11-27T10:10:00+05:30"))).toBe(1);
    expect(nowIndex(rows, new Date("2026-11-27T13:00:00+05:30"))).toBe(-1);
  });
});
