import { useState } from "react";
import { airWord, compass, skyLabel } from "@/lib/atmosphere";
import { hhmm, type ShillongNow } from "./useShillongNow";

/** Brass hill-station barometer: a live dial plus three facets you tap through. */
export function Barometer({ d }: { d: ShillongNow }) {
  const [facet, setFacet] = useState(0);
  const [kick, setKick] = useState(0);
  const facets = [
    { k: "Now", big: `${d.temp}°`, line: skyLabel(d.code), sub: `Feels ${d.feels}°, ${d.lo}–${d.hi}° today`, v: d.temp / 30 },
    { k: "Air", big: d.aqi != null ? String(d.aqi) : "–", line: d.aqi != null ? airWord(d.aqi) : "Air", sub: d.pm25 != null ? `Fine dust ${d.pm25} µg/m³` : "Reading unavailable", v: Math.min(1, (d.aqi ?? 0) / 150) },
    { k: "Light", big: hhmm(d.set), line: "Sunset", sub: `Wind ${d.wind} km/h ${compass(d.windDir)}, dark by 5`, v: d.set / 1440 },
  ];
  const f = facets[facet]!;
  const angle = -120 + f.v * 240;
  return (
    <button
      type="button"
      onClick={() => { setFacet((x) => (x + 1) % 3); setKick((k) => k + 1); }}
      aria-label={`Shillong ${f.k}: ${f.big}, ${f.line}. Tap for the next reading`}
      className="atmo-card tap group flex items-center gap-3 px-3 text-left"
    >
      <svg viewBox="0 0 64 64" className="h-[4.1rem] w-[4.1rem] shrink-0" aria-hidden>
        <defs>
          <radialGradient id="baro-face" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="var(--card)" />
            <stop offset="100%" stopColor="color-mix(in oklab, var(--loom-gold) 25%, var(--card))" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="31" fill="color-mix(in oklab, var(--loom-gold) 80%, var(--foreground))" />
        <circle cx="32" cy="32" r="28" fill="url(#baro-face)" />
        {Array.from({ length: 13 }, (_, i) => -120 + i * 20).map((a, i) => (
          <line key={a} x1="32" y1="7" x2="32" y2={i % 3 === 0 ? 12 : 10} stroke="var(--loom-ink)" strokeWidth={i % 3 === 0 ? 1.4 : 0.8} transform={`rotate(${a} 32 32)`} />
        ))}
        <path d="M14 46a22 22 0 0 1 36 0" fill="none" stroke="var(--loom-pine)" strokeWidth="2" strokeDasharray="2 2" opacity="0.5" />
        <g key={kick} className="baro-needle" style={{ transform: `rotate(${angle}deg)`, ["--to" as string]: `${angle}deg` }}>
          <path d="M32 11 34 32 30 32Z" fill="var(--destructive)" />
          <path d="M30 32 34 32 32 40Z" fill="var(--loom-ink)" />
        </g>
        <circle cx="32" cy="32" r="3" fill="color-mix(in oklab, var(--loom-gold) 80%, var(--foreground))" />
        <text x="32" y="53" textAnchor="middle" fontSize="6" fontWeight="700" fill="var(--loom-ink)" letterSpacing="0.6">{f.k.toUpperCase()}</text>
      </svg>
      <span className="min-w-0 flex-1">
        <span key={`b${facet}`} className="flap-anim block text-[1.55rem] font-semibold leading-none tabular-nums">{f.big}</span>
        <span key={`l${facet}`} className="rise mt-1 block truncate text-[0.75rem] font-semibold">{f.line}</span>
        <span key={`s${facet}`} className="rise block truncate text-[0.62rem] opacity-75">{f.sub}</span>
      </span>
      <span className="flex flex-col gap-1" aria-hidden>
        {facets.map((x, i) => <span key={x.k} className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === facet ? "scale-125 bg-[var(--loom-gold)]" : "bg-primary-foreground/30"}`} />)}
      </span>
    </button>
  );
}
