import { describe, expect, it } from "vitest";
import { fillParam, nextStatus, toWaId, varCount, windowLeft, templateName } from "./whatsapp";

describe("whatsapp helpers", () => {
  it("normalizes Indian numbers", () => {
    expect(toWaId("98765 43210")).toBe("919876543210");
    expect(toWaId("+91-98765-43210")).toBe("919876543210");
    expect(toWaId("098765 43210")).toBe("919876543210");
    expect(toWaId("12345")).toBeNull();
  });
  it("never moves delivery state backwards", () => {
    expect(nextStatus("read", "sent")).toBe("read");
    expect(nextStatus("sent", "delivered")).toBe("delivered");
    expect(nextStatus("delivered", "failed")).toBe("failed");
    expect(nextStatus("failed", "read")).toBe("failed");
  });
  it("closes the reply window after 24 hours", () => {
    const now = Date.parse("2026-11-27T12:00:00Z");
    expect(windowLeft("2026-11-27T10:00:00Z", now)).toBe(22 * 3600_000);
    expect(windowLeft("2026-11-26T11:00:00Z", now)).toBe(0);
  });
  it("counts template variables and fills merge fields", () => {
    expect(varCount("Hi {{1}}, your room is {{2}}")).toBe(2);
    expect(fillParam("first_name", "", { full_name: "Prof. Anita Rao", delegate_code: "WMC-1", organization: null })).toBe("Anita");
    expect(templateName("Room Change!")).toBe("room_change");
  });
});
