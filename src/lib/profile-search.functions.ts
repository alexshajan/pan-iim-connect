import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onPlatform, searchQuery, type PlatformId, PLATFORMS } from "@/lib/profile-links";

export type ProfileHit = { url: string; title: string; snippet: string; likely: boolean };
type Input = { platform: PlatformId; name: string };

/** Signed-in only: web search (Firecrawl) for the caller's own profile, ranked by AI against their record. */
export const findMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (!PLATFORMS.some((p) => p.id === d?.platform)) throw new Error("Pick a platform");
    const name = String(d.name ?? "").trim().slice(0, 80);
    if (name.length < 3) throw new Error("Enter your name");
    return { platform: d.platform, name };
  })
  .handler(async ({ data, context }): Promise<{ hits: ProfileHit[]; error?: string }> => {
    const lovable = process.env["LOVABLE_API_KEY"];
    const fc = process.env["FIRECRAWL_API_KEY"];
    if (!lovable || !fc) return { hits: [], error: "Search isn't available right now." };
    const { data: me } = await context.supabase.from("people").select("organization, keywords").eq("user_id", context.userId).maybeSingle();
    const org = (me as { organization?: string | null } | null)?.organization ?? null;

    const res = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": fc },
      body: JSON.stringify({ query: searchQuery(data.platform, data.name, org), limit: 8 }),
    });
    if (!res.ok) {
      console.error("profile search failed", res.status, await res.text());
      return { hits: [], error: "Search failed. Paste your link instead." };
    }
    const body = (await res.json()) as { data?: { web?: unknown[] } | unknown[] };
    const raw = (Array.isArray(body.data) ? body.data : (body.data?.web ?? [])) as { url?: string; title?: string; description?: string }[];
    let hits: ProfileHit[] = raw
      .filter((r) => r.url && onPlatform(data.platform, r.url))
      .slice(0, 6)
      .map((r) => ({ url: r.url!, title: (r.title ?? "").slice(0, 120), snippet: (r.description ?? "").slice(0, 200), likely: false }));
    if (!hits.length) return { hits };

    try {
      const [{ createOpenAI }, { generateText, Output }, { z }] = await Promise.all([import("@ai-sdk/openai"), import("ai"), import("zod")]);
      const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: lovable, headers: { "Lovable-API-Key": lovable, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
      const kw = ((me as { keywords?: string[] } | null)?.keywords ?? []).join(", ");
      const out = await generateText({
        model: provider.responses("openai/gpt-6-astra"),
        system: "You match a conference delegate to web search results. Return indexes of results that are very likely the same person. Be strict: name and institution or field must fit.",
        prompt: `Delegate: ${data.name}; institution: ${org ?? "unknown"}; interests: ${kw || "unknown"}\nResults:\n${hits.map((h, i) => `${i}. ${h.title} | ${h.url} | ${h.snippet}`).join("\n")}`,
        output: Output.object({ schema: z.object({ likely: z.array(z.number()) }) }),
      });
      const likely = new Set(out.output.likely);
      hits = hits.map((h, i) => ({ ...h, likely: likely.has(i) })).sort((a, b) => Number(b.likely) - Number(a.likely));
    } catch (e) {
      console.error("profile rank failed", e);
    }
    return { hits };
  });
