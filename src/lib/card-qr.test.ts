import { describe, expect, it } from "vitest";
import { cardQrSvg, cardUrl, qrFileName } from "./card-qr";

describe("card qr", () => {
  it("builds nfc and qr links on the planos domain", () => {
    expect(cardUrl("wmc-bas1", "nfc")).toBe("https://paniim.planos.in/c/WMC-BAS1?m=nfc");
    expect(cardUrl("WMC-BAS1", "qr")).toBe("https://paniim.planos.in/c/WMC-BAS1?m=qr");
  });
  it("names files after the code", () => {
    expect(qrFileName(" wmc-ash1", "png")).toBe("WMC-ASH1.png");
  });
  it("prints the code under the qr", () => {
    expect(cardQrSvg("WMC-VIN1")).toContain(">WMC-VIN1</text>");
  });
});
