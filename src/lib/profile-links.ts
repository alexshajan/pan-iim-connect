/** Research/professional profile links: platforms, URL checks, search queries. Pure. */
export type PlatformId = "linkedin" | "scholar" | "researchgate" | "orcid" | "ssrn" | "institute";
export type ProfileLink = { platform: PlatformId; url: string };

export const PLATFORMS: { id: PlatformId; label: string; site?: string; hosts: string[] }[] = [
  { id: "linkedin", label: "LinkedIn", site: "linkedin.com/in", hosts: ["linkedin.com"] },
  { id: "scholar", label: "Google Scholar", site: "scholar.google.com/citations", hosts: ["scholar.google."] },
  { id: "researchgate", label: "ResearchGate", site: "researchgate.net/profile", hosts: ["researchgate.net"] },
  { id: "orcid", label: "ORCID", site: "orcid.org", hosts: ["orcid.org"] },
  { id: "ssrn", label: "SSRN", site: "papers.ssrn.com", hosts: ["ssrn.com"] },
  { id: "institute", label: "Institute page", hosts: [] },
];

export const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label ?? "Link";

/** Normalise a pasted URL; returns null when it isn't a usable https link. */
export function cleanUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/\.[a-z]{2,}$/i.test(u.hostname)) return null;
    u.protocol = "https:";
    u.hash = "";
    return u.toString().replace(/\/$/, "").slice(0, 300);
  } catch {
    return null;
  }
}

/** Guess the platform from a URL host; anything unknown is an institute page. */
export function detectPlatform(url: string): PlatformId {
  const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  return PLATFORMS.find((p) => p.hosts.some((h) => host.includes(h)))?.id ?? "institute";
}

/** Web search query for a person on a platform. */
export function searchQuery(platform: PlatformId, name: string, org?: string | null): string {
  const p = PLATFORMS.find((x) => x.id === platform);
  const who = `"${name.trim()}"${org ? ` ${org.trim()}` : ""}`;
  return p?.site ? `site:${p.site} ${who}` : `${who} faculty profile`;
}

/** Keep only results that sit on the chosen platform. */
export function onPlatform(platform: PlatformId, url: string): boolean {
  if (platform === "institute") return true;
  return detectPlatform(url) === platform;
}

/** Add or replace a link (one per platform, institute pages allow two), max 6. */
export function upsertLink(list: ProfileLink[], link: ProfileLink): ProfileLink[] {
  const others = list.filter((l) => l.url !== link.url && (link.platform === "institute" || l.platform !== link.platform));
  return [...others, link].slice(-6);
}
