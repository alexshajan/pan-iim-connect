// Pure WhatsApp helpers: numbers, delivery-state ordering, the 24-hour window, template variables.

/** Digits-only E.164 for Meta. Bare 10-digit Indian mobiles get the 91 prefix. */
export function toWaId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) d = "91" + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

export const prettyWa = (id: string) => (id.startsWith("91") && id.length === 12 ? `+91 ${id.slice(2, 7)} ${id.slice(7)}` : `+${id}`);

const RANK: Record<string, number> = { failed: -1, accepted: 0, sent: 1, delivered: 2, read: 3 };
/** A later callback may only move a message forward; "failed" always sticks. */
export function nextStatus(current: string, incoming: string): string {
  if (current === "failed") return current;
  if (incoming === "failed") return incoming;
  return (RANK[incoming] ?? 0) > (RANK[current] ?? 0) ? incoming : current;
}

export const WINDOW_MS = 24 * 3600_000;
/** Free-form replies are allowed for 24 h after the guest last wrote. */
export function windowLeft(lastInbound: string | null | undefined, now = Date.now()): number {
  if (!lastInbound) return 0;
  return Math.max(0, new Date(lastInbound).getTime() + WINDOW_MS - now);
}

/** Number of {{n}} variables in a template body. */
export function varCount(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Merge fields organizers can map onto template variables. */
export const MERGE_FIELDS = ["first_name", "full_name", "delegate_code", "institution", "custom"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type Recipient = { full_name: string; delegate_code: string; organization: string | null };

export function fillParam(field: MergeField, custom: string, r: Recipient): string {
  switch (field) {
    case "first_name": return r.full_name.replace(/^(prof|dr|mr|ms|mrs|shri|smt)\.?\s+/i, "").split(/\s+/)[0] || r.full_name;
    case "full_name": return r.full_name;
    case "delegate_code": return r.delegate_code;
    case "institution": return r.organization || "your institution";
    default: return custom;
  }
}

/** Template names Meta accepts: lowercase letters, digits, underscores. */
export const templateName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 512);
