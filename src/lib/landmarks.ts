/**
 * Verified IIM Shillong (Umsawli) landmarks, supplied by the organizing team.
 * Pure data + helpers so the navigator can render without a network call.
 */

export type Zone = "academic" | "landmark" | "life" | "sports" | "stay";

export type Landmark = {
  id: string;
  name: string;
  short: string;
  zone: Zone;
  lat: number;
  lng: number;
  inside?: string[];
  note?: string;
};

export const ZONES: { key: Zone | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "academic", label: "Halls & venues" },
  { key: "stay", label: "Hostels" },
  { key: "life", label: "Food & shops" },
  { key: "sports", label: "Sports" },
  { key: "landmark", label: "Landmarks" },
];

export const LANDMARKS: Landmark[] = [
  { id: "admin", name: "Admin Block", short: "Admin", zone: "academic", lat: 25.616056, lng: 91.954139, inside: ["Auditorium", "Library", "L-Shaped Hall"], note: "Plenaries and keynotes." },
  { id: "kalam-statue", name: "Dr. Kalam Statue", short: "Statue", zone: "landmark", lat: 25.615111, lng: 91.954722, note: "In front of the Admin Block, an easy meeting point." },
  { id: "admin-parking", name: "Admin Block Parking", short: "Parking", zone: "landmark", lat: 25.615281, lng: 91.95398, note: "Cab drop-off and pick-up." },
  { id: "nab", name: "New Academic Block (NAB)", short: "NAB", zone: "academic", lat: 25.616948, lng: 91.953143, note: "Classrooms for parallel paper sessions." },
  { id: "kalam-centre", name: "Dr. Kalam Centre", short: "Kalam Centre", zone: "academic", lat: 25.618117, lng: 91.951893, inside: ["Incubation Centre"] },
  { id: "lake", name: "Campus Lake", short: "Lake", zone: "landmark", lat: 25.617057, lng: 91.951774, note: "A quiet walk between sessions." },
  { id: "gym", name: "Gym", short: "Gym", zone: "sports", lat: 25.618861, lng: 91.950667 },
  { id: "basketball", name: "Basketball Courts", short: "Basketball", zone: "sports", lat: 25.618757, lng: 91.950574 },
  { id: "volleyball", name: "Volleyball Court", short: "Volleyball", zone: "sports", lat: 25.619172, lng: 91.950012 },
  { id: "football", name: "Football Ground", short: "Football", zone: "sports", lat: 25.619439, lng: 91.950969 },
  { id: "commercial", name: "Commercial Complex", short: "Shops", zone: "life", lat: 25.619459, lng: 91.949509, inside: ["Jim's Shop", "Mithaas", "Golmei", "Fruit & Vegetable Shop", "Salon", "TK's", "AJ's Laundry"] },
  { id: "mess", name: "Mess", short: "Mess", zone: "life", lat: 25.620067, lng: 91.949245, note: "Breakfast, lunch, snacks and dinner." },
  { id: "hostel-1", name: "Hostel 1", short: "H1", zone: "stay", lat: 25.620047, lng: 91.950272, inside: ["A Block", "B Block", "C Block", "D Block"] },
  { id: "hostel-4", name: "Hostel 4", short: "H4", zone: "stay", lat: 25.620485, lng: 91.950074, inside: ["L Block", "M Block", "N Block", "O Block"] },
  { id: "hostel-2", name: "Hostel 2", short: "H2", zone: "stay", lat: 25.621216, lng: 91.950044, inside: ["E Block", "F Block", "G Block"] },
  { id: "hostel-3", name: "Hostel 3", short: "H3", zone: "stay", lat: 25.62169, lng: 91.949454, inside: ["H Block", "I Block", "J Block", "K Block"] },
];

/** Straight-line distance in metres (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Walking minutes on a hill campus: path ≈ 1.3× straight line, ~70 m/min. Min 1. */
export function walkMinutes(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.max(1, Math.round((distanceMeters(a, b) * 1.3) / 70));
}

const pad = 0.0006;
export const BOUNDS = {
  minLat: Math.min(...LANDMARKS.map((l) => l.lat)) - pad,
  maxLat: Math.max(...LANDMARKS.map((l) => l.lat)) + pad,
  minLng: Math.min(...LANDMARKS.map((l) => l.lng)) - pad,
  maxLng: Math.max(...LANDMARKS.map((l) => l.lng)) + pad,
};

/** Project lat/lng into a 0..W x 0..H canvas (north up, equirectangular, aspect-correct). */
export function project(lat: number, lng: number, W: number) {
  const kx = Math.cos((25.618 * Math.PI) / 180);
  const spanX = (BOUNDS.maxLng - BOUNDS.minLng) * kx;
  const spanY = BOUNDS.maxLat - BOUNDS.minLat;
  const H = (W * spanY) / spanX;
  return {
    x: ((lng - BOUNDS.minLng) * kx * W) / spanX,
    y: ((BOUNDS.maxLat - lat) * H) / spanY,
    H,
  };
}
