import { describe, expect, it } from "vitest";
import { applyMoves, canMove, diffPlacement, findIssues, loadOf, suggest, type SPaper, type SSession, type Placement } from "./slotter";

const S = (id: string, o: Partial<SSession> = {}): SSession => ({ id, code: id, title: id, area: null, mode: "offline", slot: "D1A", day: "d1", starts_at: "", target: 2, locked: false, ...o });
const P = (id: string, title: string, o: Partial<SPaper> = {}): SPaper => ({ id, code: id, title, track: null, mode: "offline", presenters: [], ...o });

describe("slotter", () => {
  it("uses the per-session target for load", () => {
    expect(loadOf(7, 6)).toBe("over");
    expect(loadOf(6, 6)).toBe("ok");
    expect(loadOf(0, 6)).toBe("empty");
  });
  it("flags an online paper in an on-campus session and suggests the online one", () => {
    const sessions = [S("a"), S("b", { mode: "online" })];
    const papers = [P("1", "x", { mode: "online" })];
    const place: Placement = { "1": { session_id: "a", order: 1 } };
    const issues = findIssues(sessions, papers, place);
    expect(issues.some((i) => i.kind === "mode")).toBe(true);
    expect(suggest(sessions, papers, place).find((s) => s.issue.kind === "mode")?.moves[0]?.to).toBe("b");
  });
  it("never suggests moving into or out of a locked session", () => {
    const sessions = [S("a", { target: 1 }), S("b", { locked: true })];
    const papers = [P("1", "bank credit"), P("2", "bank loans")];
    const place: Placement = { "1": { session_id: "a", order: 1 }, "2": { session_id: "a", order: 2 } };
    expect(suggest(sessions, papers, place)).toHaveLength(0);
    expect(canMove(place, "1", "b", sessions)).toBe(false);
  });
  it("moves the worst-fitting paper out of an overfull session", () => {
    const sessions = [S("a", { target: 2, area: "Banking" }), S("b", { area: "Marketing brand" })];
    const papers = [P("1", "Bank credit risk"), P("2", "Banking capital"), P("3", "Brand loyalty marketing")];
    const place: Placement = { "1": { session_id: "a", order: 1 }, "2": { session_id: "a", order: 2 }, "3": { session_id: "a", order: 3 } };
    const s = suggest(sessions, papers, place).find((x) => x.issue.kind === "over");
    expect(s?.moves).toEqual([{ paper_id: "3", to: "b" }]);
  });
  it("flags a presenter in two parallel sessions", () => {
    const sessions = [S("a"), S("b")];
    const papers = [P("1", "x", { presenters: ["Dr. A Rao"] }), P("2", "y", { presenters: ["A Rao"] })];
    const place: Placement = { "1": { session_id: "a", order: 1 }, "2": { session_id: "b", order: 1 } };
    expect(findIssues(sessions, papers, place).filter((i) => i.kind === "clash")).toHaveLength(1);
  });
  it("diffs only changed papers", () => {
    const base: Placement = { "1": { session_id: "a", order: 1 }, "2": { session_id: "a", order: 2 } };
    const draft = applyMoves(base, [{ paper_id: "2", to: "b" }], [P("1", ""), P("2", "")]);
    expect(diffPlacement(base, draft)).toEqual([{ id: "2", session_id: "b", order: 1 }]);
  });
});
