/**
 * Walking router over the real campus road network (OpenStreetMap ways).
 * Pure and deterministic: builds a graph once, snaps landmarks to the nearest
 * road vertex, and runs Dijkstra. Falls back to a straight line if unreachable.
 */
import { CAMPUS_WAYS } from "./campus-geo";
import { distanceMeters } from "./landmarks";

type P = [number, number];
type Graph = { nodes: P[]; adj: Map<number, { to: number; w: number }[]> };

const SNAP_M = 6;
let cached: Graph | null = null;

function key(p: P) {
  return `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
}
const d = (a: P, b: P) => distanceMeters({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });

export function campusGraph(): Graph {
  if (cached) return cached;
  const nodes: P[] = [];
  const index = new Map<string, number>();
  const adj = new Map<number, { to: number; w: number }[]>();
  const idOf = (p: P) => {
    const k = key(p);
    const hit = index.get(k);
    if (hit !== undefined) return hit;
    // merge with an existing vertex within SNAP_M (joins ways drawn slightly apart)
    for (let i = 0; i < nodes.length; i++) if (d(nodes[i]!, p) < SNAP_M) return index.set(k, i), i;
    nodes.push(p);
    index.set(k, nodes.length - 1);
    return nodes.length - 1;
  };
  const link = (a: number, b: number) => {
    if (a === b) return;
    const w = d(nodes[a]!, nodes[b]!);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, w });
    (adj.get(b) ?? adj.set(b, []).get(b)!).push({ to: a, w });
  };
  for (const way of CAMPUS_WAYS) {
    if (way.kind === "forest") continue;
    let prev = -1;
    for (const p of way.pts) {
      const id = idOf(p);
      if (prev >= 0) link(prev, id);
      prev = id;
    }
  }
  cached = { nodes, adj };
  return cached;
}

function nearest(g: Graph, p: P) {
  let best = 0;
  let bd = Infinity;
  g.nodes.forEach((n, i) => {
    const x = d(n, p);
    if (x < bd) (bd = x), (best = i);
  });
  return { id: best, dist: bd };
}

export type Route = { path: P[]; meters: number; minutes: number; onRoads: boolean };

/** Hill campus: ~65 m/min walking pace. Minimum 1 minute. */
export const minutesFor = (m: number) => Math.max(1, Math.round(m / 65));

export function walkRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Route {
  const a: P = [from.lat, from.lng];
  const b: P = [to.lat, to.lng];
  const straight = d(a, b);
  const g = campusGraph();
  const s = nearest(g, a);
  const t = nearest(g, b);
  // Very short hops, or landmarks far off the network: just walk across.
  if (straight < 60 || s.id === t.id) return { path: [a, b], meters: straight, minutes: minutesFor(straight), onRoads: false };

  const dist = new Map<number, number>([[s.id, 0]]);
  const prev = new Map<number, number>();
  const open = new Set<number>([s.id]);
  while (open.size) {
    let u = -1;
    let du = Infinity;
    for (const n of open) if ((dist.get(n) ?? Infinity) < du) (du = dist.get(n)!), (u = n);
    open.delete(u);
    if (u === t.id) break;
    for (const { to: v, w } of g.adj.get(u) ?? []) {
      const nd = du + w;
      if (nd < (dist.get(v) ?? Infinity)) dist.set(v, nd), prev.set(v, u), open.add(v);
    }
  }
  const roadM = dist.get(t.id);
  const total = roadM === undefined ? Infinity : roadM + s.dist + t.dist;
  // If roads are a big detour (paths/stairs we don't have mapped), prefer the footpath line.
  if (!Number.isFinite(total) || total > straight * 2.2) {
    const m = straight * 1.25;
    return { path: [a, b], meters: m, minutes: minutesFor(m), onRoads: false };
  }
  const chain: P[] = [];
  for (let c: number | undefined = t.id; c !== undefined; c = prev.get(c)) chain.unshift(g.nodes[c]!);
  return { path: [a, ...chain, b], meters: total, minutes: minutesFor(total), onRoads: true };
}
