import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CONF_START } from "@/lib/phase";
import { countdownParts } from "@/lib/day-dial";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, ExternalLink, Moon, Sun, Sunrise, Sunset, Thermometer, Timer, Wind } from "lucide-react";

const LAT = 25.57, LON = 91.88;
const TZ = "Asia%2FKolkata";

/** Countdown: big day number, "days to go". */
export function WoodClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  if (!now || CONF_START.getTime() <= now.getTime()) return null;
  const c = countdownParts(CONF_START, now);
  return (
    <section aria-label={`${c.days} days to go`} className="wx-card flex min-w-0 flex-col">
      <div className="wx-label"><Timer className="h-3.5 w-3.5" aria-hidden />Countdown</div>
      <div className="flex flex-1 flex-col justify-center">
        <b className="text-[4.5rem] font-light leading-[0.9] tracking-tight tabular-nums sm:text-[5.5rem]">{c.days}</b>
        <span className="mt-1 text-sm wx-dim">{c.days === 1 ? "day" : "days"} to go</span>
      </div>
    </section>
  );
}

type Day = { date: string; lo: number; hi: number; code: number; rain: number; rise: string; set: string; uv: number };
type Hour = { time: string; t: number; code: number; rain: number };
type Wx = {
  now: number; feels: number; code: number; humidity: number; wind: number; isDay: boolean;
  days: Day[]; hours: Hour[];
  pm: number | null; pm10: number | null; o3: number | null; no2: number | null; co: number | null; so2: number | null;
};
const SKY: [number, string][] = [[0, "Clear"], [2, "Partly cloudy"], [3, "Overcast"], [48, "Mist"], [67, "Drizzle"], [77, "Snow"], [82, "Showers"], [99, "Thunder"]];
const skyLabel = (c: number) => (SKY.find(([m]) => c <= m) ?? SKY[SKY.length - 1]!)[1];
function SkyIcon({ code, day = true, className = "h-4 w-4" }: { code: number; day?: boolean; className?: string }) {
  const I = code === 0 ? (day ? Sun : Moon) : code <= 2 ? CloudSun : code <= 3 ? Cloud : code <= 48 ? CloudFog : code <= 57 ? CloudDrizzle : code <= 67 ? CloudRain : code <= 77 ? CloudSnow : code <= 82 ? CloudRain : CloudLightning;
  const sunny = code <= 2;
  return <I className={className} style={sunny ? { color: "var(--wx-sun)" } : undefined} aria-hidden />;
}
const hm = (iso: string) => iso.slice(11, 16);
const r = (n: number | null | undefined) => (n == null ? null : Math.round(n));

export const stationQuery = {
  queryKey: ["weather", "shillong", "station", 2],
  staleTime: 15 * 60_000,
  queryFn: async (): Promise<Wx> => {
    const [f, a] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,is_day&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max&timezone=${TZ}&forecast_days=16`).then((x) => x.json()),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide&timezone=${TZ}`).then((x) => x.json()).catch(() => null),
    ]);
    const d = f.daily;
    const days: Day[] = d.time.map((date: string, i: number) => ({ date, lo: Math.round(d.temperature_2m_min[i]), hi: Math.round(d.temperature_2m_max[i]), code: d.weather_code[i], rain: d.precipitation_probability_max[i] ?? 0, rise: d.sunrise[i], set: d.sunset[i], uv: d.uv_index_max[i] ?? 0 }));
    const nowIso = f.current.time.slice(0, 13);
    const start = Math.max(0, f.hourly.time.findIndex((t: string) => t.slice(0, 13) === nowIso));
    const hours: Hour[] = f.hourly.time.slice(start, start + 24).map((time: string, k: number) => ({ time, t: Math.round(f.hourly.temperature_2m[start + k]), code: f.hourly.weather_code[start + k], rain: f.hourly.precipitation_probability[start + k] ?? 0 }));
    const c = a?.current ?? {};
    return {
      now: Math.round(f.current.temperature_2m), feels: Math.round(f.current.apparent_temperature), code: f.current.weather_code,
      humidity: Math.round(f.current.relative_humidity_2m), wind: Math.round(f.current.wind_speed_10m), isDay: f.current.is_day === 1,
      days, hours, pm: r(c.pm2_5), pm10: r(c.pm10), o3: r(c.ozone), no2: r(c.nitrogen_dioxide), co: r(c.carbon_monoxide), so2: r(c.sulphur_dioxide),
    };
  },
};

/** India AQI (CPCB) from PM2.5 µg/m³. */
export function indiaAqi(pm: number) {
  const bp: [number, number, number, number][] = [[0, 30, 0, 50], [30, 60, 50, 100], [60, 90, 100, 200], [90, 120, 200, 300], [120, 250, 300, 400], [250, 500, 400, 500]];
  const b = bp.find(([, hi]) => pm <= hi) ?? bp[bp.length - 1]!;
  return Math.round(b[2] + ((Math.min(pm, b[1]) - b[0]) / (b[1] - b[0])) * (b[3] - b[2]));
}
const BANDS = ["Good", "Satisfactory", "Moderate", "Poor", "Very poor", "Severe"];
const bandOf = (a: number) => (a <= 50 ? 0 : a <= 100 ? 1 : a <= 200 ? 2 : a <= 300 ? 3 : a <= 400 ? 4 : 5);
const CPCB = ["oklch(0.72 0.17 145)", "oklch(0.82 0.15 125)", "oklch(0.88 0.16 95)", "oklch(0.75 0.17 55)", "oklch(0.62 0.2 27)", "oklch(0.48 0.17 15)"];

/** Moon phase 0..1 (0 new, .5 full) from a known new moon. */
export function moonPhase(t: number) {
  const syn = 29.530588853 * 864e5;
  return (((t - Date.UTC(2000, 0, 6, 18, 14)) % syn) + syn) % syn / syn;
}
const moonName = (p: number) => ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"][Math.round(p * 8) % 8]!;

const minsOf = (iso: string) => { const [h, m] = iso.slice(11, 16).split(":").map(Number); return h! * 60 + m!; };
const istMin = (t: number) => (new Date(t).getUTCHours() * 60 + new Date(t).getUTCMinutes() + 330) % 1440;
const clock = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(Math.round(((m % 60) + 60) % 60)).padStart(2, "0")}`;
const dur = (m: number) => `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;

type Panel = "temp" | "aqi" | "sun" | null;

export function WeatherStation() {
  const w = useQuery(stationQuery);
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState<Panel>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  if (w.isError) return null;
  const d = w.data;
  const today = d?.days[0];
  const aqi = d?.pm != null ? indiaAqi(d.pm) : null;
  const nm = now ? istMin(now) : 720;
  return (
    <>
      <section aria-label="Shillong weather" className="wx-stack flex min-w-0 flex-col gap-[3px]">
        <Tile onOpen={() => d && setOpen("temp")} label="Weather details">
          <div className="wx-label"><Thermometer className="h-3.5 w-3.5" aria-hidden />Shillong</div>
          {d && today ? <div className="mt-1.5 flex items-end justify-between gap-1">
            <span className="flex items-center gap-1.5"><b className="text-[2rem] font-light leading-none tabular-nums">{d.now}°</b><SkyIcon code={d.code} day={d.isDay} className="h-5 w-5" /></span>
            <span className="text-right text-xs leading-tight wx-dim">{skyLabel(d.code)}<br /><span className="tabular-nums">{today.hi}° · {today.lo}°</span></span>
          </div> : <Skel />}
        </Tile>
        <Tile onOpen={() => d && setOpen("aqi")} label="Air quality details">
          <div className="flex items-center justify-between"><span className="wx-label"><Wind className="h-3.5 w-3.5" aria-hidden />Air quality</span><b className="text-xl font-light leading-none tabular-nums">{aqi ?? "—"}</b></div>
          <AqiBar aqi={aqi} />
          <div className="mt-1 text-right text-xs wx-dim">{aqi != null ? BANDS[bandOf(aqi)] : "No reading"}</div>
        </Tile>
        <Tile onOpen={() => d && setOpen("sun")} label="Sunrise and sunset details">
          <div className="wx-label"><Sunrise className="h-3.5 w-3.5" aria-hidden />Sun</div>
          {today ? <div className="mt-1 flex items-center gap-2">
            <SunArc rise={minsOf(today.rise)} set={minsOf(today.set)} now={nm} className="h-9 w-16 shrink-0" />
            <span className="text-xs leading-tight tabular-nums wx-dim"><Sun className="mr-1 inline h-3 w-3" aria-hidden />{hm(today.rise)}<br /><Sunset className="mr-1 inline h-3 w-3" aria-hidden />{hm(today.set)}</span>
          </div> : <Skel />}
        </Tile>
      </section>
      {d ? <Sheet open={open} onClose={() => setOpen(null)} d={d} aqi={aqi} now={now ?? Date.now()} /> : null}
    </>
  );
}

function Tile({ children, onOpen, label }: { children: ReactNode; onOpen: () => void; label: string }) {
  return <button type="button" onClick={onOpen} aria-label={label} className="wx-card wx-tap text-left">{children}</button>;
}

function AqiBar({ aqi, big }: { aqi: number | null; big?: boolean }) {
  return (
    <div className={`relative mt-2 rounded-full ${big ? "h-2" : "h-1.5"}`} style={{ background: `linear-gradient(90deg, ${CPCB.join(",")})` }} aria-hidden>
      {aqi != null ? <span className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ${big ? "h-4 w-4" : "h-3 w-3"}`} style={{ left: `${Math.min(100, (aqi / 500) * 100)}%`, background: CPCB[bandOf(aqi)], ["--tw-ring-color" as string]: "var(--wx-card)" }} /> : null}
    </div>
  );
}

/** Daylight arc over 24h; sun marker moves live. */
function SunArc({ rise, set, now, className, detail }: { rise: number; set: number; now: number; className?: string; detail?: boolean }) {
  const W = 240, H = 90, base = 70;
  const x = (m: number) => (m / 1440) * W;
  // sine over the whole day, crossing horizon at rise/set
  const noon = (rise + set) / 2, half = 720;
  const y = (m: number) => base - 40 * (Math.cos(((m - noon) / half) * Math.PI) - Math.cos(((set - noon) / half) * Math.PI));
  const pts = Array.from({ length: 49 }, (_, i) => i * 30).map((m) => `${x(m).toFixed(1)},${y(m).toFixed(1)}`).join(" ");
  const up = now > rise && now < set;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden>
      <defs><clipPath id={detail ? "sky-d" : "sky-s"}><rect x="0" y="0" width={W} height={base} /></clipPath></defs>
      <polyline points={pts} fill="none" style={{ stroke: "var(--wx-dim)", strokeWidth: detail ? 1.2 : 2.5, opacity: 0.5 }} />
      <polygon points={`0,${base} ${pts} ${W},${base}`} clipPath={`url(#${detail ? "sky-d" : "sky-s"})`} style={{ fill: "var(--wx-hill)" }} />
      <line x1="0" x2={W} y1={base} y2={base} style={{ stroke: "var(--wx-dim)", strokeWidth: detail ? 0.8 : 2 }} />
      {detail ? [rise, noon, set].map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={base - 3} y2={base + 3} style={{ stroke: "var(--wx-dim)" }} />) : null}
      <circle cx={x(now)} cy={y(now)} r={detail ? 6 : 9} style={{ fill: up ? "var(--wx-sun)" : "var(--wx-dim)", opacity: up ? 1 : 0.6 }} />
    </svg>
  );
}

const fmtDay = (iso: string, i: number) => i === 0 ? "Today" : new Date(iso + "T12:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const isConf = (iso: string) => iso >= "2026-11-27" && iso <= "2026-11-29";

function Sheet({ open, onClose, d, aqi, now }: { open: Panel; onClose: () => void; d: Wx; aqi: number | null; now: number }) {
  const today = d.days[0]!;
  return (
    <Dialog open={open != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="wx-sheet max-h-[88vh] overflow-y-auto border-0 p-5 sm:max-w-md"><span className="wx-grip" aria-hidden />
        {open === "temp" ? <>
          <DialogTitle className="text-base font-medium">Shillong</DialogTitle>
          <DialogDescription className="sr-only">Forecast for Shillong</DialogDescription>
          <div className="flex items-start justify-between">
            <div><b className="text-6xl font-light leading-none tabular-nums">{d.now}°</b>
              <p className="mt-2 text-sm wx-dim">Feels like {d.feels}° · {today.hi}° / {today.lo}°</p></div>
            <div className="text-right"><SkyIcon code={d.code} day={d.isDay} className="ml-auto h-10 w-10" /><p className="mt-2 text-sm">{skyLabel(d.code)}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat k="Humidity" v={`${d.humidity}%`} /><Stat k="Wind" v={`${d.wind} km/h`} /><Stat k="UV max" v={today.uv.toFixed(0)} />
          </div>
          <div className="wx-inner -mx-1 flex gap-3 overflow-x-auto px-3 py-3">
            {d.hours.map((h, i) => <div key={h.time} className="flex min-w-[2.6rem] flex-col items-center gap-1.5 text-xs tabular-nums">
              <span>{h.t}°</span><SkyIcon code={h.code} day={+h.time.slice(11, 13) >= 6 && +h.time.slice(11, 13) < 17} /><span className="wx-dim">{i === 0 ? "Now" : h.time.slice(11, 16)}</span>
              {h.rain >= 20 ? <span className="text-[0.65rem] wx-accent">{h.rain}%</span> : null}
            </div>)}
          </div>
          <ul className="space-y-[3px]">
            {d.days.map((x, i) => {
              const lo = Math.min(...d.days.map((y) => y.lo)), hi = Math.max(...d.days.map((y) => y.hi)), sp = Math.max(1, hi - lo);
              return <li key={x.date} className={`wx-inner flex items-center gap-2 px-3 py-2 text-sm ${isConf(x.date) ? "wx-conf" : ""}`}>
                <span className="w-24 shrink-0">{fmtDay(x.date, i)}</span>
                <SkyIcon code={x.code} />
                <span className="w-8 text-right text-xs tabular-nums wx-accent">{x.rain >= 20 ? `${x.rain}%` : ""}</span>
                <span className="w-7 text-right tabular-nums wx-dim">{x.lo}°</span>
                <span className="relative h-1 flex-1 rounded-full" style={{ background: "var(--wx-hill)" }}><span className="absolute inset-y-0 rounded-full" style={{ left: `${((x.lo - lo) / sp) * 100}%`, right: `${100 - ((x.hi - lo) / sp) * 100}%`, background: "linear-gradient(90deg, var(--wx-accent), var(--wx-sun))" }} /></span>
                <span className="w-7 tabular-nums">{x.hi}°</span>
              </li>;
            })}
          </ul>
          <p className="text-xs wx-dim">Conference days are marked.</p>
          <Out href="https://open-meteo.com/en/docs#latitude=25.57&longitude=91.88&timezone=Asia%2FKolkata">Full forecast</Out>
        </> : null}

        {open === "aqi" ? <>
          <DialogTitle className="text-base font-medium">Air quality</DialogTitle>
          <DialogDescription className="sr-only">Live air quality in Shillong</DialogDescription>
          <div className="flex items-end justify-between"><b className="text-6xl font-light leading-none tabular-nums">{aqi ?? "—"}</b><span className="text-sm" style={{ color: aqi != null ? CPCB[bandOf(aqi)] : undefined }}>{aqi != null ? BANDS[bandOf(aqi)] : "No reading"}</span></div>
          <AqiBar aqi={aqi} big />
          <div className="flex justify-between text-[0.65rem] tabular-nums wx-dim">{[0, 50, 100, 200, 300, 400, 500].map((n) => <span key={n}>{n}</span>)}</div>
          <p className="text-xs wx-dim">India AQI (CPCB scale), worked out from fine dust.</p>
          <div className="grid grid-cols-2 gap-2">
            <Pollutant k="PM2.5" v={d.pm} unit="µg/m³" safe={60} /><Pollutant k="PM10" v={d.pm10} unit="µg/m³" safe={100} />
            <Pollutant k="Ozone (O₃)" v={d.o3} unit="µg/m³" safe={100} /><Pollutant k="NO₂" v={d.no2} unit="µg/m³" safe={80} />
            <Pollutant k="SO₂" v={d.so2} unit="µg/m³" safe={80} /><Pollutant k="CO" v={d.co != null ? Math.round(d.co / 100) / 10 : null} unit="mg/m³" safe={2} />
          </div>
          <p className="text-xs wx-dim">Bar shows the reading against India's 24-hour safe limit.</p>
          <Out href="https://airquality.cpcb.gov.in/AQI_India/">CPCB live air quality</Out>
        </> : null}

        {open === "sun" ? <SunSheet today={today} tomorrow={d.days[1]} now={now} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SunSheet({ today, tomorrow, now }: { today: Day; tomorrow: Day | undefined; now: number }) {
  const rise = minsOf(today.rise), set = minsOf(today.set), nm = istMin(now);
  const up = nm > rise && nm < set;
  const p = moonPhase(now), illum = Math.round((1 - Math.cos(2 * Math.PI * p)) * 50);
  const nextFull = now + (((0.5 - p + 1) % 1) * 29.530588853 * 864e5);
  const dayLen = set - rise, prevLen = tomorrow ? minsOf(tomorrow.set) - minsOf(tomorrow.rise) : dayLen;
  const rows: [string, string][] = [
    ["First light", clock(rise - 24)], ["Sunrise", hm(today.rise)], ["Morning golden hour", `${hm(today.rise)}–${clock(rise + 45)}`],
    ["Solar noon", clock((rise + set) / 2)], ["Evening golden hour", `${clock(set - 45)}–${hm(today.set)}`], ["Sunset", hm(today.set)],
    ["Blue hour", `${hm(today.set)}–${clock(set + 24)}`], ["Last light", clock(set + 24)],
  ];
  return <>
    <DialogTitle className="text-base font-medium">Sun and moon</DialogTitle>
    <DialogDescription className="sr-only">Daylight and moon in Shillong today</DialogDescription>
    <div>
      <b className="text-4xl font-light tabular-nums">{up ? dur(set - nm) : nm < rise ? `Rises ${hm(today.rise)}` : `Set ${hm(today.set)}`}</b>
      <p className="mt-1 text-sm wx-dim">{up ? "of daylight left" : `Daylight today ${dur(dayLen)}`}</p>
    </div>
    <div className="wx-inner px-3 pb-2 pt-3">
      <SunArc rise={rise} set={set} now={nm} className="w-full" detail />
      <div className="relative h-4 text-xs tabular-nums wx-dim">{[[rise, hm(today.rise)], [(rise + set) / 2, clock((rise + set) / 2)], [set, hm(today.set)]].map(([m, t]) => <span key={t as string} className="absolute -translate-x-1/2" style={{ left: `${((m as number) / 1440) * 100}%` }}>{t}</span>)}</div>
    </div>
    <ul className="wx-inner divide-y divide-[var(--wx-hill)] px-3 text-sm">
      {rows.map(([k, v]) => <li key={k} className="flex justify-between py-2"><span className="wx-dim">{k}</span><span className="tabular-nums">{v}</span></li>)}
    </ul>
    <div className="grid grid-cols-2 gap-2">
      <Stat k="Day length" v={dur(dayLen)} /><Stat k="Daylight tomorrow" v={`${prevLen - dayLen >= 0 ? "+" : "−"}${Math.abs(Math.round(prevLen - dayLen))} min vs today`} />
      <Stat k="UV max today" v={today.uv.toFixed(0)} /><Stat k="Timezone" v="IST · UTC+5:30" />
    </div>
    <div className="wx-inner flex items-center gap-4 p-3">
      <MoonDisc p={p} />
      <div className="text-sm"><b className="font-medium">{moonName(p)}</b><p className="wx-dim">{illum}% lit · next full moon {new Date(nextFull).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</p></div>
    </div>
    <p className="text-xs wx-dim">Shillong sits east enough that the sun sets before 5 pm in late November, among the earliest in India.</p>
    <Out href="https://www.timeanddate.com/sun/india/shillong">Sun and moon on timeanddate</Out>
  </>;
}

function MoonDisc({ p }: { p: number }) {
  const k = Math.cos(2 * Math.PI * p); // 1 new, -1 full
  const waxing = p < 0.5;
  const rx = Math.abs(k) * 20;
  const lit = "var(--wx-ink)", dark = "var(--wx-hill)";
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 shrink-0" aria-hidden>
      <circle cx="22" cy="22" r="20" style={{ fill: dark }} />
      <path d={`M22 2 A20 20 0 0 ${waxing ? 1 : 0} 22 42 A${rx} 20 0 0 ${(k > 0) === waxing ? 0 : 1} 22 2Z`} style={{ fill: lit }} />
    </svg>
  );
}

const Stat = ({ k, v }: { k: string; v: string }) => <div className="wx-inner px-3 py-2"><p className="text-xs wx-dim">{k}</p><p className="text-sm tabular-nums">{v}</p></div>;
function Pollutant({ k, v, unit, safe }: { k: string; v: number | null; unit: string; safe: number }) {
  const f = v == null ? 0 : Math.min(1, v / safe);
  return <div className="wx-inner px-3 py-2">
    <p className="text-xs wx-dim">{k}</p>
    <p className="text-sm tabular-nums">{v ?? "—"} <span className="text-xs wx-dim">{unit}</span></p>
    <span className="mt-1.5 block h-1 rounded-full" style={{ background: "var(--wx-hill)" }}><span className="block h-full rounded-full" style={{ width: `${f * 100}%`, background: CPCB[f < 0.5 ? 0 : f < 1 ? 1 : 3] }} /></span>
  </div>;
}
const Out = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noreferrer" className="wx-inner flex items-center justify-between px-4 py-3 text-sm font-medium wx-accent">{children}<ExternalLink className="h-4 w-4" aria-hidden /></a>;
const Skel = () => <span className="skeleton mt-2 block h-7 w-full" />;
