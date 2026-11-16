import { describe, expect, it } from "vitest";
import { filterPapers, flattenPapers, trackCounts } from "./paper-browse";
import type { Session } from "./conference";

const s = (id: string, track: string, papers: { id: string; title: string; mode?: string }[]) =>
  ({ id, title: id, starts_at: "2026-11-28T10:00:00Z", area: track, papers: papers.map((p, i) => ({ ...p, session_id: id, authors: "A. Rao", affiliation: "IIM Shillong", abstract: null, discussant: null, slot_order: i })) }) as unknown as Session;

const all = flattenPapers([s("a", "Finance", [{ id: "1", title: "Bank risk", mode: "online" }, { id: "2", title: "Bonds" }]), s("b", "Marketing", [{ id: "3", title: "Brand love" }])]);

describe("paper browse", () => {
  it("flattens every paper with its track", () => {
    expect(all.map((p) => p.track)).toEqual(["Finance", "Finance", "Marketing"]);
  });
  it("filters by track and mode", () => {
    expect(filterPapers(all, { q: "", track: "Finance", mode: "online" }).map((p) => p.id)).toEqual(["1"]);
    expect(filterPapers(all, { q: "", track: "", mode: "in_person" }).map((p) => p.id)).toEqual(["2", "3"]);
  });
  it("searches title and institution", () => {
    expect(filterPapers(all, { q: "brand", track: "", mode: "" }).map((p) => p.id)).toEqual(["3"]);
    expect(filterPapers(all, { q: "shillong", track: "", mode: "" })).toHaveLength(3);
  });
  it("orders tracks by size", () => {
    expect(trackCounts(all)).toEqual([{ track: "Finance", count: 2 }, { track: "Marketing", count: 1 }]);
  });
});
