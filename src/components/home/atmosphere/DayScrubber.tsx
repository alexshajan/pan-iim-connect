import { useMemo, useRef, useState } from "react";
import { skyLabel, skyPhase, wearFor } from "@/lib/atmosphere";
import { istMinute, type ShillongNow } from "./useShillongNow";

const TINT = { dawn: "var(--loom-gold)", day: "var(--loom-sky)", dusk: "var(--destructive)", night: "var(--loom-ink)" } as const;

/** Drag through today in Shillong: the curve, sky tint and what to wear follow your thumb. */
export function DayScrubber({ d, now }: { d: ShillongNow; now: Date }) {
  const hrs = d.hours.slice(0, 24);
  const nowIdx = Math.max(0, Math.min(hrs.length - 1, Math.floor(istMinute(now) / 60)));
  const [idx, setIdx] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const i = idx ?? nowIdx;
  const h = hrs[i]!;
  const lo = Math.min(...hrs.map((x) => x.temp)), hi = Math.max(...hrs.map((x) => x.temp));
  const pts = useMemo(() => hrs.map((x, k) => [(k / (hrs.length - 1)) * 200, 30 - ((x.temp - lo) / Math.max(1, hi - lo)) * 22] as const), [hrs, lo, hi]);
  const path = pts.reduce((acc, [x, y], k) => {
    if (!k) return `M${x} ${y}`;
    const [px, py] = pts[k - 1]!; const cx = (px + x) / 2;
    return `${acc} C${cx} ${py} ${cx} ${y} ${x} ${y}`;
  }, "");
  const phase = skyPhase(h.min + 30, d.rise, d.set);
  const pick = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const k = Math.round(((clientX - r.left) / r.width) * (hrs.length - 1));
    const n = Math.max(0, Math.min(hrs.length - 1, k));
    if (n !== idx) { setIdx(n); navigator.vibrate?.(4); }
  };
  const [x, y] = pts[i]!;
  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Shillong today, hour by hour"
      aria-valuemin={0} aria-valuemax={23} aria-valuenow={i}
      aria-valuetext={`${h.label}:00, ${h.temp} degrees, ${wearFor(h.temp)}`}
      onKeyDown={(e) => { if (e.key === "ArrowRight") setIdx(Math.min(hrs.length - 1, i + 1)); if (e.key === "ArrowLeft") setIdx(Math.max(0, i - 1)); }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pick(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === "mouse") pick(e.clientX); }}
      onPointerLeave={() => setIdx(null)}
      onPointerUp={(e) => { if (e.pointerType !== "mouse") setTimeout(() => setIdx(null), 1600); }}
      className="atmo-card relative cursor-ew-resize touch-pan-y overflow-hidden px-3 py-2"
      style={{ backgroundImage: `linear-gradient(180deg, color-mix(in oklab, ${TINT[phase]} 38%, var(--primary)), var(--primary))`, transition: "background-image .6s" }}
    >
      <div className="relative flex items-baseline justify-between">
        <span className="text-[0.62rem] font-semibold opacity-80">{idx == null ? "Now" : `${h.label}:00`} in Shillong</span>
        <span key={wearFor(h.temp)} className="rise rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[0.62rem] font-semibold">{wearFor(h.temp)}</span>
      </div>
      <div className="relative flex items-baseline gap-2">
        <span key={h.temp} className="flap-anim text-[1.45rem] font-semibold leading-none tabular-nums">{h.temp}°</span>
        <span className="truncate text-[0.68rem] opacity-80">{skyLabel(h.code)}</span>
      </div>
      <svg viewBox="0 0 200 34" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-7 w-full" aria-hidden>
        <path d={`${path} L200 34 L0 34Z`} fill="var(--primary-foreground)" opacity="0.1" />
        <path d={path} fill="none" stroke="var(--loom-gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line x1={x} x2={x} y1="0" y2="34" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" style={{ transition: "all .15s" }} />
      </svg>
      <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--loom-gold)] ring-2 ring-primary-foreground transition-all duration-150" style={{ left: `${(x / 200) * 100}%`, top: `calc(100% - 1.75rem + ${(y / 34) * 1.75}rem)` }} aria-hidden />
    </div>
  );
}
