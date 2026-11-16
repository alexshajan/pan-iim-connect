import { describe, expect, it } from "vitest";
import { mailDelay } from "./mail-delay";

describe("mailDelay", () => {
  it("flags Oman university mail as institute", () => expect(mailDelay("satyanarayan.mishra@utas.edu.om")?.kind).toBe("institute"));
  it("flags IIM mail as institute", () => expect(mailDelay("a@iimb.ac.in")?.kind).toBe("institute"));
  it("flags US .edu as institute", () => expect(mailDelay("asaxena@ggc.edu")?.kind).toBe("institute"));
  it("flags nic.in as government", () => expect(mailDelay("x@nic.in")?.kind).toBe("government"));
  it("flags yahoo as slow webmail", () => expect(mailDelay("a@yahoo.com")?.kind).toBe("webmail-slow"));
  it("leaves gmail alone", () => expect(mailDelay("a@gmail.com")).toBeNull());
  it("ignores half-typed emails", () => expect(mailDelay("a@utas")).toBeNull());
});
