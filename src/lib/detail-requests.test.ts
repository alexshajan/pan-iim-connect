import { describe, expect, it } from "vitest";
import { cleanName, latestRequests, matchAuthor, nameOnPass, type DetailRequest } from "./detail-requests";

const req = (p: Partial<DetailRequest>): DetailRequest => ({
  id: Math.random().toString(), kind: "name", status: "pending", submission_id: null, author_index: null,
  proposed_name: null, proposed_email: null, note: null, decision_note: null, created_at: "2026-11-10T10:00:00Z", decided_at: null, ...p,
});

describe("detail requests", () => {
  it("strips honorifics from printed names", () => {
    expect(cleanName("Dr.  Anto  Joseph")).toBe("Anto Joseph");
    expect(cleanName("Prof. Dr. Syeedun Nisa")).toBe("Syeedun Nisa");
  });
  it("matches the person coming to a non-first author", () => {
    expect(matchAuthor("Nimisha Sharma", [{ name: "Ashish Bhargava" }, { name: "Nimisha Sharma" }])).toBe(2);
    expect(matchAuthor("Someone Else", [{ name: "Ashish Bhargava" }])).toBeNull();
  });
  it("shows a pending name on the guest's own pass until decided", () => {
    expect(nameOnPass("Ashish Bhargava", [req({ kind: "presenter", proposed_name: "Nimisha Sharma" })])).toEqual({ name: "Nimisha Sharma", pending: true });
    expect(nameOnPass("Ashish Bhargava", [req({ status: "rejected", proposed_name: "X Y" })])).toEqual({ name: "Ashish Bhargava", pending: false });
  });
  it("a newer request replaces an older one of the same kind", () => {
    const old = req({ status: "rejected", created_at: "2026-11-09T10:00:00Z" });
    const now = req({ status: "pending" });
    expect(latestRequests([old, now])).toEqual([now]);
  });
});
