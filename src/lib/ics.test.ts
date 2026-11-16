import { describe, expect, it } from "bun:test";
import { buildIcs, escapeIcs, googleEventUrl, subscribeLinks } from "./ics";

const ev = { id: "s1", title: "Paper session, Finance", starts_at: "2026-11-28T03:30:00Z", ends_at: "2026-11-28T05:00:00Z", location: "Room G01" };

describe("ics", () => {
  it("writes UTC times and escapes commas", () => {
    const out = buildIcs([ev], { now: new Date("2026-11-01T00:00:00Z") });
    expect(out).toContain("DTSTART:20261128T033000Z");
    expect(out).toContain("DTEND:20261128T050000Z");
    expect(out).toContain("SUMMARY:Paper session\\, Finance");
    expect(out).toContain("TRIGGER:-PT15M");
  });
  it("escapes semicolons and newlines", () => {
    expect(escapeIcs("a;b\nc")).toBe("a\\;b\\nc");
  });
  it("builds a Google add link in Kolkata time", () => {
    const u = new URL(googleEventUrl(ev));
    expect(u.searchParams.get("dates")).toBe("20261128T033000Z/20261128T050000Z");
    expect(u.searchParams.get("ctz")).toBe("Asia/Kolkata");
  });
  it("turns the feed into a webcal subscription", () => {
    expect(subscribeLinks("https://x.in/api/public/cal/abc").apple).toBe("webcal://x.in/api/public/cal/abc");
  });
});
