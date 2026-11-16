// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { filterPeople, keywordOverlap, suggest, type DirPerson } from "./network";
import { countdownParts, dialPct, nextItem } from "./day-dial";

const P = (code: string, keywords: string[], track: string | null = null, roles: string[] = []): DirPerson => ({
  code, full_name: code, organization: null, keywords, bio: null, linkedin_url: null, email: null,
  is_placeholder: false, roles, papers: track ? [{ id: code, code, title: "t", track, session_id: null }] : [],
});

describe("network", () => {
  test("overlap is case-insensitive", () => {
    expect(keywordOverlap(["ESG", "fintech"], ["esg", "Marketing"])).toEqual(["esg"]);
  });
  test("suggest excludes me and ranks by shared keywords", () => {
    const r = suggest({ code: "ME", keywords: ["esg", "fintech"], tracks: [] }, [P("ME", ["esg"]), P("A", ["esg"]), P("B", ["esg", "fintech"]), P("C", ["hr"])]);
    expect(r.map((x) => x.p.code)).toEqual(["B", "A"]);
  });
  test("shared track counts when no keyword overlap", () => {
    const r = suggest({ code: "ME", keywords: [], tracks: ["Finance"] }, [P("A", [], "Finance")]);
    expect(r.length).toBe(1);
  });
  test("payer role filters as presenter", () => {
    expect(filterPeople([P("A", [], null, ["payer"])], { role: "presenter" }).length).toBe(1);
  });
});

describe("day dial", () => {
  const now = new Date("2026-11-27T14:00:00+05:30");
  test("14:00 IST sits at 50% of 08–20", () => {
    expect(dialPct(now.getTime(), now)).toBe(50);
  });
  test("countdown from 26 Nov 18:30 IST to start", () => {
    expect(countdownParts(new Date("2026-11-27T00:00:00+05:30"), new Date("2026-11-26T18:30:00+05:30"))).toEqual({ days: 0, hours: 5, minutes: 30 });
  });
  test("next prefers my session", () => {
    const s = [
      { id: "a", starts_at: "2026-11-27T09:00:00Z", ends_at: "2026-11-27T10:00:00Z" },
      { id: "b", starts_at: "2026-11-27T11:00:00Z", ends_at: "2026-11-27T12:00:00Z" },
    ];
    expect(nextItem(s, new Date("2026-11-27T08:00:00Z"), ["b"])?.id).toBe("b");
  });
});
