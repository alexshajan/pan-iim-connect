import { useQuery } from "@tanstack/react-query";

const LAT = 25.616, LON = 91.954;
export type ShillongNow = {
  temp: number; feels: number; humidity: number; code: number; wind: number; windDir: number;
  lo: number; hi: number; rise: number; set: number; aqi: number | null; pm25: number | null;
  hours: { min: number; label: string; temp: number; code: number }[];
};
const toMin = (iso: string) => { const [h, m] = iso.slice(11, 16).split(":").map(Number); return h! * 60 + m!; };

export function useShillongNow() {
  return useQuery({
    queryKey: ["shillong-now"],
    staleTime: 15 * 60_000,
    queryFn: async (): Promise<ShillongNow> => {
      const [w, a] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code&daily=temperature_2m_min,temperature_2m_max,sunrise,sunset&timezone=Asia%2FKolkata&forecast_days=1`).then((r) => r.json()),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi,pm2_5`).then((r) => r.json()).catch(() => null),
      ]);
      return {
        temp: Math.round(w.current.temperature_2m), feels: Math.round(w.current.apparent_temperature),
        humidity: Math.round(w.current.relative_humidity_2m), code: w.current.weather_code,
        wind: Math.round(w.current.wind_speed_10m), windDir: w.current.wind_direction_10m,
        lo: Math.round(w.daily.temperature_2m_min[0]), hi: Math.round(w.daily.temperature_2m_max[0]),
        rise: toMin(w.daily.sunrise[0]), set: toMin(w.daily.sunset[0]),
        aqi: a?.current ? Math.round(a.current.us_aqi) : null, pm25: a?.current ? Math.round(a.current.pm2_5) : null,
        hours: (w.hourly.time as string[]).map((t, i) => ({ min: toMin(t), label: t.slice(11, 13), temp: Math.round(w.hourly.temperature_2m[i]), code: w.hourly.weather_code[i] })),
      };
    },
  });
}

export const istMinute = (d: Date) => { const x = new Date(d.getTime() + 5.5 * 3600_000); return x.getUTCHours() * 60 + x.getUTCMinutes(); };
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
