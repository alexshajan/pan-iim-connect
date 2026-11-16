import { describe, expect, it } from "bun:test";
import { findScheduleClashes, groupClashes, istIso, snap, type BoardSession } from "./schedule-clash";

const s = (id: string, venue: string | null, start: string, end: string, extra: Partial<BoardSession> = {}): BoardSession => ({
  id, title: id, venue_id: venue, starts_at: `2026-11-27T${start}:00+05:30`, ends_at: `2026-11-27T${end}:00+05:30`, chair: null, status: "scheduled", ...extra,
});
const kinds = (l: BoardSession[]) => findScheduleClashes(l).map((c) => c.kind);

describe("schedule conflicts", () => {
  it("two in-person sessions in the same room overlap", () => {
    expect(kinds([s("a", null, "10:00", "11:00", { room: "G01" }), s("b", null, "10:30", "11:30", { room: "G01" })])).toEqual(["room"]);
  });
  it("back-to-back in one room is fine", () => {
    expect(kinds([s("a", null, "10:00", "11:00", { room: "G01" }), s("b", null, "11:00", "12:00", { room: "G01" })])).toEqual([]);
  });
  it("a paper session running alongside a plenary at the same venue is fine", () => {
    expect(kinds([s("panel", "lariti", "14:45", "15:45", { session_type: "panel" }), s("p", "lariti", "14:30", "15:45", { slot_code: "D1A", mode: "offline" })])).toEqual([]);
  });
  it("two plenaries overlapping in one hall clash", () => {
    expect(kinds([s("k1", "lariti", "13:00", "13:45"), s("k2", "lariti", "13:30", "14:00")])).toEqual(["hall"]);
  });
  it("online sessions never clash on rooms", () => {
    expect(kinds([s("a", null, "10:00", "11:00", { mode: "online" }), s("b", null, "10:00", "11:00", { mode: "online" })])).toEqual([]);
  });
  it("flags a person needed in two sessions at once", () => {
    expect(kinds([s("a", null, "10:00", "11:00", { chair: "Dr. Rao" }), s("b", null, "10:15", "11:00", { people: ["rao"] })])).toEqual(["person"]);
  });
  it("flags a session dragged out of its block window", () => {
    const blk = (id: string, st = "14:15", en = "15:45") => s(id, null, st, en, { slot_code: "D1A", mode: "online" });
    const c = findScheduleClashes([blk("a"), blk("b"), blk("c"), blk("d", "11:45", "13:15")]);
    expect(c.map((x) => [x.kind, x.a])).toEqual([["off-slot", "d"]]);
    expect(c[0]!.expected!.starts_at).toBe("2026-11-27T08:45:00.000Z");
  });
  it("flags an online session that holds a venue", () => {
    expect(kinds([s("a", "lariti", "10:00", "11:00", { mode: "online" })])).toEqual(["online-room"]);
  });
  it("ignores cancelled sessions", () => {
    expect(kinds([s("a", null, "10:00", "11:00", { room: "1" }), s("b", null, "10:00", "11:00", { room: "1", status: "cancelled" })])).toEqual([]);
  });
  it("groups severe conflicts first", () => {
    const g = groupClashes([{ kind: "off-slot", a: "x" }, { kind: "room", a: "a", b: "b" }]);
    expect(g.map((x) => x.kind)).toEqual(["room", "off-slot"]);
  });
  it("snaps to 5 minutes and builds India-time timestamps", () => {
    expect(snap(62)).toBe(60);
    expect(istIso("2026-11-27", 9 * 60 + 30)).toBe("2026-11-27T04:00:00.000Z");
  });
});
