// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { codeFromScan, phaseAt, ribbon } from "./phase";
import { toVCard } from "./vcard";

describe("phase", () => {
  test("before 27 Nov IST", () => expect(phaseAt(new Date("2026-11-26T23:59:00+05:30"))).toBe("before"));
  test("live from 27 Nov 00:00 IST", () => expect(phaseAt(new Date("2026-11-27T00:00:00+05:30"))).toBe("live"));
  test("still live on 29 Nov night", () => expect(phaseAt(new Date("2026-11-29T23:59:00+05:30"))).toBe("live"));
  test("after from 30 Nov IST", () => expect(phaseAt(new Date("2026-11-30T00:00:00+05:30"))).toBe("after"));
});

describe("ribbon", () => {
  test("track chair outranks presenter", () =>
    expect(ribbon(["presenter", "track_chair"])).toEqual({ main: "Track Chair", extra: ["Presenter"] }));
  test("no roles = Delegate", () => expect(ribbon([]).main).toBe("Delegate"));
});

describe("scan", () => {
  test("reads code from pass URL", () => expect(codeFromScan("https://paniim.planos.in/id/wmc-ab3k")).toBe("WMC-AB3K"));
  test("reads code from handshake URL", () => expect(codeFromScan("https://paniim.planos.in/c/WMC-AB3K?m=qr")).toBe("WMC-AB3K"));
  test("rejects junk", () => expect(codeFromScan("hello")).toBeNull());
});

describe("vcard", () => {
  test("escapes commas and includes email", () => {
    const v = toVCard({ full_name: "Sen, A", email: "a@x.in" });
    expect(v).toContain("FN:Sen\\, A");
    expect(v).toContain("EMAIL;TYPE=INTERNET:a@x.in");
  });
});

describe("short codes", () => {
  test("VAL1 resolves to WMC-VAL1", () => expect(codeFromScan("VAL1")).toBe("WMC-VAL1"));
  test("short code in handshake URL", () => expect(codeFromScan("https://paniim.planos.in/c/vin1?m=nfc")).toBe("WMC-VIN1"));
});
