import { describe, expect, it } from "vitest";
import { isUrgent, sortQueue, waitedFor } from "./help-desk";

describe("help desk", () => {
  it("medical is always urgent", () => {
    expect(isUrgent({ category: "medical", urgent: false })).toBe(true);
    expect(isUrgent({ category: "general", urgent: false })).toBe(false);
  });
  it("urgent first, then oldest waiting, resolved last", () => {
    const rows = [
      { id: "r", status: "resolved", created_at: "2026-11-27T09:00:00Z", category: "general" },
      { id: "new", status: "open", created_at: "2026-11-27T10:00:00Z", category: "general" },
      { id: "old", status: "open", created_at: "2026-11-27T08:00:00Z", category: "general" },
      { id: "med", status: "open", created_at: "2026-11-27T11:00:00Z", category: "medical" },
    ];
    expect(sortQueue(rows).map((r) => r.id)).toEqual(["med", "old", "new", "r"]);
  });
  it("formats wait time", () => {
    expect(waitedFor("2026-11-27T08:00:00Z", Date.parse("2026-11-27T09:05:00Z"))).toBe("1 h 5 min");
  });
});
