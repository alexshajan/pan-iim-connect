const TZ = "Asia/Kolkata";

export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
}

export function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
}

export function longDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
}

export function rangeLabel(startIso: string, endIso: string) {
  return `${timeOf(startIso)} – ${timeOf(endIso)}`;
}

export function relativeToNow(iso: string, now = new Date()) {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const mins = Math.round(diffMs / 60000);
  const abs = Math.abs(mins);
  if (abs < 1) return "now";
  if (abs < 60) return mins > 0 ? `in ${abs} min` : `${abs} min ago`;
  const hrs = Math.round(abs / 60);
  if (abs < 60 * 24) return mins > 0 ? `in ${hrs} hr` : `${hrs} hr ago`;
  const days = Math.round(abs / (60 * 24));
  return mins > 0 ? `in ${days} day${days > 1 ? "s" : ""}` : `${days} day${days > 1 ? "s" : ""} ago`;
}

export function isLive(startIso: string, endIso: string, now = new Date()) {
  const t = now.getTime();
  return t >= new Date(startIso).getTime() && t <= new Date(endIso).getTime();
}
