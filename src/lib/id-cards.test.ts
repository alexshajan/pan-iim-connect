// @ts-expect-error bun provides this module at test time
import { describe, expect, test } from "bun:test";
import { clampField, fieldValue, newField, sheetRows } from "./id-cards";

const p = { delegate_code: "wmc-val1", full_name: "Valay", organization: "IIM Shillong", email: "card-1@cards.paniim.local", card_role: "Volunteer", category: "Volunteer", submission_ref: null };

describe("id cards", () => {
  test("sheet has the NFC handshake URL", () =>
    expect(sheetRows([p])[0]!["NFC URL (write to tag)"]).toBe("https://paniim.planos.in/c/WMC-VAL1?m=nfc"));
  test("printed QR points at the qr handshake", () => expect(fieldValue(p, "qr")).toBe("https://paniim.planos.in/c/WMC-VAL1?m=qr"));
  test("placeholder emails stay off the card", () => expect(fieldValue(p, "email")).toBe(""));
  test("fields stay on the card", () => {
    const f = clampField({ ...newField("full_name"), x: 0.9, w: 0.5 }, 1.5);
    expect(f.x + f.w).toBeLessThanOrEqual(1);
  });
});

describe("role on card never shows registration category", () => {
  test("presenter without a card role", () => {
    expect(fieldValue({ ...p, card_role: null, category: "Faculty", submission_ref: "754" }, "role")).toBe("Presenter");
  });
  test("attendee without a card role", () => {
    expect(fieldValue({ ...p, card_role: null, category: "Research Scholars", submission_ref: null }, "role")).toBe("Delegate");
  });
});

import { presetFor, printRole, stockFor } from "./id-cards";
describe("card presets", () => {
  test("Director in charge prints as Director i/c", () => expect(printRole("Director in charge, IIM Bangalore")).toBe("Director i/c, IIM Bangalore"));
  test("participants are green", () => expect(presetFor("Participant").pill).toBe("#00613b"));
  test("track chairs take the yellow", () => expect(presetFor("Track Chair").pill).toBe("#ebc954"));
  test("Chair, BoG uses the BoG metal card", () => expect(presetFor("Chair, BoG").id).toBe("bog"));
  test("directors go on gold metal", () => expect(stockFor({ ...p, card_role: "Director i/c, IIM Raipur" })).toBe("metal-gold"));
  test("volunteers stay on normal cards", () => expect(stockFor(p)).toBe("pvc"));
});

import { vendorSheets as _vs, lanyardUrl as _lu, lanyardUrl } from "./id-cards";
describe("vendor workbook by category", () => {
  const mk = (code: string, role: string) => ({ delegate_code: code, full_name: code, organization: null, email: "x@y.z", card_role: role, category: null });
  test("puts each card category on its own sheet with its lanyard link", () => {
    const s = _vs([mk("WMC-A", "Participant"), mk("WMC-B", "Volunteer"), mk("WMC-C", "Participant")]);
    expect(s.map((x) => x.sheet)).toEqual(["Participant", "Volunteer"]);
    expect(s[0]!.rows).toHaveLength(2);
    expect(Object.keys(s[0]!.rows[0]!)).toEqual(["Name", "Role on Card", "WMC Code", "NFC URL"]);
    expect(s[1]!.lanyard).toBe(_lu("volunteer"));
    expect(_lu("coordinator")).toBe("https://paniim.planos.in/lanyards/lanyard-coordinator.pdf");
    expect(_lu("blank")).toBe("https://paniim.planos.in/lanyards/lanyard-blank.pdf");
  });
});

import { fitLines, personPreset, presetLayout, PRESETS } from "./id-cards";
describe("card titles and long names", () => {
  test("Chair, BoG prints as Chairperson, BoG", () => expect(printRole("Chair, BoG")).toBe("Chairperson, BoG"));
  test("Board of Governors prints as Member, BoG", () => expect(printRole("Board of Governors")).toBe("Member, BoG"));
  test("Faculty prints as Faculty, IIM Shillong", () => expect(printRole("Faculty")).toBe("Faculty, IIM Shillong"));
  test("panels print as Panelist", () => expect(printRole("Corporate Panel")).toBe("Panelist"));
  test("a Keynote Speaker in the PURVA Guest category gets the PURVA card", () =>
    expect(personPreset({ ...p, card_role: "Keynote Speaker", category: "PURVA Guest" }).id).toBe("purva-guest"));
  test("Distinguished Guest uses the PURVA card", () => expect(presetFor("Distinguished Guest").id).toBe("purva-guest"));
  test("Journal editors get the Panelist card", () => expect(presetFor("Journal Editor", "Journal Editor").id).toBe("panelist"));
  test("Panelist uses the gold metal card", () => expect(presetFor("Panelist").stock).toBe("metal-gold"));
  test("two keynote cards are nameless", () => expect(PRESETS.find((x) => x.id === "keynote")!.unassigned).toBe(2));
  test("CAO gets its own pill on the coordinator design", () => { const c = presetFor("CAO, IIM Shillong"); expect(c.id).toBe("cao"); expect(c.layers).toBe("coordinator"); expect(lanyardUrl("cao")).toBe("https://paniim.planos.in/lanyards/lanyard-cao.pdf"); });
  test("long names wrap to two lines and shrink to fit", () => {
    const r = fitLines("Prof. Venkataramanaiah Saddikuti Ramachandran", 46.5, 15.5);
    expect(r.lines.length).toBeLessThanOrEqual(2);
    expect(r.size).toBeLessThan(15.5);
    for (const l of r.lines) expect(l.length * r.size * 0.6 * 0.3528).toBeLessThanOrEqual(46.5);
  });
  test("short names keep the full size on one line", () => expect(fitLines("Valay", 46.5, 15.5)).toEqual({ size: 15.5, lines: ["Valay"] }));
  test("templates preload movable logos on both sides", () => {
    const l = presetLayout(presetFor("Participant"));
    expect(l.fields.some((f) => f.key === "image")).toBe(true);
    expect(l.back!.map((f) => f.label)).toEqual(["Logos", "Campus art"]);
  });
});
