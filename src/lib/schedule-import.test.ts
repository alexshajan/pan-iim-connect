import { describe, expect, it } from "bun:test";
import { matchName, matchPaper, matchRows } from "./schedule-import";

const venues = [{ id: "v1", name: "NAB 104", alt: "NAB-104" }, { id: "v2", name: "Auditorium", alt: null }];
const subs = [{ id: "s1", submission_code: "PAN-101", title: "Pricing loyalty in rural fintech" }];

describe("schedule import matching", () => {
  it("matches venues exactly ignoring punctuation", () => {
    expect(matchName("nab-104", venues)).toEqual({ id: "v1", label: "NAB 104", confidence: "exact" });
  });
  it("unknown venue is new", () => {
    expect(matchName("Lake lawn", venues).confidence).toBe("new");
  });
  it("matches papers by submission code first", () => {
    expect(matchPaper({ title: "something else", authors: null, code: "pan-101" }, subs).id).toBe("s1");
  });
  it("close title match is amber", () => {
    expect(matchPaper({ title: "Pricing loyalty in fintech", authors: null, code: null }, subs).confidence).toBe("close");
  });
  it("an unchanged existing session is left alone, a moved one is an update", () => {
    const sessions = [{ id: "x", title: "Marketing I", starts_at: "2026-11-27T04:30:00.000Z", ends_at: "2026-11-27T06:00:00.000Z", venue_id: "v1", chair: null }];
    const row = { date: "2026-11-27", start: "10:00", end: "11:30", venue: "NAB 104", track: null, title: "Marketing I", chair: null, papers: [] };
    expect(matchRows([row], { venues, tracks: [], sessions, subs })[0]!.action).toBe("same");
    expect(matchRows([{ ...row, venue: "Auditorium" }], { venues, tracks: [], sessions, subs })[0]!.action).toBe("update");
  });
});
