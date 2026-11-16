import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORMS, cleanUrl, detectPlatform, platformLabel, upsertLink, type PlatformId, type ProfileLink } from "@/lib/profile-links";
import { findMyProfile, type ProfileHit } from "@/lib/profile-search.functions";

/** Paste or search for LinkedIn / Scholar / ResearchGate / ORCID / SSRN / institute pages. Saves on every change. */
export function ProfileLinks({ initial, name }: { initial: ProfileLink[]; name: string }) {
  const qc = useQueryClient();
  const search = useServerFn(findMyProfile);
  const [links, setLinks] = useState<ProfileLink[]>(initial);
  const [platform, setPlatform] = useState<PlatformId>("linkedin");
  const [paste, setPaste] = useState("");
  const [who, setWho] = useState(name);
  const [hits, setHits] = useState<ProfileHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function persist(next: ProfileLink[]) {
    const prev = links;
    setLinks(next);
    const { error } = await supabase.rpc("set_my_profile_links", { _links: next });
    if (error) { setLinks(prev); toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["registry", "me"] });
  }
  function addUrl(raw: string, p?: PlatformId) {
    const url = cleanUrl(raw);
    if (!url) { toast.error("That link doesn't look right"); return; }
    persist(upsertLink(links, { platform: p ?? detectPlatform(url), url }));
    setPaste("");
    setHits(null);
  }
  async function find() {
    setBusy(true);
    setHits(null);
    try {
      const r = await search({ data: { platform, name: who } });
      if (r.error) toast.error(r.error);
      setHits(r.hits);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-surface space-y-3 px-5 py-4">
      <div>
        <span className="block text-sm font-semibold">Your profiles</span>
        <span className="block text-xs text-muted-foreground">LinkedIn, Scholar, ResearchGate, ORCID or your institute page.</span>
      </div>

      {links.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {links.map((l) => (
            <li key={l.url} className="inline-flex items-center gap-1 rounded-md border border-border bg-background py-1 pl-2.5 pr-1 text-xs font-medium">
              <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">{platformLabel(l.platform)} <ExternalLink className="size-3 opacity-60" /></a>
              <button type="button" aria-label={`Remove ${platformLabel(l.platform)}`} onClick={() => persist(links.filter((x) => x.url !== l.url))} className="tap grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={(e) => { e.preventDefault(); addUrl(paste); }} className="flex gap-2">
        <input value={paste} onChange={(e) => setPaste(e.target.value)} inputMode="url" placeholder="Paste a profile link" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={!paste.trim()} className="tap rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">Add</button>
      </form>

      <div className="space-y-2 border-t border-border pt-3">
        <span className="block text-xs font-medium text-muted-foreground">Or find it for me</span>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <button key={p.id} type="button" onClick={() => { setPlatform(p.id); setHits(null); }} aria-pressed={platform === p.id}
              className={`tap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${platform === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Name as it appears online" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          <button type="button" onClick={find} disabled={busy || who.trim().length < 3} className="tap inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-semibold disabled:opacity-40">
            <Search className={`size-4 ${busy ? "animate-pulse" : ""}`} /> {busy ? "Looking" : "Search"}
          </button>
        </div>
        {hits && !hits.length ? <p className="text-xs text-muted-foreground">Nothing found on {platformLabel(platform)}. Paste your link above.</p> : null}
        {hits?.length ? (
          <ul className="space-y-1.5">
            {hits.map((h) => (
              <li key={h.url} className="flex items-start gap-2 rounded-xl border border-border bg-background p-2.5">
                <div className="min-w-0 flex-1">
                  <a href={h.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium underline-offset-2 hover:underline">{h.title || h.url}</a>
                  <span className="block truncate text-xs text-muted-foreground">{h.snippet || h.url}</span>
                  {h.likely ? <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-semibold text-primary">Likely you</span> : null}
                </div>
                <button type="button" onClick={() => addUrl(h.url, platform)} className="tap shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">This is me</button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
