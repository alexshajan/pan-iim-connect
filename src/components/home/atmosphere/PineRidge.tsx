import { useRef, useState } from "react";
import { airWord, skyLabel, skyPhase, sunProgress } from "@/lib/atmosphere";
import { istMinute, type ShillongNow } from "./useShillongNow";

const SKY = {
  dawn: ["color-mix(in oklab, var(--loom-sky) 50%, var(--loom-gold))", "color-mix(in oklab, var(--loom-gold) 45%, var(--card))"],
  day: ["color-mix(in oklab, var(--loom-sky) 85%, var(--primary))", "color-mix(in oklab, var(--loom-sky) 35%, var(--card))"],
  dusk: ["color-mix(in oklab, var(--loom-ink) 45%, var(--destructive))", "color-mix(in oklab, var(--loom-gold) 70%, var(--card))"],
  night: ["color-mix(in oklab, var(--loom-ink) 90%, var(--primary))", "color-mix(in oklab, var(--loom-ink) 60%, var(--loom-pine))"],
} as const;

function pines(y: number, n: number, h: number, seed: number) {
  return Array.from({ length: n }, (_, i) => {
    const x = (i / n) * 220 - 10 + ((i * seed) % 7);
    const s = h * (0.7 + ((i * 13 + seed) % 5) / 10);
    return { x, y: y + ((i * 7 + seed) % 4), s };
  });
}
const LAYERS = [
  { y: 30, n: 18, h: 9, seed: 3, fill: "color-mix(in oklab, var(--loom-pine) 45%, var(--loom-sky))", depth: 3 },
  { y: 40, n: 15, h: 13, seed: 5, fill: "color-mix(in oklab, var(--loom-pine) 75%, var(--loom-ink))", depth: 7 },
  { y: 52, n: 11, h: 18, seed: 2, fill: "color-mix(in oklab, var(--loom-pine) 55%, var(--loom-ink))", depth: 12 },
];

/** A little window onto the Khasi hills: sky follows real Shillong time, drag to send a breeze through the pines. */
export function PineRidge({ d, now }: { d: ShillongNow; now: Date }) {
  const min = istMinute(now);
  const phase = skyPhase(min, d.rise, d.set);
  const [top, bottom] = SKY[phase];
  const p = sunProgress(min, d.rise, d.set);
  const sunX = 20 + p * 160, sunY = 44 - Math.sin(p * Math.PI) * 34;
  const [lean, setLean] = useState(0);
  const [px, setPx] = useState(0.5);
  const last = useRef<number | null>(null);
  const gust = Math.min(1, Math.abs(lean) / 14);
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    setPx(x);
    if (last.current != null) setLean((l) => Math.max(-16, Math.min(16, l * 0.8 + (e.clientX - last.current!) * 0.9)));
    last.current = e.clientX;
  };
  const settle = () => { last.current = null; setLean(0); setPx(0.5); };
  return (
    <div
      role="img"
      aria-label={`Shillong now: ${d.temp} degrees, ${skyLabel(d.code)}${d.aqi != null ? `, air quality ${d.aqi}` : ""}. Swipe for a breeze`}
      className="atmo-card relative touch-pan-y overflow-hidden p-0"
      onPointerMove={onMove}
      onPointerLeave={settle}
      onPointerUp={settle}
      onPointerCancel={settle}
    >
      <svg viewBox="0 0 200 70" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="ridge-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={top} style={{ transition: "stop-color 1s" }} />
            <stop offset="100%" stopColor={bottom} />
          </linearGradient>
        </defs>
        <rect width="200" height="70" fill="url(#ridge-sky)" />
        {phase === "night"
          ? <>{[12, 40, 70, 95, 130, 160, 185].map((x, i) => <circle key={x} cx={x} cy={6 + (i * 7) % 18} r={0.6 + (i % 2) * 0.4} fill="var(--card)" className="twinkle" style={{ animationDelay: `${i * 0.4}s` }} />)}
              <circle cx="160" cy="14" r="6" fill="var(--card)" opacity="0.9" /><circle cx="163" cy="12" r="5.5" fill={top} /></>
          : <circle cx={sunX} cy={sunY} r="7" fill="var(--loom-gold)" className="sun-glow" />}
        <g className="mist-drift" opacity={phase === "night" ? 0.15 : 0.45}>
          <ellipse cx="50" cy="38" rx="40" ry="3" fill="var(--card)" />
          <ellipse cx="150" cy="46" rx="50" ry="3.5" fill="var(--card)" />
        </g>
        {LAYERS.map((L) => (
          <g key={L.y} style={{ transform: `translateX(${(0.5 - px) * L.depth}px)`, transition: "transform 0.4s cubic-bezier(.2,.8,.2,1)" }}>
            <path d={`M-20 ${L.y + 4} Q 50 ${L.y - 6} 100 ${L.y + 2} T 220 ${L.y} V 80 H -20Z`} fill={L.fill} />
            {pines(L.y, L.n, L.h, L.seed).map((t, i) => (
              <path
                key={i}
                d={`M${t.x} ${t.y - t.s} L${t.x + t.s * 0.32} ${t.y + 1} L${t.x - t.s * 0.32} ${t.y + 1}Z`}
                fill={L.fill}
                style={{ transformOrigin: `${t.x}px ${t.y}px`, transformBox: "view-box", transform: `skewX(${lean * (L.depth / 12) * (0.8 + (i % 3) * 0.15)}deg)`, transition: "transform 0.9s cubic-bezier(.3,1.6,.4,1)" }}
              />
            ))}
          </g>
        ))}
      </svg>
      <div className="relative flex h-full items-start justify-between px-3 pt-2 text-primary-foreground [text-shadow:0_1px_6px_color-mix(in_oklab,var(--loom-ink)_60%,transparent)]">
        <div>
          <p className="text-[0.62rem] font-semibold opacity-90">Shillong now</p>
          <p className="text-[1.5rem] font-semibold leading-none tabular-nums">{d.temp}°</p>
        </div>
        <div className="text-right">
          <p key={gust > 0.2 ? "w" : "s"} className="rise text-[0.7rem] font-semibold">{gust > 0.2 ? `Breeze ${d.wind} km/h` : skyLabel(d.code)}</p>
          <p className="text-[0.62rem] opacity-90">{gust > 0.2 ? `Feels ${d.feels}°` : d.aqi != null ? `${airWord(d.aqi)}, ${d.aqi}` : `${d.lo}–${d.hi}°`}</p>
        </div>
      </div>
      {d.aqi != null && d.aqi <= 50 ? <span className="air-ripple absolute bottom-2 right-3 h-2 w-2 rounded-full bg-card" aria-hidden /> : null}
    </div>
  );
}
