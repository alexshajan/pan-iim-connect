// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { normEmail, normPhone, parseRows } from "./registry";

const row = (o: Record<string, unknown>) => ({
  "Name of presenter/payer": "SWATI JAIN",
  Email: "Swati@IIMK.ac.in ",
  "Phone No.": 8095719014,
  Organization: "IIM Kozhikode",
  Type: "Academics & Faculty",
  "Submission ID": 1327,
  ...o,
});

describe("registry", () => {
  test("emails are lower-cased and trimmed", () => {
    expect(normEmail(" Swati@IIMK.ac.in ")).toBe("swati@iimk.ac.in");
  });
  test("10-digit Indian mobiles get +91", () => {
    expect(normPhone(8095719014)).toBe("+918095719014");
    expect(normPhone("+1 415 555 0100")).toBe("+14155550100");
    expect(normPhone("123")).toBeNull();
  });
  test("one person per email, both submission IDs kept", () => {
    const r = parseRows([row({ "Submission ID 2 need to pay again": 1328 }), row({ Email: "swati@iimk.ac.in", "Submission ID": 1400 })]);
    expect(r.people).toHaveLength(1);
    expect(r.submissions.map((s) => s.submission_code).sort()).toEqual(["1327", "1328", "1400"]);
  });
  test("different presenting author is recorded on the submission", () => {
    const r = parseRows([row({ "Presenting author if not the payer": "Ravi Kumar" })]);
    expect(r.submissions[0]!.presenter_name).toBe("Ravi Kumar");
    const same = parseRows([row({ "Presenting author if not the payer": "Swati Jain" })]);
    expect(same.submissions[0]!.presenter_name).toBeNull();
  });
  test("same name and org with different emails is flagged, not merged", () => {
    const r = parseRows([row({}), row({ Email: "swati.jain@gmail.com", "Submission ID": 9, "Phone No.": 9999999999 })]);
    expect(r.people).toHaveLength(2);
    expect(r.duplicates.some((d) => d.kind === "same_name_org")).toBe(true);
  });
  test("missing email becomes an issue", () => {
    expect(parseRows([row({ Email: "" })]).issues[0]!.kind).toBe("missing_email");
  });
});
