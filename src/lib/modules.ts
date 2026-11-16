/** Which guest-facing sections are switched on. Pure, tested. */
export type ModuleKey = "campus" | "guide" | "network" | "meals" | "updates" | "idcard" | "papers";
export type ModuleFlags = Record<ModuleKey, boolean>;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  campus: "Campus map",
  guide: "Travel & tourism guide",
  network: "Network",
  meals: "Meals & campus services",
  updates: "Updates",
  idcard: "ID card / digital pass",
  papers: "Browse papers",
};

/** Phase 1 (guest onboarding): only Now, Calendar and Me. */
export const PHASE_1: ModuleFlags = { campus: false, guide: false, network: false, meals: false, updates: true, idcard: false, papers: true };
export const ALL_ON: ModuleFlags = { campus: true, guide: true, network: true, meals: true, updates: true, idcard: true, papers: true };

/** Unknown/missing settings fall back to Phase 1 so nothing unfinished leaks. */
export function parseModules(raw: unknown): ModuleFlags {
  const out = { ...PHASE_1 };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(out) as ModuleKey[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}

/** The module a path belongs to, or null for always-on pages. */
export function moduleForPath(path: string): ModuleKey | null {
  const p = path.split("?")[0] ?? path;
  if (p === "/campus" || p.startsWith("/campus/")) return "campus";
  if (p === "/guide" || p.startsWith("/guide/")) return "guide";
  if (p === "/papers" || p === "/network/papers") return "papers";
  if (p === "/network" || p.startsWith("/network/")) return "network";
  if (p === "/updates") return "updates";
  return null;
}

export function pathAllowed(path: string, flags: ModuleFlags, isOrganizer: boolean) {
  if (isOrganizer) return true;
  const m = moduleForPath(path);
  return m ? flags[m] : true;
}
