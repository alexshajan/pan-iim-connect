import { describe, expect, it } from "vitest";
import { audienceCsv, EMPTY_FILTER, filterAudience, institutionCounts, missingFields, type AudiencePerson } from "./email-audience";

const p = (o: Partial<AudiencePerson>): AudiencePerson => ({
  id: "1", full_name: "Ananya Rao", email: "a@iim.ac.in", phone: "999", organization: "IIM Shillong",
  attendance_mode: "offline", user_id: null, delegate_code: "WMC-A", roles: ["presenter"], ...o,
});

describe("email audience", () => {
  it("filters by role", () => {
    const out = filterAudience([p({ id: "1" }), p({ id: "2", roles: ["chair"] })], { ...EMPTY_FILTER, roles: ["chair"] });
    expect(out.map((x) => x.id)).toEqual(["2"]);
  });
  it("matches institution case-insensitively", () => {
    const out = filterAudience([p({ organization: "iim shillong " })], { ...EMPTY_FILTER, institutions: ["IIM Shillong"] });
    expect(out).toHaveLength(1);
  });
  it("adoption nudge audience = not signed in", () => {
    const out = filterAudience([p({ id: "1", user_id: "u" }), p({ id: "2" })], { ...EMPTY_FILTER, signedIn: "no" });
    expect(out.map((x) => x.id)).toEqual(["2"]);
  });
  it("never includes test data or unusable emails", () => {
    const out = filterAudience([p({ is_placeholder: true }), p({ email: "x@demo.paniim.test" }), p({ email_missing: true })], EMPTY_FILTER);
    expect(out).toHaveLength(0);
  });
  it("lists missing phone and institution", () => {
    expect(missingFields(p({ phone: null, organization: "" }))).toEqual(["Phone number", "Institution"]);
  });
  it("counts institutions merged by case", () => {
    expect(institutionCounts([p({}), p({ organization: "IIM SHILLONG" })])[0].count).toBe(2);
  });
  it("quotes CSV cells with commas", () => {
    expect(audienceCsv([p({ organization: "IIM, Shillong" })]).split("\n")[1]).toContain('"IIM, Shillong"');
  });
});
