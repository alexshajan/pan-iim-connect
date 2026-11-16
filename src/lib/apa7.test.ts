import { describe, expect, it } from "vitest";
import { affiliations, apaCitation, apaName, joinAuthors } from "./apa7";

describe("apa7", () => {
  it("joins two authors with an ampersand", () => expect(joinAuthors(["A", "B"])).toBe("A & B"));
  it("joins three with a serial comma and ampersand", () => expect(joinAuthors(["A", "B", "C"])).toBe("A, B, & C"));
  it("formats surname and initials, dropping titles", () => expect(apaName("Dr. Rohan Kumar Sen")).toBe("Sen, R. K."));
  it("numbers shared affiliations once", () =>
    expect(affiliations([{ name: "a", org: "X" }, { name: "b", org: "Y" }, { name: "c", org: "X" }]).marks).toEqual([1, 2, 1]));
  it("builds an APA 7 paper presentation citation", () =>
    expect(apaCitation([{ name: "Rohan Sen" }, { name: "Priya Nair" }], "Supply chains")).toBe(
      "Sen, R., & Nair, P. (2026, November 27–29). Supply chains [Paper presentation]. 11th Pan-IIM World Management Conference, IIM Shillong, Meghalaya, India.",
    ));
});
