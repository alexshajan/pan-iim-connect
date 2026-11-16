import { describe, expect, it } from "vitest";
import { standardizeAffiliation } from "./affiliation";

const aliases = [
  { raw: "IIM BODH GAYA", canonical: "IIM Bodh Gaya" },
  { raw: "Indian Institute of Management Bodh Gaya", canonical: "IIM Bodh Gaya" },
  { raw: "Christ Deemed to be University", canonical: "Christ University, Bengaluru" },
  { raw: "IIM Shillong", canonical: "IIM Shillong" },
];

describe("standardizeAffiliation", () => {
  it("maps a known spelling regardless of case", () => {
    expect(standardizeAffiliation("iim bodh gaya", aliases)).toEqual({ canonical: "IIM Bodh Gaya", how: "known spelling" });
  });
  it("matches a long form to the standard short name", () => {
    expect(standardizeAffiliation("Indian Institute of Management, Shillong", aliases).canonical).toBe("IIM Shillong");
  });
  it("finds the standard name inside a department-style entry", () => {
    expect(standardizeAffiliation("Dept of Marketing, IIM Shillong, Meghalaya", aliases).canonical).toBe("IIM Shillong");
  });
  it("keeps an unknown institution as typed", () => {
    expect(standardizeAffiliation("  Nagaland  University ", aliases)).toEqual({ canonical: "Nagaland University", how: "new" });
  });
});
