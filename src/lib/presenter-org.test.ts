import { describe, expect, it } from "vitest";
import { presenterOrg } from "./conference";

describe("presenterOrg", () => {
  it("uses the presenter's institution, not the first author's", () => {
    expect(presenterOrg({ presenter_name: "Aishwarya Harichandan", authors: [
      { name: "Nikhil Rahangdale", org: "IIFT Delhi" }, { name: "Aishwarya Harichandan", org: "IIM Sirmaur" }] })).toBe("IIM Sirmaur");
  });
  it("falls back to the first author when the presenter isn't listed", () => {
    expect(presenterOrg({ presenter_name: "Someone Else", authors: [{ name: "A B", org: "IIM Indore" }] })).toBe("IIM Indore");
  });
});
