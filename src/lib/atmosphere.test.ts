import { describe, expect, it } from "vitest";
import { airWord, compass, parseAtmosphere, pickAtmosphere, skyPhase, wearFor } from "./atmosphere";

describe("atmosphere", () => {
  it("fixed setting always wins", () => expect(pickAtmosphere("ridge", new Date())).toBe("ridge"));
  it("auto rotates to a different card the next India day", () => {
    const a = pickAtmosphere("auto", new Date("2026-11-10T10:00:00Z"));
    const b = pickAtmosphere("auto", new Date("2026-11-11T10:00:00Z"));
    expect(a).not.toBe(b);
  });
  it("auto is stable within an India day", () => {
    expect(pickAtmosphere("auto", new Date("2026-11-10T19:00:00Z"))).toBe(pickAtmosphere("auto", new Date("2026-11-11T18:00:00Z")));
  });
  it("unknown setting falls back to auto", () => expect(parseAtmosphere("x")).toBe("auto"));
  it("air words", () => { expect(airWord(20)).toBe("Pristine air"); expect(airWord(48)).toBe("Clean air"); });
  it("wear advice at 10°", () => expect(wearFor(10)).toBe("Warm jacket"));
  it("dusk before sunset", () => expect(skyPhase(16 * 60 + 20, 5 * 60 + 45, 16 * 60 + 50)).toBe("dusk"));
  it("compass", () => expect(compass(50)).toBe("NE"));
});
