import { describe, expect, it } from "vitest";
import { findIssues, validateEdit, type IssuePerson } from "./people-issues";

const p = (o: Partial<IssuePerson>): IssuePerson => ({
  id: o.id ?? "x", delegate_code: "WMC-AB12", email: "a@x.in", alt_email: null, full_name: "A",
  phone: null, organization: null, user_id: "u", ...o,
});

describe("people issues", () => {
  it("flags an email used as one profile's main and another's second email", () => {
    const i = findIssues([p({ id: "1", email: "a@x.in" }), p({ id: "2", email: "b@x.in", alt_email: "a@x.in" })]);
    expect(i.find((x) => x.kind === "shared_email")?.ids.sort()).toEqual(["1", "2"]);
  });
  it("treats Prof. Basav and Basav at same institution as possible duplicates", () => {
    const i = findIssues([p({ id: "1", full_name: "Prof. Basav", organization: "IIM Shillong" }), p({ id: "2", email: "b@x.in", full_name: "Basav", organization: "IIM Shillong" })]);
    expect(i.some((x) => x.kind === "similar_name")).toBe(true);
  });
  it("matches phones ignoring +91 and spaces", () => {
    const i = findIssues([p({ id: "1", phone: "+91 98765 43210" }), p({ id: "2", email: "b@x.in", phone: "9876543210" })]);
    expect(i.some((x) => x.kind === "same_phone")).toBe(true);
  });
  it("flags made-up card emails and bad codes", () => {
    const i = findIssues([p({ email: "card-1@cards.paniim.local", delegate_code: "ABC" })]);
    expect(i.map((x) => x.kind)).toEqual(expect.arrayContaining(["placeholder_email", "bad_code"]));
  });
  it("blocks saving a second email that is on another profile", () => {
    expect(validateEdit(p({ id: "1", alt_email: "b@x.in" }), [p({ id: "2", email: "b@x.in", full_name: "Bee", delegate_code: "WMC-ZZ99" })])).toMatch(/Bee/);
  });
  it("blocks a code already taken", () => {
    expect(validateEdit(p({ id: "1" }), [p({ id: "2", email: "z@x.in", full_name: "Zed" })])).toMatch(/WMC-AB12/);
  });
});
