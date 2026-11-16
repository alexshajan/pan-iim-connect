import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, CloudSun } from "lucide-react";
import type { Phase } from "@/lib/phase";
import { CONF_START } from "@/lib/phase";
import { countdownParts, dialPct, dialTicks, nextItem } from "@/lib/day-dial";
import { relativeToNow } from "@/lib/format";
import type { Session } from "@/lib/conference";

function Flap({ value, label }: { value: number; label: string }) {
  const v = String(value).padStart(2, "0");
  return (
    <span className="flex flex-col items-center gap-1">
      <span key={v} className="flap flap-anim text-[1.7rem] font-semibold leading-none">{v}</span>
      <span className="text-[0.58rem] font-semibold opacity-70">{label}</span>
    </span>
  );
}

function WeatherChip() {
  const w = useQuery({
    queryKey: ["weather", "shillong"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=25.57&longitude=91.88&current=temperature_2m&daily=temperature_2m_min,temperature_2m_max&timezone=Asia%2FKolkata&forecast_days=1");
      const j = await r.json();
      return { now: Math.round(j.current.temperature_2m), lo: Math.round(j.daily.temperature_2m_min[0]), hi: Math.round(j.daily.temperature_2m_max[0]) };
    },
  });
  if (!w.data) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-2.5 py-1 text-[0.7rem] font-semibold">
      <CloudSun className="h-3.5 w-3.5" /> Shillong {w.data.now}°C, {w.data.lo}–{w.data.hi}°
    </span>
  );
}

export function DayDial({
  phase, now, sessions, mine, code, met,
}: { phase: Phase; now: Date; sessions: Session[]; mine: string[]; code?: string | undefined; met: number }) {
  return (
    <div className="relative px-4 pt-4">
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[var(--radius-pass)] bg-primary text-primary-foreground shadow-[var(--shadow-emboss)]">
        <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "var(--paper-grain)", backgroundSize: "13px 13px" }} />
        <div className="relative flex items-center justify-between px-5 pt-4">
          <span className="text-display text-sm">Pan-IIM WMC 2026</span>
          <Link to="/updates" className="tap relative rounded-full bg-primary-foreground px-3 py-1 text-[0.7rem] font-semibold text-primary">
            Updates
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warn" />
          </Link>
        </div>

        <div className="relative px-5 pt-5 pb-5">
          {phase === "before" ? <Before now={now} code={code} /> : null}
          {phase === "live" ? <Live now={now} sessions={sessions} mine={mine} /> : null}
          {phase === "after" ? <After met={met} sessions={sessions.length} /> : null}
        </div>
      </div>
    </div>
  );
}

function Before({ now, code }: { now: Date; code?: string | undefined }) {
  const c = countdownParts(CONF_START, now);
  return (
    <>
      <p className="text-[0.66rem] font-semibold opacity-75">IIM Shillong, 27–29 Nov</p>
      <div className="mt-3 flex items-end gap-2.5">
        <Flap value={c.days} label="days" />
        <span className="pb-6 text-xl opacity-50">:</span>
        <Flap value={c.hours} label="hrs" />
        <span className="pb-6 text-xl opacity-50">:</span>
        <Flap value={c.minutes} label="min" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <WeatherChip />
      </div>
      {code ? (
        <Link to="/me" className="tap absolute right-4 bottom-4 rotate-[-4deg] rounded-md bg-card px-3 py-2 text-foreground shadow-[var(--shadow-card)]">
          <span className="block text-[0.55rem] font-semibold text-muted-foreground">Your pass</span>
          <span className="block text-xs font-semibold">{code}</span>
        </Link>
      ) : null}
    </>
  );
}

function Live({ now, sessions, mine }: { now: Date; sessions: Session[]; mine: string[] }) {
  const ticks = dialTicks(sessions, now, mine);
  const needle = dialPct(now.getTime(), now);
  const next = nextItem(sessions, now, mine);
  return (
    <>
      <p className="text-[0.66rem] font-semibold opacity-75">Today on the dial</p>
      <div className="relative mt-4 h-12">
        <div className="absolute inset-x-0 top-5 h-[2px] bg-primary-foreground/25" />
        {ticks.map((t) => (
          <span key={t.id} className={`absolute top-3 h-[0.9rem] rounded-sm ${t.mine ? "bg-warn" : "bg-primary-foreground/40"}`} style={{ left: `${t.left}%`, width: `${t.width}%` }} />
        ))}
        <span className="needle absolute top-0 h-9 w-[3px] -translate-x-1/2 rounded-full bg-warn" style={{ left: `${needle}%` }} />
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[0.58rem] opacity-60">
          {["08", "11", "14", "17", "20"].map((h) => <span key={h}>{h}:00</span>)}
        </div>
      </div>
      {next ? (
        <Link to="/session/$sessionId" params={{ sessionId: next.id }} className="tap mt-3 block text-sm">
          <span className="opacity-70">Next, </span>
          <b>{next.title}</b>
          <span className="opacity-80">, {next.venues?.short_name ?? next.venues?.name ?? "Venue awaited"}, {relativeToNow(next.starts_at, now)}</span>
        </Link>
      ) : (
        <p className="mt-3 text-sm opacity-80">That's a wrap for today.</p>
      )}
    </>
  );
}

function After({ met, sessions }: { met: number; sessions: number }) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-16 w-16 shrink-0 rotate-[-8deg] place-items-center rounded-full border-2 border-dashed border-primary-foreground/60">
        <Award className="h-7 w-7" />
      </span>
      <div>
        <p className="text-display text-[1.5rem] leading-tight">Thank you, Shillong.</p>
        <p className="mt-1 text-sm opacity-80">3 days, {sessions} sessions, you met {met} {met === 1 ? "person" : "people"}</p>
      </div>
    </div>
  );
}

/** The countdown folded into one line that sits under the pass. */
export function CountdownLine({ now }: { now: Date }) {
  const c = countdownParts(CONF_START, now);
  const w = useQuery({
    queryKey: ["weather", "shillong"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=25.57&longitude=91.88&current=temperature_2m&daily=temperature_2m_min,temperature_2m_max&timezone=Asia%2FKolkata&forecast_days=1");
      const j = await r.json();
      return { now: Math.round(j.current.temperature_2m), lo: Math.round(j.daily.temperature_2m_min[0]), hi: Math.round(j.daily.temperature_2m_max[0]) };
    },
  });
  const unit = (v: number, l: string) => (
    <span className="inline-flex items-baseline gap-0.5">
      <span key={v} className="flap-anim inline-block font-semibold tabular-nums text-foreground">{String(v).padStart(2, "0")}</span>
      <span className="text-[0.62rem] font-semibold">{l}</span>
    </span>
  );
  return (
    <div className="mt-2.5 flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <svg viewBox="0 0 10 10" className="h-2 w-2 shrink-0 text-[var(--loom-gold)]" aria-hidden><path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" /></svg>
      <span className="inline-flex items-baseline gap-1.5" aria-label={`${c.days} days ${c.hours} hours ${c.minutes} minutes to opening`}>
        {unit(c.days, "d")}{unit(c.hours, "h")}{unit(c.minutes, "m")}
        <span>to opening</span>
      </span>
      {w.data ? (
        <span className="ml-auto inline-flex items-center gap-1 tabular-nums"><CloudSun className="h-3.5 w-3.5" />{w.data.now}°C</span>
      ) : null}
    </div>
  );
}

/** Home countdown: one slim split-flap strip under the pass. Ticks every second on its own. */
export function CountdownBoard() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now || CONF_START.getTime() <= now.getTime()) return null;
  const c = countdownParts(CONF_START, now);
  const secs = Math.floor((CONF_START.getTime() - now.getTime()) / 1000) % 60;
  const units: [number, string][] = [[c.days, "days"], [c.hours, "hrs"], [c.minutes, "min"], [secs, "sec"]];
  return (
    <section
      aria-label={`${c.days} days, ${c.hours} hours, ${c.minutes} minutes to the opening`}
      className="countdown-strip atmo-card relative flex items-center justify-center overflow-hidden p-2"
    >
      <div className="flex items-end gap-1.5" aria-hidden>
        {units.map(([v, l], i) => (
          <div key={l} className="flex flex-col items-center gap-0.5">
            <span className={`flapboard-tile !h-10 !min-w-[2.6rem] !py-0 !rounded-md ${i === 3 ? "opacity-70" : ""}`}>
              <span key={v} className="flap-anim text-[1.35rem] leading-none font-semibold tabular-nums">{String(v).padStart(2, "0")}</span>
            </span>
            <span className="text-[0.6rem] font-medium opacity-75">{l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const WMO: [number, string, string][] = [
  [0, "Clear", "sun"], [2, "Partly cloudy", "part"], [3, "Overcast", "cloud"], [48, "Mist", "mist"],
  [67, "Drizzle", "rain"], [77, "Snow", "snow"], [82, "Showers", "rain"], [99, "Thunder", "storm"],
];
const sky = (code: number) => WMO.find(([max]) => code <= max) ?? WMO[WMO.length - 1]!;

/** Live Shillong weather. Tap to flip between now and today's range. */
export function ShillongWeather() {
  const [flip, setFlip] = useState(false);
  const w = useQuery({
    queryKey: ["weather", "shillong", "full"],
    staleTime: 15 * 60_000,
    queryFn: async () => {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=25.57&longitude=91.88&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_min,temperature_2m_max&timezone=Asia%2FKolkata&forecast_days=1");
      if (!r.ok) throw new Error("weather");
      const j = await r.json();
      return {
        now: Math.round(j.current.temperature_2m),
        code: j.current.weather_code as number,
        wind: Math.round(j.current.wind_speed_10m),
        lo: Math.round(j.daily.temperature_2m_min[0]),
        hi: Math.round(j.daily.temperature_2m_max[0]),
      };
    },
  });
  if (w.isError) return null;
  const d = w.data;
  const [, label, icon] = d ? sky(d.code) : [0, "", ""];
  return (
    <button
      type="button"
      onClick={() => setFlip((f) => !f)}
      aria-label={d ? `Shillong ${d.now} degrees, ${label}. Tap for today's range` : "Shillong weather loading"}
      className="group absolute -right-4 -top-4 z-10 flex rotate-[4deg] items-center gap-1 rounded-full border border-border/70 bg-card/90 py-0.5 pl-1 pr-2.5 text-left text-foreground shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--foreground)_40%,transparent)] backdrop-blur-md transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:rotate-0 hover:scale-105 active:scale-95"
    >
      {d ? (
        <>
          <span aria-hidden className="weather-bob text-base leading-none transition-transform duration-500 group-active:rotate-12"><SkyGlyph kind={String(icon)} /></span>
          <span key={flip ? "r" : "n"} className="rise whitespace-nowrap text-[0.7rem] font-semibold tabular-nums">
            {flip ? `${d.lo}°/${d.hi}°` : `${d.now}° ${label}`}
          </span>
        </>
      ) : (
        <span className="skeleton h-4 w-12 rounded-full" />
      )}
    </button>
  );
}

/** Drawn sky glyphs in loom colours (no emoji). */
function SkyGlyph({ kind }: { kind: string }) {
  const sun = <circle cx="9" cy="9" r="4" fill="var(--loom-gold)" />;
  const cloud = <path d="M6 17h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 6 17Z" fill="var(--card)" stroke="var(--loom-ink)" strokeWidth="1.4" />;
  return (
    <svg viewBox="0 0 22 22" width="16" height="16" aria-hidden className="block">
      {kind === "sun" ? <><circle cx="11" cy="11" r="4.5" fill="var(--loom-gold)" /><g stroke="var(--loom-gold)" strokeWidth="1.6" strokeLinecap="round">{[0,45,90,135,180,225,270,315].map((a) => <line key={a} x1="11" y1="2" x2="11" y2="4" transform={`rotate(${a} 11 11)`} />)}</g></> : null}
      {kind === "part" ? <>{sun}{cloud}</> : null}
      {kind === "cloud" ? cloud : null}
      {kind === "mist" ? <g stroke="var(--loom-ink)" strokeWidth="1.6" strokeLinecap="round"><line x1="4" y1="8" x2="18" y2="8" /><line x1="2" y1="12" x2="15" y2="12" /><line x1="6" y1="16" x2="20" y2="16" /></g> : null}
      {kind === "rain" || kind === "storm" ? <>{cloud}<g stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round"><line x1="8" y1="19" x2="7" y2="21" /><line x1="12" y1="19" x2="11" y2="21" /></g>{kind === "storm" ? <path d="M14 15l-2 3h2l-1 3" stroke="var(--loom-gold)" strokeWidth="1.5" fill="none" /> : null}</> : null}
      {kind === "snow" ? <g stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round"><line x1="11" y1="3" x2="11" y2="19" /><line x1="4" y1="7" x2="18" y2="15" /><line x1="4" y1="15" x2="18" y2="7" /></g> : null}
    </svg>
  );
}
