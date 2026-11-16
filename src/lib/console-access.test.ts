import { describe, expect, it } from "bun:test";
import { alertsNeedApproval, allowedScreens, homeScreen, screenForPath } from "./console-access";

describe("console access", () => {
  it("only admins can manage the team", () => {
    expect(allowedScreens(["admin"]).has("team")).toBe(true);
    expect(allowedScreens(["editor"]).has("team")).toBe(false);
  });
  it("desk volunteers check in but cannot edit submissions", () => {
    const a = allowedScreens(["desk_volunteer"]);
    expect(a.has("checkin")).toBe(true);
    expect(a.has("submissions")).toBe(false);
    expect(a.has("decks")).toBe(false);
  });
  it("room volunteers see the deck drive and a read-only schedule", () => {
    expect([...allowedScreens(["room_volunteer"])]).toEqual(["decks", "schedule", "alerts"]);
    expect(homeScreen(["room_volunteer"])).toBe("decks");
  });
  it("roles combine", () => {
    const a = allowedScreens(["room_volunteer", "help_volunteer"]);
    expect(a.has("decks") && a.has("help")).toBe(true);
  });
  it("no roles means no access", () => {
    expect(allowedScreens([]).size).toBe(0);
    expect(homeScreen([])).toBeNull();
  });
  it("maps paths to screens", () => {
    expect(screenForPath("/console")).toBe("overview");
    expect(screenForPath("/console/checkin")).toBe("checkin");
    expect(screenForPath("/console/schedule/import")).toBe("schedule");
  });
  it("volunteers can open alerts to request one", () => {
    expect(allowedScreens(["editor"]).has("alerts")).toBe(true);
    expect(allowedScreens(["desk_volunteer"]).has("alerts")).toBe(true);
  });
});

describe("alert approval", () => {
  it("volunteers' alerts need organizer approval", () => {
    expect(alertsNeedApproval(["room_volunteer"])).toBe(true);
    expect(alertsNeedApproval(["help_volunteer"])).toBe(true);
  });
  it("admins and editors publish directly", () => {
    expect(alertsNeedApproval(["admin"])).toBe(false);
    expect(alertsNeedApproval(["editor"])).toBe(false);
  });
});
