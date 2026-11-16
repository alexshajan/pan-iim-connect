/** Pure helpers for the Home "Shillong right now" cards. */
export type AtmosphereCard = "barometer" | "ridge" | "scrubber";
export type AtmosphereSetting = AtmosphereCard | "auto";
export const ATMOSPHERE_CARDS: AtmosphereCard[] = ["barometer", "ridge", "scrubber"];
export const ATMOSPHERE_LABELS: Record<AtmosphereSetting, string> = {
  barometer: "Mountain barometer",
  ridge: "Living pine ridge",
  scrubber: "Day scrubber",
  auto: "Rotate daily",
};

export function parseAtmosphere(v: unknown): AtmosphereSetting {
  return v === "barometer" || v === "ridge" || v === "scrubber" || v === "auto" ? v : "auto";
}

/** "auto" rotates by India calendar day so every guest sees the same card that day. */
export function pickAtmosphere(setting: AtmosphereSetting, now: Date): AtmosphereCard {
  if (setting !== "auto") return setting;
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const day = Math.floor(ist.getTime() / 86_400_000);
  return ATMOSPHERE_CARDS[day % ATMOSPHERE_CARDS.length]!;
}

export function airWord(aqi: number): string {
  if (aqi <= 25) return "Pristine air";
  if (aqi <= 50) return "Clean air";
  if (aqi <= 100) return "Fair air";
  return "Hazy today";
}

export function wearFor(t: number): string {
  if (t >= 22) return "Shirt sleeves";
  if (t >= 17) return "Light layer";
  if (t >= 12) return "Sweater weather";
  if (t >= 8) return "Warm jacket";
  return "Jacket and scarf";
}

const WMO: [number, string][] = [
  [0, "Clear"], [2, "Partly cloudy"], [3, "Overcast"], [48, "Mist"],
  [67, "Drizzle"], [77, "Snow"], [82, "Showers"], [99, "Thunder"],
];
export const skyLabel = (code: number) => (WMO.find(([max]) => code <= max) ?? WMO[WMO.length - 1]!)[1];

export type SkyPhase = "night" | "dawn" | "day" | "dusk";
/** Phase of the sky at a given minute of day, from sunrise/sunset minutes. */
export function skyPhase(min: number, rise: number, set: number): SkyPhase {
  if (min < rise - 40 || min > set + 40) return "night";
  if (min < rise + 50) return "dawn";
  if (min > set - 60) return "dusk";
  return "day";
}

/** 0..1 position of the sun between sunrise and sunset (clamped). */
export const sunProgress = (min: number, rise: number, set: number) => Math.max(0, Math.min(1, (min - rise) / Math.max(1, set - rise)));

const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
