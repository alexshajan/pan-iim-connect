import { describe, expect, it } from "bun:test";
import { alertsFor } from "./alerts";

const now = new Date("2026-11-27T05:00:00Z");
const a = (o: Record<string, unknown>) => ({ id: "1", title: "t", body: "b", audience: "all", urgent: false, published_at: "2026-11-27T04:00:00Z", ...o });

describe("alert visibility", () => {
  it("withdrawn alerts disappear", () => expect(alertsFor([a({ withdrawn_at: "2026-11-27T04:30:00Z" })], {}, now)).toHaveLength(0));
  it("scheduled alerts wait until their time", () => expect(alertsFor([a({ published_at: "2026-11-27T06:00:00Z" })], {}, now)).toHaveLength(0));
  it("ended alerts disappear", () => expect(alertsFor([a({ ends_at: "2026-11-27T04:59:00Z" })], {}, now)).toHaveLength(0));
  it("presenter-only alerts reach presenters only", () => {
    expect(alertsFor([a({ audience: "presenters" })], {}, now)).toHaveLength(0);
    expect(alertsFor([a({ audience: "presenters" })], { presenter: true }, now)).toHaveLength(1);
  });
  it("session alerts reach people in that session", () => {
    expect(alertsFor([a({ audience: "session", session_id: "s1" })], { sessionIds: ["s1"] }, now)).toHaveLength(1);
    expect(alertsFor([a({ audience: "session", session_id: "s1" })], { sessionIds: ["s2"] }, now)).toHaveLength(0);
  });
});
