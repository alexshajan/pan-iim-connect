import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Linkedin, Mail, UserPlus } from "lucide-react";
import { AppShell, EmptyNote } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { platformLabel } from "@/lib/profile-links";
import { normalizeCode, ribbon } from "@/lib/phase";
import { addConnection, connectionsQuery } from "@/components/me/MetPeople";

type Profile = {
  code: string;
  full_name: string;
  opted_in: boolean;
  organization?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  profile_links?: { platform: string; url: string }[];
  is_placeholder?: boolean;
  roles?: string[];
  papers?: { code: string; title: string | null; track: string | null; session_id: string | null }[];
};

export const Route = createFileRoute("/id/$code")({
  head: () => ({
    meta: [
      { title: "Delegate profile, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "A delegate at the 11th Pan-IIM WMC, IIM Shillong. Save their contact." },
      { property: "og:title", content: "Delegate profile, Pan-IIM 2026" },
      { property: "og:description", content: "Met someone at Pan-IIM 2026? Save their contact here." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IdPage,
});

function IdPage() {
  const code = normalizeCode(Route.useParams().code);
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["public-profile", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_profile", { _code: code });
      if (error) throw error;
      return data as Profile | null;
    },
  });

  async function save() {
    try {
      await addConnection(code, "code");
      qc.invalidateQueries({ queryKey: connectionsQuery.queryKey });
      toast.success("Saved to people you've met");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const p = q.data;
  return (
    <AppShell eyebrow="Delegate" title={p?.full_name ?? "Profile"}>
      {q.isLoading ? (
        <EmptyNote>Loading…</EmptyNote>
      ) : !p ? (
        <EmptyNote>No delegate with code {code}.</EmptyNote>
      ) : (
        <div className="mx-auto max-w-md space-y-3">
          <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-5 pb-5 pt-6 shadow-lg backdrop-blur-xl">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/15 blur-2xl" />
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-md">
                {p.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-display truncate text-2xl leading-tight">{p.full_name}</h2>
                {p.opted_in && p.organization ? <p className="truncate text-sm text-muted-foreground">{p.organization}</p> : null}
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{p.code}{p.is_placeholder ? ", TEST" : ""}</p>
              </div>
            </div>
            {p.opted_in ? (
              <span className="mt-4 inline-block -rotate-2 rounded-md border-2 border-primary px-2.5 py-1 text-xs font-bold text-primary">
                {ribbon(p.roles ?? []).main}
              </span>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">This delegate keeps their profile private.</p>
            )}
          </section>

          {p.opted_in && (p.email || (p.profile_links ?? []).length || p.linkedin_url) ? (
            <section className="grid grid-cols-2 gap-2">
              {p.email ? <a href={`mailto:${p.email}`} className="tap flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3.5 py-3 text-sm font-semibold shadow-sm backdrop-blur-xl transition active:scale-[0.97]"><Mail className="h-4 w-4 text-primary" /> Email</a> : null}
              {(p.profile_links ?? []).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="tap flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3.5 py-3 text-sm font-semibold shadow-sm backdrop-blur-xl transition active:scale-[0.97]"><ExternalLink className="h-4 w-4 text-primary" /> {platformLabel(l.platform)}</a>)}
              {p.linkedin_url && !(p.profile_links ?? []).some((l) => l.platform === "linkedin") ? <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="tap flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3.5 py-3 text-sm font-semibold shadow-sm backdrop-blur-xl transition active:scale-[0.97]"><Linkedin className="h-4 w-4 text-primary" /> LinkedIn</a> : null}
            </section>
          ) : null}

          {p.opted_in && p.papers?.length ? (
            <section className="space-y-2">
              {p.papers.map((x) => (
                <div key={x.code} className="rounded-xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur-xl">
                  <span className="text-xs tabular-nums text-muted-foreground">#{x.code}{x.track ? `, ${x.track}` : ""}</span>
                  <span className="mt-0.5 block text-sm font-medium leading-snug">{x.title ?? "Paper title awaited"}</span>
                  {x.session_id ? (
                    <Link to="/session/$sessionId" params={{ sessionId: x.session_id }} className="mt-1.5 inline-block text-xs font-semibold text-primary">See the slot</Link>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {user ? (
            <button type="button" onClick={save} className="tap inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition active:scale-[0.98]">
              <UserPlus className="h-4 w-4" /> Add to my network
            </button>
          ) : (
            <Link to="/auth" className="tap inline-flex w-full justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md">
              Sign in to add to your network
            </Link>
          )}
        </div>
      )}
    </AppShell>
  );
}
