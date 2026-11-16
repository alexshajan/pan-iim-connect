import { setFlag } from "@/lib/stamps";
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from "react";
import { Crosshair, Footprints, Layers, Map as MapIcon, Minus, Navigation, Plus, X } from "lucide-react";
import { FilterChip } from "@/components/AppShell";
import { LANDMARKS, ZONES, type Landmark, type Zone } from "@/lib/landmarks";
import { CAMPUS_WAYS } from "@/lib/campus-geo";
import { walkRoute } from "@/lib/campus-route";
import { directionsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";
import adminArt from "@/assets/campus/admin.png";
import nabArt from "@/assets/campus/nab.png";
import kalamArt from "@/assets/campus/kalam.png";
import lakeArt from "@/assets/campus/lake.png";
import sportsArt from "@/assets/campus/sports.png";
import diningArt from "@/assets/campus/dining.png";
import hostelArt from "@/assets/campus/hostel.png";

/* ---------- projection over a fixed campus frame (north up) ---------- */
const FRAME = { minLat: 25.6138, maxLat: 25.6226, minLng: 91.9474, maxLng: 91.9572 };
const KX = Math.cos((25.618 * Math.PI) / 180);
const W = 1000;
const H = Math.round((W * (FRAME.maxLat - FRAME.minLat)) / ((FRAME.maxLng - FRAME.minLng) * KX));
const px = (lat: number, lng: number) => ({
  x: ((lng - FRAME.minLng) / (FRAME.maxLng - FRAME.minLng)) * W,
  y: ((FRAME.maxLat - lat) / (FRAME.maxLat - FRAME.minLat)) * H,
});
const pathD = (pts: [number, number][]) =>
  pts.map(([la, ln], i) => {
    const p = px(la, ln);
    return `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join("");

/* Illustrated tokens for the big landmarks; the rest get stamped pins. */
const ART: Record<string, { src: string; size: number; dx?: number; dy?: number }> = {
  admin: { src: adminArt, size: 120 },
  nab: { src: nabArt, size: 110 },
  "kalam-centre": { src: kalamArt, size: 100, dx: 10, dy: -20 },
  lake: { src: lakeArt, size: 100, dx: -10, dy: 20 },
  football: { src: sportsArt, size: 120, dx: 20, dy: -10 },
  commercial: { src: diningArt, size: 90, dx: -30, dy: 25 },
  "hostel-2": { src: hostelArt, size: 100, dx: 30 },
};
const ZONE_FILL: Record<Zone, string> = {
  academic: "var(--primary)",
  landmark: "var(--accent-foreground)",
  life: "oklch(0.62 0.13 45)",
  sports: "oklch(0.55 0.09 150)",
  stay: "var(--foreground)",
};

const ROAD_W: Record<string, number> = { unclassified: 13, residential: 9, service: 7, track: 4 };

export function CampusNavigator({ initialId }: { initialId?: string | undefined }) {
  const [zone, setZone] = useState<Zone | "all">("all");
  const [selected, setSelected] = useState<Landmark | null>(() => LANDMARKS.find((l) => l.id === initialId) ?? null);
  const [from, setFrom] = useState<Landmark>(LANDMARKS.find((l) => l.id === "admin-parking")!);
  const [mode, setMode] = useState<"campus" | "satellite">("campus");
  const [view, setView] = useState({ k: 1.25, x: -110, y: -60 });
  const wrap = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; k: number; moved: number } | null>(null);

  useEffect(() => {
    const hit = LANDMARKS.find((l) => l.id === initialId);
    if (hit) focus(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const route = useMemo(
    () => (selected && selected.id !== from.id ? walkRoute(from, selected) : null),
    [selected, from],
  );
  const routeD = route ? pathD(route.path) : "";
  const visible = (l: Landmark) => zone === "all" || l.zone === zone;

  /* ---------- pan / pinch / wheel ---------- */
  const scale = () => (wrap.current ? wrap.current.clientWidth / W : 1);
  const clamp = (v: { k: number; x: number; y: number }) => {
    const k = Math.min(4, Math.max(1, v.k));
    const s = scale();
    const vw = (wrap.current?.clientWidth ?? W) / s;
    const vh = (wrap.current?.clientHeight ?? H) / s;
    return { k, x: Math.min(0, Math.max(vw - W * k, v.x)), y: Math.min(0, Math.max(vh - H * k, v.y)) };
  };
  function zoomAt(f: number, cx = W / 2, cy = H / 2) {
    setView((v) => {
      const k = Math.min(4, Math.max(1, v.k * f));
      const r = k / v.k;
      return clamp({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r });
    });
  }
  function focus(l: Landmark) {
    setSelected(l);
    if (l.id === "lake") setFlag("lake");
    const p = px(l.lat, l.lng);
    const s = scale();
    const vw = (wrap.current?.clientWidth ?? W) / s;
    const vh = (wrap.current?.clientHeight ?? H) / s;
    setView((v) => {
      const k = Math.max(v.k, 1.8);
      return clamp({ k, x: vw / 2 - p.x * k, y: vh / 2 - p.y * k });
    });
  }
  const onDown = (e: RPE) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = { dist: pts.length === 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0, k: view.k, moved: 0 };
  };
  const onMove = (e: RPE) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = scale();
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && gesture.current.dist) {
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const rect = wrap.current!.getBoundingClientRect();
      const cx = ((pts[0]!.x + pts[1]!.x) / 2 - rect.left) / s;
      const cy = ((pts[0]!.y + pts[1]!.y) / 2 - rect.top) / s;
      const target = gesture.current.k * (dist / gesture.current.dist);
      setView((v) => {
        const r = Math.min(4, Math.max(1, target)) / v.k;
        return clamp({ k: v.k * r, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r });
      });
      gesture.current.moved += 10;
    } else {
      const dx = (e.clientX - prev.x) / s;
      const dy = (e.clientY - prev.y) / s;
      gesture.current.moved += Math.abs(dx) + Math.abs(dy);
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };
  const onUp = (e: RPE) => {
    pointers.current.delete(e.pointerId);
  };
  const tap = (l: Landmark) => {
    if ((gesture.current?.moved ?? 0) > 8) return;
    focus(l);
  };

  return (
    <div>
      <div className="card-surface relative overflow-hidden">
        <div className="absolute right-3 top-3 z-10 flex rounded-full bg-background/90 p-1 shadow-sm backdrop-blur">
          {(["campus", "satellite"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "tap flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {m === "campus" ? <MapIcon className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
              {m === "campus" ? "Illustrated" : "Satellite"}
            </button>
          ))}
        </div>

        {mode === "campus" ? (
          <>
            <div
              ref={wrap}
              className="relative aspect-square w-full touch-none select-none overflow-hidden"
              style={{ background: "oklch(0.93 0.035 135)" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onWheel={(e) => {
                const rect = wrap.current!.getBoundingClientRect();
                const s = scale();
                zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - rect.left) / s, (e.clientY - rect.top) / s);
              }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="absolute left-0 top-0 h-auto w-full origin-top-left"
                style={{ transform: `scale(${1}) translate(0,0)` }}
                role="img"
                aria-label="Illustrated map of IIM Shillong campus with real roads"
              >
                <defs>
                  <pattern id="pines" width="46" height="40" patternUnits="userSpaceOnUse">
                    <path d="M10 30 l6 -14 l6 14z" fill="oklch(0.62 0.08 150 / 0.35)" />
                    <path d="M30 18 l5 -12 l5 12z" fill="oklch(0.55 0.08 150 / 0.3)" />
                  </pattern>
                  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#1b2e22" floodOpacity="0.25" />
                  </filter>
                </defs>
                <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} style={{ transition: pointers.current.size ? "none" : "transform 380ms cubic-bezier(.2,.8,.2,1)" }}>
                  <rect width={W} height={H} fill="url(#pines)" />
                  {/* campus terraces */}
                  {[
                    { c: [25.6205, 91.9497], r: 150, f: "oklch(0.95 0.03 95)" },
                    { c: [25.619, 91.9505], r: 110, f: "oklch(0.9 0.06 140)" },
                    { c: [25.6162, 91.9535], r: 170, f: "oklch(0.95 0.025 90)" },
                  ].map((z, i) => {
                    const p = px(z.c[0]!, z.c[1]!);
                    return <ellipse key={i} cx={p.x} cy={p.y} rx={z.r} ry={z.r * 0.8} fill={z.f} opacity="0.85" />;
                  })}
                  {/* lake */}
                  {(() => {
                    const p = px(25.61705, 91.95178);
                    return <path d={`M${p.x - 42},${p.y} q8,-30 44,-26 q38,4 40,26 q-4,28 -42,26 q-36,-2 -42,-26z`} fill="oklch(0.78 0.07 210)" stroke="oklch(0.65 0.07 210)" strokeWidth="2" />;
                  })()}
                  {/* football pitch */}
                  {(() => {
                    const p = px(25.61944, 91.95097);
                    return (
                      <g transform={`translate(${p.x} ${p.y}) rotate(-28)`}>
                        <rect x="-46" y="-28" width="92" height="56" rx="4" fill="oklch(0.72 0.12 145)" stroke="white" strokeWidth="2" />
                        <line x1="0" y1="-28" x2="0" y2="28" stroke="white" strokeWidth="1.5" />
                        <circle r="9" fill="none" stroke="white" strokeWidth="1.5" />
                      </g>
                    );
                  })()}
                  {/* real roads: casing then surface */}
                  {CAMPUS_WAYS.filter((w) => w.kind !== "forest").map((w, i) => (
                    <path key={`c${i}`} d={pathD(w.pts)} fill="none" stroke="oklch(0.8 0.02 90)" strokeWidth={(ROAD_W[w.kind] ?? 6) + 4} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {CAMPUS_WAYS.filter((w) => w.kind !== "forest").map((w, i) => (
                    <path
                      key={`r${i}`}
                      d={pathD(w.pts)}
                      fill="none"
                      stroke={w.kind === "track" ? "oklch(0.75 0.05 70)" : "oklch(0.99 0.005 90)"}
                      strokeWidth={ROAD_W[w.kind] ?? 6}
                      strokeDasharray={w.kind === "track" ? "6 6" : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {/* walking route */}
                  {route ? (
                    <>
                      <path d={routeD} fill="none" stroke="var(--primary)" strokeOpacity="0.25" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={routeD} fill="none" stroke="var(--primary)" strokeWidth="5" strokeDasharray="2 12" strokeLinecap="round" className="campus-ants" />
                    </>
                  ) : null}
                  {/* illustrated tokens */}
                  {LANDMARKS.filter((l) => ART[l.id]).map((l) => {
                    const a = ART[l.id]!;
                    const p = px(l.lat, l.lng);
                    const on = selected?.id === l.id;
                    const s = a.size * 1.5 * (on ? 1.15 : 1);
                    return (
                      <image
                        key={`art-${l.id}`}
                        href={a.src}
                        x={p.x + (a.dx ?? 0) - s / 2}
                        y={p.y + (a.dy ?? 0) - s * 0.82}
                        width={s}
                        height={s}
                        opacity={visible(l) ? 1 : 0.25}
                        filter="url(#soft)"
                        style={{ transition: "all 300ms", cursor: "pointer" }}
                        onClick={() => tap(l)}
                      />
                    );
                  })}
                  {/* pins */}
                  {LANDMARKS.map((l) => {
                    const p = px(l.lat, l.lng);
                    const on = selected?.id === l.id;
                    const isFrom = from.id === l.id && !!route;
                    const r = (on ? 9 : 6) / Math.sqrt(view.k);
                    return (
                      <g
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        aria-label={l.name}
                        onClick={() => tap(l)}
                        onKeyDown={(e) => e.key === "Enter" && focus(l)}
                        className="cursor-pointer"
                        opacity={visible(l) ? 1 : 0.2}
                      >
                        {on ? <circle cx={p.x} cy={p.y} r={r * 2.4} fill="var(--primary)" opacity="0.18" className="campus-pulse" /> : null}
                        <circle cx={p.x} cy={p.y} r={r} fill={isFrom ? "var(--background)" : ZONE_FILL[l.zone]} stroke={isFrom ? "var(--primary)" : "white"} strokeWidth={2.5 / Math.sqrt(view.k)} />
                        {(view.k > 1.6 || on || !ART[l.id]) && (
                          <g transform={`translate(${p.x} ${p.y + r + 13 / view.k})`}>
                            <text
                              textAnchor="middle"
                              fontSize={(on ? 15 : 12) / Math.sqrt(view.k)}
                              fontWeight={700}
                              fill="var(--foreground)"
                              stroke="oklch(0.98 0.01 90)"
                              strokeWidth={4 / Math.sqrt(view.k)}
                              paintOrder="stroke"
                            >
                              {l.short}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* compass + controls */}
              <div className="pointer-events-none absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-background/90 text-[0.6rem] font-bold tracking-widest shadow-sm backdrop-blur">
                N<span className="-mt-1 text-primary">▲</span>
              </div>
              <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-2xl bg-background/90 shadow-sm backdrop-blur">
                <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.4)} className="tap p-2.5"><Plus className="h-4 w-4" /></button>
                <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4)} className="tap border-t border-border p-2.5"><Minus className="h-4 w-4" /></button>
                <button type="button" aria-label="Show whole campus" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="tap border-t border-border p-2.5"><Crosshair className="h-4 w-4" /></button>
              </div>
              {route ? (
                <div className="absolute bottom-3 left-3 rounded-2xl bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                  <p className="text-[0.6rem] font-semibold text-muted-foreground">{from.short} → {selected!.short}</p>
                  <p className="text-display text-base leading-tight">{route.minutes} min <span className="text-xs font-medium text-muted-foreground">,  {Math.round(route.meters / 10) * 10} m</span></p>
                </div>
              ) : null}
            </div>
            <p className="px-4 py-2 text-[0.6rem] text-muted-foreground">Roads © OpenStreetMap contributors, drag, pinch or scroll to explore</p>
          </>
        ) : (
          <iframe
            title={`Satellite view of ${selected?.name ?? "IIM Shillong"}`}
            className="aspect-[4/5] w-full border-0 sm:aspect-[4/3]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://maps.google.com/maps?q=${(selected ?? LANDMARKS[0]!).lat},${(selected ?? LANDMARKS[0]!).lng}&t=k&z=18&output=embed`}
          />
        )}
      </div>

      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {ZONES.map((z) => (
          <FilterChip key={z.key} active={zone === z.key} onClick={() => setZone(z.key)}>
            {z.label}
          </FilterChip>
        ))}
      </div>

      {selected ? (
        <div className="card-surface mt-4 overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4">
            {ART[selected.id] ? (
              <img src={ART[selected.id]!.src} alt="" width={72} height={72} className="-my-1 h-[72px] w-[72px] shrink-0 object-contain" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-semibold text-muted-foreground">
                {ZONES.find((z) => z.key === selected.zone)?.label}
              </p>
              <h3 className="text-display mt-0.5 text-lg leading-snug">{selected.name}</h3>
              {selected.note ? <p className="mt-1 text-sm text-muted-foreground">{selected.note}</p> : null}
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="tap rounded-full p-1.5 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-4">
            {selected.inside?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {selected.inside.map((i) => (
                  <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{i}</span>
                ))}
              </div>
            ) : null}
            <label className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Footprints className="h-3.5 w-3.5" />
              Walking from
              <select
                value={from.id}
                onChange={(e) => setFrom(LANDMARKS.find((l) => l.id === e.target.value)!)}
                className="rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                {LANDMARKS.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {route ? <span className="font-semibold text-foreground">≈ {route.minutes} min{route.onRoads ? " by road" : " on foot"}</span> : null}
            </label>
            <a
              href={directionsUrl(selected.lat, selected.lng, selected.name)}
              target="_blank"
              rel="noreferrer"
              className="tap mt-4 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Navigation className="h-4 w-4" /> Walk me there in Maps
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {LANDMARKS.filter(visible).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => focus(l)}
              className="card-surface tap flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
            >
              <span className="min-w-0">
                <span className="text-display block text-[0.95rem]">{l.name}</span>
                {l.inside?.length ? <span className="block truncate text-xs text-muted-foreground">{l.inside.join(", ")}</span> : null}
              </span>
              <span className="shrink-0 text-xs font-semibold text-primary">{walkRoute(from, l).minutes} min</span>
            </button>
          ))}
          <p className="px-1 pt-1 text-[0.7rem] text-muted-foreground">Walking times follow real campus roads from {from.name}.</p>
        </div>
      )}
    </div>
  );
}
