/**
 * Platform-aware map deep links.
 *
 * iOS opens Apple Maps (native turn-by-turn, no account, no app-switch prompt),
 * everything else opens Google Maps. Both fall back to the web experience when
 * the native app is missing.
 */

export const CAMPUS = { lat: 25.616056, lng: 91.954139, label: "IIM Shillong, Umsawli" };

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
  return isIOS || isIPadOS;
}

/** Turn-by-turn walking directions to a coordinate. */
export function directionsUrl(lat: number, lng: number, label?: string) {
  const name = label ? encodeURIComponent(label) : "";
  if (isApplePlatform()) {
    return `https://maps.apple.com/?daddr=${lat},${lng}${name ? `&q=${name}` : ""}&dirflg=w`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

/** A dropped pin (no route), useful for "show me where this is". */
export function placeUrl(lat: number, lng: number, label?: string) {
  const name = label ? encodeURIComponent(label) : `${lat},${lng}`;
  if (isApplePlatform()) return `https://maps.apple.com/?ll=${lat},${lng}&q=${name}`;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Embedded OpenStreetMap view centred on a coordinate, no API key required. */
export function embedUrl(lat: number, lng: number, spread = 0.007) {
  const bbox = [lng - spread, lat - spread * 0.75, lng + spread, lat + spread * 0.75]
    .map((n) => n.toFixed(5))
    .join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

import { LANDMARKS } from "./landmarks";

/** Campus bounds; venue coordinates outside this are old placeholders and ignored. */
const CAMPUS_BOX = { minLat: 25.61, maxLat: 25.625, minLng: 91.945, maxLng: 91.96 };
const NAME_TO_LANDMARK: [RegExp, string][] = [
  [/\bnab\b|new academic/i, "nab"],
  [/kalam centre|incubation/i, "kalam-centre"],
  [/admin|auditorium|l[- ]?shaped|l-hall|library/i, "admin"],
  [/mess|dining/i, "mess"],
];

/**
 * Where a venue really is. Name match to verified campus landmarks wins;
 * stored coordinates are used only if they fall inside campus (or the venue is offsite).
 */
export function venuePoint(
  v: { name?: string | null; short_name?: string | null; kind?: string | null; lat?: number | null; lng?: number | null } | null | undefined,
  room?: string | null,
): { lat: number; lng: number; label: string } | null {
  const text = [v?.name, v?.short_name, room].filter(Boolean).join(" ");
  for (const [re, id] of NAME_TO_LANDMARK) {
    if (re.test(text)) {
      const l = LANDMARKS.find((x) => x.id === id)!;
      return { lat: l.lat, lng: l.lng, label: l.name };
    }
  }
  if (v?.lat != null && v?.lng != null) {
    const inCampus = v.lat >= CAMPUS_BOX.minLat && v.lat <= CAMPUS_BOX.maxLat && v.lng >= CAMPUS_BOX.minLng && v.lng <= CAMPUS_BOX.maxLng;
    if (inCampus || v.kind === "offsite") return { lat: v.lat, lng: v.lng, label: v.name ?? "Venue" };
  }
  return text ? { ...CAMPUS, label: CAMPUS.label } : null;
}
