/** Collectible Network stamps. Pure: computed from what the person already has. */
export type StampId = "first" | "ten" | "iims" | "keynote" | "lake" | "owl" | "shake";
export type Stamp = { id: StampId; label: string; hint: string; hidden?: boolean };

export const STAMPS: Stamp[] = [
  { id: "first", label: "First handshake", hint: "Tap or scan one card" },
  { id: "ten", label: "Ten handshakes", hint: "Meet ten people" },
  { id: "iims", label: "Five IIMs", hint: "Meet people from five different IIMs" },
  { id: "keynote", label: "Met a keynote", hint: "Shake hands with a keynote speaker" },
  { id: "lake", label: "Lakeside", hint: "Open the Campus Lake pin" },
  { id: "owl", label: "Night owl", hint: "Network after 11 pm" },
  { id: "shake", label: "Shaken, not stirred", hint: "A secret", hidden: true },
];

export type StampInput = {
  met: { organization: string | null; roles?: string[] | undefined }[];
  visitedLake?: boolean;
  shook?: boolean;
  now?: Date;
};

/** Distinct IIM campuses among organizations ("IIM Shillong", "Indian Institute of Management Ranchi"). */
export function iimCampuses(orgs: (string | null)[]): string[] {
  const out = new Set<string>();
  for (const o of orgs) {
    if (!o) continue;
    const m = o.match(/\bIIM[\s,-]+([A-Za-z]+)/i) ?? o.match(/Indian Institute of Management[\s,-]+([A-Za-z]+)/i);
    if (m) out.add(m[1]!.toLowerCase());
  }
  return [...out];
}

export function earnedStamps(i: StampInput): Set<StampId> {
  const s = new Set<StampId>();
  if (i.met.length >= 1) s.add("first");
  if (i.met.length >= 10) s.add("ten");
  if (iimCampuses(i.met.map((m) => m.organization)).length >= 5) s.add("iims");
  if (i.met.some((m) => m.roles?.includes("keynote"))) s.add("keynote");
  if (i.visitedLake) s.add("lake");
  const h = (i.now ?? new Date()).getHours();
  if (h >= 23 || h < 4) s.add("owl");
  if (i.shook) s.add("shake");
  return s;
}

const KEY = "paniim.stamps";
/** Device-local flags for stamps that come from actions, not data. */
export type Flags = { lake?: boolean; shake?: boolean; owl?: boolean };
export function readFlags(): Flags {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function setFlag(k: "lake" | "shake" | "owl") {
  const f = readFlags();
  f[k] = true;
  localStorage.setItem(KEY, JSON.stringify(f));
}
