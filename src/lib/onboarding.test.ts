// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { claimStatus, isCode, nextRoute, passKind } from "./onboarding";

describe("onboarding rules", () => {
  test("not-yet-onboarded users go to onboarding", () => {
    expect(nextRoute(null)).toBe("/onboarding");
    expect(nextRoute("2026-10-18T00:00:00Z")).toBe("/me");
  });
  test("unlisted people get a visitor pass", () => {
    expect(passKind([])).toBe("visitor");
    expect(passKind(["visitor"])).toBe("visitor");
    expect(passKind(["visitor", "presenter"])).toBe("delegate");
  });
  test("latest claim decides status", () => {
    expect(claimStatus([])).toBeNull();
    expect(claimStatus([{ status: "rejected", created_at: "2026-10-01" }, { status: "open", created_at: "2026-10-02" }])).toBe("pending");
    expect(claimStatus([{ status: "approved", created_at: "2026-10-03" }, { status: "open", created_at: "2026-10-02" }])).toBe("approved");
  });
  test("codes are six digits", () => {
    expect(isCode("123456")).toBe(true);
    expect(isCode("12345")).toBe(false);
    expect(isCode("12345678")).toBe(true);
  });
});
