import { describe, expect, it } from "vitest";
import { cleanUrl, detectPlatform, onPlatform, searchQuery, upsertLink } from "./profile-links";

describe("profile links", () => {
  it("adds https and rejects junk", () => {
    expect(cleanUrl("linkedin.com/in/asha/")).toBe("https://linkedin.com/in/asha");
    expect(cleanUrl("not a url")).toBeNull();
  });
  it("detects platforms, unknown hosts are institute pages", () => {
    expect(detectPlatform("https://scholar.google.co.in/citations?user=x")).toBe("scholar");
    expect(detectPlatform("https://iimshillong.ac.in/faculty/x")).toBe("institute");
  });
  it("builds site-restricted queries", () => {
    expect(searchQuery("orcid", "Asha Rao", "IIM Shillong")).toBe('site:orcid.org "Asha Rao" IIM Shillong');
  });
  it("filters off-platform results", () => {
    expect(onPlatform("linkedin", "https://researchgate.net/profile/x")).toBe(false);
  });
  it("keeps one link per platform", () => {
    const l = upsertLink([{ platform: "linkedin", url: "https://linkedin.com/in/a" }], { platform: "linkedin", url: "https://linkedin.com/in/b" });
    expect(l).toEqual([{ platform: "linkedin", url: "https://linkedin.com/in/b" }]);
  });
});
