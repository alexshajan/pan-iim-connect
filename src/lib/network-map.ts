/**
 * Pure helpers for the Network map: who is on it, where each dot sits, and the
 * track overlap counts. No data access here; pages pass in directory rows and
 * the signed-in person's connections.
 */
import { keywordOverlap, type DirPerson } from "./network";

export type MapRing = "me" | "met" | "suggested";

export type MapNode = {
  code: string;
  name: string;
  organization: string | null;
  /** Conference tracks from the person's papers, most frequent first. */
  tracks: string[];
  ring: MapRing;
  /** Why a suggested person is on the map (shared track or keywords). */
  reasons: string[];
};

export type MeForMap = { code: string; name: string; keywords: string[]; tracks: string[] };
export type MetLite = { code: string; full_name: string; organization: string | null };

/** Tracks for a directory row, most papers first, then alphabetical. */
export function tracksOf(p: Pick<DirPerson, "papers">): string[] {
  const n = new Map<string, number>();
  for (const x of p.papers) if (x.track) n.set(x.track, (n.get(x.track) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/**
 * Builds the map population: you, everyone you have met, and (when `withSuggested`)
 * listed people who share a track or keywords with you and whom you have not met.
 * Second-degree links are not available to the client, so the outer ring is
 * "worth meeting", not "friends of friends".
 */
export function mapPeople(
  me: MeForMap,
  met: MetLite[],
  directory: DirPerson[],
  opts: { withSuggested: boolean; maxSuggested?: number },
): MapNode[] {
  const byCode = new Map(directory.map((p) => [p.code, p]));
  const metCodes = new Set(met.map((m) => m.code));
  const nodes: MapNode[] = [
    {
      code: me.code,
      name: me.name,
      organization: null,
      tracks: me.tracks,
      ring: "me",
      reasons: [],
    },
  ];
  for (const m of met) {
    if (m.code === me.code) continue;
    const d = byCode.get(m.code);
    nodes.push({
      code: m.code,
      name: d?.full_name ?? m.full_name,
      organization: d?.organization ?? m.organization,
      tracks: d ? tracksOf(d) : [],
      ring: "met",
      reasons: [],
    });
  }
  if (!opts.withSuggested) return nodes;
  const ranked = directory
    .filter((p) => p.code !== me.code && !metCodes.has(p.code))
    .map((p) => {
      const t = tracksOf(p);
      const sharedTracks = t.filter((x) => me.tracks.includes(x));
      const sharedKw = keywordOverlap(me.keywords, p.keywords);
      const reasons = [
        ...sharedTracks.map((x) => `Also in ${x}`),
        ...(sharedKw.length ? [`Shares: ${sharedKw.slice(0, 3).join(", ")}`] : []),
      ];
      return { p, t, reasons, score: sharedTracks.length * 2 + sharedKw.length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.full_name.localeCompare(b.p.full_name))
    .slice(0, opts.maxSuggested ?? 14);
  for (const x of ranked)
    nodes.push({
      code: x.p.code,
      name: x.p.full_name,
      organization: x.p.organization,
      tracks: x.t,
      ring: "suggested",
      reasons: x.reasons,
    });
  return nodes;
}

/** Track names in a stable order: most people first, then alphabetical. */
export function trackOrder(nodes: Pick<MapNode, "tracks" | "ring">[]): string[] {
  const n = new Map<string, number>();
  for (const x of nodes)
    if (x.ring !== "me" && x.tracks[0]) n.set(x.tracks[0], (n.get(x.tracks[0]) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** Colour per track. Hues differ and lightness alternates, so neighbours stay distinguishable. */
export const TRACK_COLOURS = [
  "#2e7d5b",
  "#b8641c",
  "#5b5bb0",
  "#2a7a9b",
  "#a2477a",
  "#7c7a1f",
  "#3f6fd1",
  "#b03a3a",
] as const;
export function trackColours(tracks: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  tracks.forEach((t, i) => (out[t] = TRACK_COLOURS[i % TRACK_COLOURS.length]!));
  return out;
}

export type Placed = { x: number; y: number; r: number };
export type Layout = {
  pos: Record<string, Placed>;
  anchors: Record<string, { x: number; y: number }>;
  hullR: number;
};

/** Dot radius: you are largest, people you met next, suggestions smallest. */
export const radiusFor = (ring: MapRing) => (ring === "me" ? 20 : ring === "met" ? 13 : 8);

/**
 * Places every dot. Each track gets a fixed anchor on an ellipse around you; people
 * are pulled to the anchor of their first track (between two anchors when they have
 * two), people you met sit partway between you and their track, then dots are
 * pushed apart so none overlap. Deterministic for the same input.
 */
export function layoutMap(nodes: MapNode[], width: number, height: number, maxTracks = 6): Layout {
  const cx = width / 2;
  const cy = height / 2;
  const tracks = trackOrder(nodes).slice(0, maxTracks);
  const rx = Math.min(width * 0.36, height * 0.48);
  const ry = height * 0.34;
  const anchors: Layout["anchors"] = {};
  tracks.forEach((t, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(tracks.length, 1);
    anchors[t] = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
  const target = (n: MapNode) => {
    if (n.ring === "me") return { x: cx, y: cy };
    const own = n.tracks.filter((t) => anchors[t]);
    let t = { x: cx, y: cy + ry * 0.9 }; // no listed track: below you
    if (own.length === 1) t = anchors[own[0]!]!;
    if (own.length >= 2) {
      const a = anchors[own[0]!]!;
      const b = anchors[own[1]!]!;
      t = { x: a.x * 0.62 + b.x * 0.38, y: a.y * 0.62 + b.y * 0.38 };
    }
    if (n.ring === "met") t = { x: cx + (t.x - cx) * 0.7, y: cy + (t.y - cy) * 0.7 };
    return t;
  };
  const P = nodes.map((n, i) => {
    const t = target(n);
    const a = i * 2.399963;
    return {
      code: n.code,
      ring: n.ring,
      r: radiusFor(n.ring),
      tx: t.x,
      ty: t.y,
      x: t.x + Math.cos(a) * 14,
      y: t.y + Math.sin(a) * 14,
    };
  });
  for (let it = 0; it < 260; it++) {
    const k = 1 - it / 300;
    for (const n of P) {
      if (n.ring === "me") continue;
      n.x += (n.tx - n.x) * 0.12 * k;
      n.y += (n.ty - n.y) * 0.12 * k;
    }
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i]!;
        const b = P[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + 16;
        if (d >= min) continue;
        if (d < 0.01) {
          dx = 0.5;
          dy = 0.3;
          d = 0.58;
        }
        const push = ((min - d) / d) * 0.5;
        if (a.ring !== "me") {
          a.x -= dx * push;
          a.y -= dy * push;
        }
        if (b.ring !== "me") {
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    for (const n of P) {
      if (n.ring === "me") {
        n.x = cx;
        n.y = cy;
        continue;
      }
      n.x = Math.max(n.r + 14, Math.min(width - n.r - 14, n.x));
      n.y = Math.max(n.r + 22, Math.min(height - n.r - 22, n.y));
    }
  }
  const pos: Layout["pos"] = {};
  for (const n of P) pos[n.code] = { x: n.x, y: n.y, r: n.r };
  return { pos, anchors, hullR: Math.min(width, height) * 0.17 };
}

/** Region key for up to three picked tracks: "1"/"0" per track, padded to three. */
export function regionKey(tracks: string[], picked: string[]): string {
  const bits = picked.map((t) => (tracks.includes(t) ? "1" : "0")).join("");
  return (bits + "000").slice(0, 3);
}

/**
 * Overlap counts for up to three tracks. Everyone holding at least one picked track
 * lands in exactly one region, so the region sizes always add up to `total`.
 * `keys` keeps display order (object key order is not reliable for "010" vs "100").
 */
export function overlap(people: { code: string; tracks: string[] }[], picked: string[]) {
  const p = picked.slice(0, 3);
  const keys =
    p.length === 3
      ? ["100", "010", "001", "110", "101", "011", "111"]
      : p.length === 2
        ? ["100", "010", "110"]
        : p.length === 1
          ? ["100"]
          : [];
  const regions: Record<string, string[]> = Object.fromEntries(
    keys.map((k) => [k, [] as string[]]),
  );
  let total = 0;
  for (const x of people) {
    const k = regionKey(x.tracks, p);
    if (k === "000" || !(k in regions)) continue;
    regions[k]!.push(x.code);
    total += 1;
  }
  return { keys, regions, total };
}

/** Plain-language label for a region, e.g. "Finance + Strategy" or "Finance only". */
export function regionLabel(key: string, picked: string[]): string {
  const on = picked.filter((_, i) => key[i] === "1");
  return on.length === 1 ? `${on[0]} only` : on.join(" + ");
}
