/** Conference phase from a moment in time. Days are 27–29 Nov 2026, Indian time (UTC+5:30). */
export type Phase = "before" | "live" | "after";

export const CONF_START = new Date("2026-11-27T00:00:00+05:30");
export const CONF_END = new Date("2026-11-30T00:00:00+05:30");

export function phaseAt(now: Date): Phase {
  const t = now.getTime();
  if (t < CONF_START.getTime()) return "before";
  if (t < CONF_END.getTime()) return "live";
  return "after";
}

export function daysUntilStart(now: Date): number {
  return Math.max(0, Math.ceil((CONF_START.getTime() - now.getTime()) / 86_400_000));
}

/** Role ribbon: highest-ranked role wins, the rest are listed as extras. */
const RANK = ["co_convener", "convener", "steering_committee", "keynote", "track_chair", "presenter", "reviewer", "author", "organizer", "volunteer", "delegate"];
export const ROLE_LABEL: Record<string, string> = {
  co_convener: "Co-Convener",
  convener: "Convener",
  steering_committee: "Steering Committee",
  keynote: "Keynote",
  track_chair: "Track Chair",
  presenter: "Presenter",
  reviewer: "Reviewer",
  author: "Author",
  organizer: "Organizer",
  volunteer: "Volunteer",
  delegate: "Delegate",
  payer: "Presenter",
};

export function ribbon(roles: string[]): { main: string; extra: string[] } {
  const norm = Array.from(new Set(roles.map((r) => (r === "payer" ? "presenter" : r)).filter((r) => RANK.includes(r))));
  norm.sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b));
  if (!norm.length) return { main: roles.includes("visitor") ? "Visitor" : "Delegate", extra: [] };
  return { main: ROLE_LABEL[norm[0]!] ?? "Delegate", extra: norm.slice(1).map((r) => ROLE_LABEL[r] ?? r) };
}

/** Canonical delegate code: trims, uppercases and adds the WMC- prefix to short codes like "val1". */
export function normalizeCode(raw: string): string {
  const c = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z0-9]{2,6}-[A-Z0-9]{3,8}$/.test(c)) return c;
  const bare = c.replace(/^WMC/, "");
  return /^[A-Z0-9]{3,8}$/.test(bare) ? `WMC-${bare}` : c;
}

/** Pulls a delegate code out of a scanned QR/NFC payload (URL or raw code). */
export function codeFromScan(text: string): string | null {
  const t = text.trim();
  const m = t.match(/(?:\/(?:id|c)\/)?([A-Z0-9]{2,6}-[A-Z0-9]{3,8})\/?(?:[?#].*)?$/i);
  if (m?.[1]) return m[1].toUpperCase();
  const u = t.match(/\/(?:id|c)\/([A-Z0-9]{3,8})\/?(?:[?#].*)?$/i);
  if (u?.[1]) return normalizeCode(u[1]);
  return /^(WMC)?(?=[A-Z]*[0-9])[A-Z0-9]{3,8}$/i.test(t) ? normalizeCode(t) : null;
}
