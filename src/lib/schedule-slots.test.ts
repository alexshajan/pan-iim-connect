import { describe, expect, it } from "bun:test";
import { groupIntoSlots } from "./schedule";
import type { Session } from "./conference";

const s = (id: string, start: string, slot: string | null) =>
  ({ id, starts_at: `2026-11-27T${start}:00+05:30`, ends_at: "2026-11-27T15:45:00+05:30", slot_code: slot }) as unknown as Session;

describe("groupIntoSlots", () => {
  it("keeps online 2:15 and in-person 2:45 sessions of block D1A together", () => {
    const slots = groupIntoSlots([s("on", "14:15", "D1A"), s("off", "14:45", "D1A")]);
    expect(slots).toHaveLength(1);
  });
  it("splits sessions 30 minutes apart without a shared slot code", () => {
    expect(groupIntoSlots([s("a", "14:15", null), s("b", "14:45", null)])).toHaveLength(2);
  });
});
