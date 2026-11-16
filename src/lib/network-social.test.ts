// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { feed, mutualWaves, reasonsFor } from "./network-social";
import { earnedStamps, iimCampuses } from "./stamps";
import { buildIcs } from "./ics";
import type { DirPerson } from "./network";

const P = (code: string, o: Partial<DirPerson> = {}): DirPerson => ({
  code, full_name: code, organization: null, keywords: [], bio: null, linkedin_url: null, email: null,
  is_placeholder: false, roles: [], papers: [], ...o,
});

describe("waves", () => {
  test("mutual only when both directions exist", () => {
    expect(mutualWaves([
      { code: "A", direction: "out", created_at: "" },
      { code: "A", direction: "in", created_at: "" },
      { code: "B", direction: "in", created_at: "" },
      { code: "C", direction: "out", created_at: "" },
    ])).toEqual(["A"]);
  });
});

describe("reasons and feed", () => {
  const me = { code: "ME", keywords: ["ESG"], tracks: ["Finance"] };
  test("presenting within 3 hours shows minutes", () => {
    const now = new Date("2026-11-28T10:00:00Z");
    const p = P("X", { papers: [{ id: "1", code: "1", title: "t", track: null, session_id: "s" }] });
    const r = reasonsFor(me, p, [{ id: "s", starts_at: "2026-11-28T10:40:00Z", ends_at: "2026-11-28T11:40:00Z", venue: "NAB 2" }], now);
    expect(r).toContain("Presenting in 40 min, NAB 2");
  });
  test("feed hides me, skipped and met", () => {
    const list = feed(me, [P("ME"), P("A"), P("B"), P("C")], { skip: ["A"], met: ["B"] });
    expect(list.map((x) => x.p.code)).toEqual(["C"]);
  });
});

describe("stamps", () => {
  test("five IIM campuses counted once each", () => {
    expect(iimCampuses(["IIM Shillong", "iim shillong", "Indian Institute of Management Ranchi", "XLRI"])).toEqual(["shillong", "ranchi"]);
  });
  test("ten handshakes earns first and ten", () => {
    const s = earnedStamps({ met: Array.from({ length: 10 }, () => ({ organization: null })), now: new Date(2026, 10, 28, 12) });
    expect(s.has("first") && s.has("ten") && !s.has("owl")).toBe(true);
  });
});

describe("ics", () => {
  test("event has UTC start", () => {
    expect(buildIcs([{ id: "a", title: "Keynote", starts_at: "2026-11-27T04:00:00Z", ends_at: "2026-11-27T05:00:00Z" }])).toContain("DTSTART:20261127T040000Z");
  });
});
