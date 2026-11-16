import { Link } from "@tanstack/react-router";
/**
 * Loom: reusable pieces drawn from the conference's Meghalaya textile motif.
 * Pure SVG + CSS (colors from --loom-* tokens), so they theme and respect reduced motion.
 */
import logo from "@/assets/brand/paniim-logo.png.asset.json";
import { useEffect, useRef } from "react";
import type React from "react";

const TILE = 48;

/** One frieze tile: two pine chevrons and a gold lozenge. */
function FriezeTile({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {[4, 14].map((dx) => (
        <path key={dx} d={`M${dx} 3 L${dx + 7} 8 L${dx} 13 M${dx + 4} 3 L${dx + 11} 8 L${dx + 4} 13`} fill="none" stroke="var(--loom-pine)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <rect x={34} y={5} width={6} height={6} transform="rotate(45 37 8)" fill="var(--loom-gold)" />
    </g>
  );
}

/** Pine-chevron border strip. `animated` makes it drift like thread on a loom. */
export function ChevronFrieze({ animated = false, className = "" }: { animated?: boolean; className?: string }) {
  const tiles = Array.from({ length: 30 }, (_, i) => i * TILE);
  return (
    <svg aria-hidden="true" className={`block h-4 w-full overflow-hidden ${className}`} preserveAspectRatio="xMinYMid slice" viewBox={`0 0 ${TILE * 12} 16`}>
      <g className={animated ? "loom-drift" : undefined}>
        {tiles.map((x) => <FriezeTile key={x} x={x} />)}
      </g>
    </svg>
  );
}

/** A woven band of panels (stripes, diamonds, ladders) for page tops and card headers. */
export function LoomBand({ className = "", height = 44 }: { className?: string; height?: number }) {
  const w = 60;
  const panels = [
    // terracotta + ink pillars
    <g key="a">
      <rect width={w} height={40} fill="var(--loom-cream)" />
      <rect y={3} width={w} height={5} fill="var(--loom-red)" />
      {[8, 20, 32, 44].map((x, i) => <rect key={x} x={x} y={12} width={6} height={16} fill={i % 2 ? "var(--loom-ink)" : "var(--loom-red)"} />)}
      <rect y={32} width={w} height={5} fill="var(--loom-red)" />
    </g>,
    // concentric diamonds
    <g key="b">
      <rect width={w} height={40} fill="var(--loom-cream)" />
      {[15, 45].map((cx) => (
        <g key={cx}>
          <rect x={cx - 9} y={11} width={18} height={18} transform={`rotate(45 ${cx} 20)`} fill="none" stroke="var(--loom-red)" strokeWidth="2.5" />
          <rect x={cx - 3.5} y={16.5} width={7} height={7} transform={`rotate(45 ${cx} 20)`} fill="var(--loom-red)" />
        </g>
      ))}
    </g>,
    // ink + red vertical weave
    <g key="c">
      <rect width={w} height={40} fill="var(--loom-ink)" />
      {[6, 26, 46].map((x) => <rect key={x} x={x} width={10} height={40} fill="var(--loom-red)" />)}
      {[10, 30, 50].map((x) => <rect key={x} x={x} width={1.5} height={40} fill="var(--loom-cream)" />)}
    </g>,
    // pine stripes + gold-eyed diamond
    <g key="d">
      <rect width={w} height={40} fill="var(--loom-cream)" />
      {[3, 9, 31, 37].map((y) => <rect key={y} y={y - 1} width={w} height={2.5} fill={y < 20 ? "var(--loom-pine)" : "var(--loom-red)"} />)}
      <rect x={21} y={11} width={18} height={18} transform="rotate(45 30 20)" fill="var(--loom-red)" />
      <rect x={25} y={15} width={10} height={10} transform="rotate(45 30 20)" fill="var(--loom-cream)" />
      <rect x={27.5} y={17.5} width={5} height={5} transform="rotate(45 30 20)" fill="var(--loom-gold)" />
    </g>,
    // red field, floating lozenges
    <g key="e">
      <rect width={w} height={40} fill="var(--loom-red)" />
      <rect width={w} height={6} fill="var(--loom-pine)" />
      <rect y={34} width={w} height={6} fill="var(--loom-pine)" />
      {([[15, 15], [30, 22], [45, 15], [15, 28], [45, 28]] as const).map(([x, y], i) => (
        <rect key={i} x={x - 3} y={y - 3} width={6} height={6} transform={`rotate(45 ${x} ${y})`} fill={["var(--loom-cream)", "var(--loom-gold)", "var(--loom-pine)"][i % 3]} />
      ))}
    </g>,
  ];
  return (
    <svg aria-hidden="true" className={`block w-full ${className}`} style={{ height }} viewBox={`0 0 ${w * 10 + 22} 44`} preserveAspectRatio="xMidYMid slice">
      <rect width="100%" height="44" fill="var(--loom-gold)" />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} transform={`translate(${2 + i * (w + 2)} 2)`}>{panels[i % panels.length]}</g>
      ))}
    </svg>
  );
}

/**
 * The motif's eight panels stand for the eight Northeast states.
 * Each glyph is a 14px distillation of one panel; order matches the strip.
 */
const R = "var(--loom-red)", G = "var(--loom-gold)", P = "var(--loom-pine)", I = "var(--loom-ink)", C = "var(--loom-cream)";
const STATE_GLYPHS: React.ReactNode[] = [
  <><rect width={14} height={14} fill={C} /><rect y={2} width={14} height={2} fill={R} /><rect x={3} y={5} width={2} height={4} fill={I} /><rect x={9} y={5} width={2} height={4} fill={R} /><rect y={10} width={14} height={2} fill={R} /></>,
  <><rect width={14} height={14} fill={C} /><rect x={3.5} y={3.5} width={7} height={7} transform="rotate(45 7 7)" fill="none" stroke={R} strokeWidth={1.4} /><rect x={5.5} y={5.5} width={3} height={3} transform="rotate(45 7 7)" fill={R} /></>,
  <><rect width={14} height={14} fill={I} />{[1, 6, 11].map((x) => <rect key={x} x={x} width={2.5} height={14} fill={R} />)}</>,
  <><rect width={14} height={14} fill={P} /><path d="M2 4 L7 8 L12 4 M2 8 L7 12 L12 8" fill="none" stroke={G} strokeWidth={1.4} /></>,
  <><rect width={14} height={14} fill={C} />{[2, 5, 9, 12].map((y) => <rect key={y} y={y - 0.6} width={14} height={1.2} fill={y < 7 ? P : R} />)}<rect x={4.5} y={4.5} width={5} height={5} transform="rotate(45 7 7)" fill={R} /></>,
  <><rect width={14} height={14} fill={R} /><rect width={14} height={2} fill={P} /><rect y={12} width={14} height={2} fill={P} />{([[4, 5, C], [10, 5, G], [7, 9, P]] as const).map(([x, y, f]) => <rect key={x + y} x={x - 1.5} y={y - 1.5} width={3} height={3} transform={`rotate(45 ${x} ${y})`} fill={f} />)}</>,
  <><rect width={14} height={14} fill={G} /><rect x={2} y={2} width={10} height={10} fill={I} /><rect x={4.5} y={4.5} width={5} height={5} transform="rotate(45 7 7)" fill={G} /></>,
  <><rect width={14} height={14} fill={C} />{[2, 6, 10].map((y) => <path key={y} d={`M1 ${y + 2} L4 ${y} L7 ${y + 2} L10 ${y} L13 ${y + 2}`} fill="none" stroke={y === 6 ? R : P} strokeWidth={1.3} />)}</>,
];

/** The eight state glyphs in a row. `mode`: weave = loop one by one, reveal = arrive once, still = static. */
export function StateWeave({ mode = "still", size = 14, className = "" }: { mode?: "weave" | "reveal" | "still"; size?: number; className?: string }) {
  const cls = mode === "weave" ? "loom-state" : mode === "reveal" ? "loom-state-once" : "";
  const step = mode === "weave" ? 150 : 60;
  return (
    <div aria-hidden="true" className={`flex items-center gap-[3px] ${className}`}>
      {STATE_GLYPHS.map((g, i) => (
        <svg key={i} viewBox="0 0 14 14" width={size} height={size} className={`block overflow-hidden rounded-[2px] ${cls}`} style={cls ? { animationDelay: `${i * step}ms` } : undefined}>{g}</svg>
      ))}
    </div>
  );
}

/** Loading indicator: the eight states weave in one after another. */
export function LoomLoader({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={`flex flex-col items-center gap-3 ${className}`}>
      <StateWeave mode="weave" size={12} />
      <div className="w-28 opacity-60"><ChevronFrieze animated /></div>
    </div>
  );
}

/** Thin day/section divider: a hairline with a gold lozenge at its center. */
export function LoomRule({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-[0.62rem] font-semibold text-muted-foreground ${className}`}>
      <span className="h-px flex-1 bg-border" />
      <Lozenge />
      {label ? <span>{label}</span> : null}
      {label ? <Lozenge /> : null}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Official conference lockup. */
export function ConferenceLogo({ className = "", fetchPriority }: { className?: string; fetchPriority?: "high" | "low" | "auto" }) {
  return <img src={logo.url} alt="11th Pan IIM World Management Conference 2026, IIM Shillong" className={className} width={1920} height={740} decoding="async" fetchPriority={fetchPriority} />;
}

/**
 * Native-style sticky brand bar: translucent cream glass that keeps every logo
 * color legible, compressing smoothly as the page scrolls.
 */
/** Sticky translucent logo bar. `compact` starts already narrowed (inner pages). */
export function BrandBar({ right, left, compact = false }: { right?: React.ReactNode; left?: React.ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const p = compact ? 1 : Math.min(1, Math.max(0, window.scrollY / 72));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [compact]);
  return (
    <div ref={ref} className="brand-bar sticky top-0 z-30" style={{ ["--p" as string]: compact ? 1 : 0 }}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top,0px)] md:relative md:max-w-6xl">
        <div className="flex min-w-0 items-center gap-1">
          {left}
          <Link to="/" aria-label="Home" className="press block rounded-md">
            <ConferenceLogo className="brand-bar-logo w-auto" fetchPriority="high" />
          </Link>
        </div>
        {right}
      </div>
      <div className="brand-bar-seam"><ChevronFrieze /></div>
    </div>
  );
}

/** Tiny gold lozenge used as a typographic bullet beside section labels. */
export function Lozenge({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-[5px] rotate-45 bg-loom-gold ${className}`} />;
}
