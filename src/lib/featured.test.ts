// @ts-expect-error bun provides this module at test time
import { describe, expect, it } from "bun:test";
import { featuredOf } from "./featured";

describe("featuredOf", () => {
  it("keynote leads with the speaker and keeps their role", () => {
    const f = featuredOf({ title: "Keynote II", session_type: "keynote", summary: "Prof. V. Kumar, Goodman Academic-Industry Partnership Professor, Brock University" })!;
    expect(f.headline).toBe("Prof. V. Kumar");
    expect(f.guests[0]!.role).toBe("Goodman Academic-Industry Partnership Professor, Brock University");
  });
  it("joins a Padma Shri honour to the name", () => {
    expect(featuredOf({ title: "Keynote I", session_type: "keynote", summary: "Padma Shri, Prof. Kiran Seth" })!.headline).toBe("Padma Shri Prof. Kiran Seth");
  });
  it("drops a stray closing bracket", () => {
    expect(featuredOf({ title: "Keynote III", session_type: "keynote", summary: "Shri. Madan Mohanka, Founder Tega Industries)" })!.guests[0]!.role).toBe("Founder Tega Industries");
  });
  it("keynote with no speaker yet", () => {
    expect(featuredOf({ title: "Keynote VII", session_type: "keynote", summary: null })!.headline).toBe("Speaker to be announced");
  });
  it("panel summary is its topic", () => {
    const f = featuredOf({ title: "Corporate Panel I", session_type: "panel", summary: " Reimagining MBA Talent: What Does Corporate India Need for 2047? " })!;
    expect(f.headline).toBe("Reimagining MBA Talent: What Does Corporate India Need for 2047?");
  });
  it("panel with names in summary lists five guests and takes topic from title", () => {
    const f = featuredOf({ title: "Padma Shri Panel: Expectations from Businesses for Viksit Bharat", session_type: "panel", summary: "Padma Shri Prof. Mamidala Jagadesh Kumar, Padma Shri Ms. Niru Kumar, Padma Shri Prof. David Syiemlieh, Padma Shri Ms. Patricia Mukim, Padma Shri Ms. Silbi Passah" })!;
    expect(f.topic).toBe("Expectations from Businesses for Viksit Bharat");
    expect(f.guests).toHaveLength(5);
  });
  it("ignores paper sessions", () => {
    expect(featuredOf({ title: "x", session_type: "paper", summary: "y" })).toBeNull();
  });
});

import { guestSlug, guestsOf } from "./featured";
describe("guest profiles", () => {
  it("slugs drop honours and titles", () => {
    expect(guestSlug("Padma Shri Prof. Kiran Seth")).toBe("kiran-seth");
    expect(guestSlug("Prof. V. Kumar")).toBe("v-kumar");
  });
  it("merges a guest across sessions", () => {
    const s = (id: string, t: string, sum: string, at: string) => ({ id, title: t, summary: sum, session_type: "keynote", starts_at: at, ends_at: at });
    const g = guestsOf([s("b", "Keynote II", "Prof. A Rao, IIM X", "2026-11-28"), s("a", "Keynote I", "Dr. A Rao", "2026-11-27")]);
    expect(g).toHaveLength(1);
    expect(g[0]!.appearances.map((a) => a.sessionId)).toEqual(["a", "b"]);
    expect(g[0]!.role).toBe("IIM X");
  });
});
