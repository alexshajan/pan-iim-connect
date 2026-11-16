// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { freeSlots, myAgendaItems } from "./my-agenda";
import type { Session } from "./conference";

const s = (id: string, type: string, start: string, end: string, chair: string | null = null, everyone = false) =>
  ({ id, title: id, session_type: type, starts_at: start, ends_at: end, chair, in_everyone_plan: everyone } as unknown as Session);

const day = "2026-11-27";
const all = [
  s("key", "keynote", `${day}T03:30:00Z`, `${day}T04:30:00Z`, null, true),
  s("lunch", "meal", `${day}T06:30:00Z`, `${day}T07:30:00Z`),
  s("p1", "paper", `${day}T05:00:00Z`, `${day}T06:00:00Z`),
  s("p2", "paper", `${day}T05:00:00Z`, `${day}T06:00:00Z`, "Dr. Asha Rao"),
  s("p3", "paper", `${day}T08:00:00Z`, `${day}T09:00:00Z`),
];

describe("myAgendaItems", () => {
  test("presenter sees their paper slot", () => {
    const r = myAgendaItems(all, { subs: [{ role: "presenter", session_id: "p1" }] });
    expect(r.find((i) => i.session.id === "p1")?.reason).toBe("presenting");
  });
  test("chair matched by name", () => {
    const r = myAgendaItems(all, { fullName: "Asha Rao", includeChair: true });
    expect(r.find((i) => i.session.id === "p2")?.reason).toBe("chair");
  });
  test("chair sessions stay out of My Plan by default", () => {
    expect(myAgendaItems(all, { fullName: "Asha Rao" }).some((i) => i.session.id === "p2")).toBe(false);
  });
  test("attendee gets only organizer-marked sessions plus stars", () => {
    const r = myAgendaItems(all, { starred: ["p3"] });
    expect(r.map((i) => i.session.id)).toEqual(["key", "p3"]);
  });
});

describe("freeSlots", () => {
  test("finds gaps of 30+ minutes between items", () => {
    const items = myAgendaItems(all, { starred: ["p3"] });
    const r = freeSlots(items, [{ day, startIso: `${day}T03:30:00Z`, endIso: `${day}T09:00:00Z` }], (iso) => iso.slice(0, 10));
    expect(r).toHaveLength(1);
    expect(r[0]!.minutes).toBe(210);
  });
});
