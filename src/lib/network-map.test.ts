// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import type { DirPerson } from "./network";
import {
  layoutMap,
  mapPeople,
  overlap,
  regionKey,
  regionLabel,
  tracksOf,
  trackOrder,
} from "./network-map";

const person = (code: string, tracks: string[], keywords: string[] = []): DirPerson => ({
  code,
  full_name: `Person ${code}`,
  organization: "IIM X",
  keywords,
  bio: null,
  linkedin_url: null,
  email: null,
  is_placeholder: false,
  roles: ["presenter"],
  papers: tracks.map((t, i) => ({
    id: `${code}-${i}`,
    code: `${code}-${i}`,
    title: "Paper",
    track: t,
    session_id: null,
  })),
});

const dir = [
  person("A", ["Finance"]),
  person("B", ["Finance", "Strategy"]),
  person("C", ["Sustainability"], ["esg"]),
  person("D", ["Strategy"]),
  person("E", ["Marketing"]),
  person("F", ["Sustainability", "Sustainability", "Finance"]),
];
const me = { code: "ME", name: "Me", keywords: ["esg"], tracks: ["Sustainability"] };

describe("tracksOf", () => {
  test("orders by paper count, then name", () => {
    expect(tracksOf(dir[5]!)).toEqual(["Sustainability", "Finance"]);
  });
});

describe("mapPeople", () => {
  test("met people only when suggestions are off", () => {
    const n = mapPeople(me, [{ code: "A", full_name: "Person A", organization: null }], dir, {
      withSuggested: false,
    });
    expect(n.map((x) => [x.code, x.ring])).toEqual([
      ["ME", "me"],
      ["A", "met"],
    ]);
  });
  test("suggests only unmet people who share a track or keyword", () => {
    const n = mapPeople(me, [{ code: "C", full_name: "Person C", organization: null }], dir, {
      withSuggested: true,
    });
    const sug = n.filter((x) => x.ring === "suggested").map((x) => x.code);
    expect(sug).toEqual(["F"]);
    expect(sug).not.toContain("C");
    expect(sug).not.toContain("E");
  });
  test("keeps met people who are not in the directory", () => {
    const n = mapPeople(me, [{ code: "Z", full_name: "Unlisted", organization: "Org" }], dir, {
      withSuggested: false,
    });
    expect(n[1]).toMatchObject({ code: "Z", name: "Unlisted", tracks: [] });
  });
});

describe("layoutMap", () => {
  const nodes = mapPeople(
    me,
    dir.slice(0, 4).map((p) => ({ code: p.code, full_name: p.full_name, organization: null })),
    dir,
    { withSuggested: true },
  );
  test("you sit in the centre", () => {
    const l = layoutMap(nodes, 600, 400);
    expect(l.pos["ME"]).toMatchObject({ x: 300, y: 200 });
  });
  test("every dot stays inside the box and dots do not overlap", () => {
    const l = layoutMap(nodes, 360, 420);
    const ps = Object.values(l.pos);
    for (const p of ps) {
      expect(p.x - p.r).toBeGreaterThanOrEqual(0);
      expect(p.x + p.r).toBeLessThanOrEqual(360);
      expect(p.y - p.r).toBeGreaterThanOrEqual(0);
      expect(p.y + p.r).toBeLessThanOrEqual(420);
    }
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++)
        expect(Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.y - ps[j]!.y)).toBeGreaterThan(
          ps[i]!.r + ps[j]!.r,
        );
  });
  test("same input gives the same layout", () => {
    expect(layoutMap(nodes, 500, 400)).toEqual(layoutMap(nodes, 500, 400));
  });
  test("one anchor per track", () => {
    expect(Object.keys(layoutMap(nodes, 500, 400).anchors).sort()).toEqual(
      trackOrder(nodes).sort(),
    );
  });
});

describe("overlap", () => {
  const pool = dir.map((p) => ({ code: p.code, tracks: tracksOf(p) }));
  test("regions add up to the total", () => {
    const o = overlap(pool, ["Finance", "Strategy", "Sustainability"]);
    const sum = Object.values(o.regions).reduce((a, r) => a + r.length, 0);
    expect(sum).toBe(o.total);
    expect(o.total).toBe(5);
    expect(o.regions["110"]).toEqual(["B"]);
    expect(o.regions["101"]).toEqual(["F"]);
  });
  test("two tracks give three regions", () => {
    expect(overlap(pool, ["Finance", "Strategy"]).keys).toEqual(["100", "010", "110"]);
  });
  test("labels read plainly", () => {
    expect(regionLabel("100", ["Finance", "Strategy"])).toBe("Finance only");
    expect(regionLabel("110", ["Finance", "Strategy"])).toBe("Finance + Strategy");
    expect(regionKey(["Strategy"], ["Finance", "Strategy"])).toBe("010");
  });
});
