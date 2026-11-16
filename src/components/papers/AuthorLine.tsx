import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { affiliations, apaCitation, bibtex, joiner, nameKey, plainName, type AuthorRef } from "@/lib/apa7";
import { cn } from "@/lib/utils";

type LinkRow = { submission_id: string; full_name: string; code: string; is_presenter: boolean };

/** submission id -> (name key -> delegate code), signed-in only. */
export function useAuthorLinks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["paper-author-links"],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("paper_author_links");
      const m = new Map<string, Map<string, string>>();
      for (const r of (data ?? []) as LinkRow[]) {
        if (!m.has(r.submission_id)) m.set(r.submission_id, new Map());
        m.get(r.submission_id)!.set(nameKey(r.full_name), r.code);
      }
      return m;
    },
  }).data;
}

function codeFor(links: Map<string, string> | undefined, name: string) {
  if (!links) return undefined;
  const k = nameKey(name);
  if (links.has(k)) return links.get(k);
  for (const [lk, c] of links) if (k && lk && (lk.includes(k) || k.includes(lk))) return c;
  return undefined;
}

/** Journal-style byline: names joined APA 7 style, superscript affiliations, presenter starred, profiles linked. */
export function AuthorLine({ authors, presenter, submissionId, compact, className }: {
  authors: AuthorRef[]; presenter?: string | null | undefined; submissionId: string; compact?: boolean | undefined; className?: string | undefined;
}) {
  const all = useAuthorLinks();
  const links = all?.get(submissionId);
  const list = authors.length ? authors : presenter ? [{ name: presenter }] : [];
  if (!list.length) return null;
  const { orgs, marks } = affiliations(list);
  const showMarks = orgs.length > 1;
  const pks = (presenter ?? "").split(",").map((n) => nameKey(n)).filter(Boolean);
  const pk = pks.length > 0;
  return (
    <div className={cn("byline", className)}>
      <p className={cn("leading-snug", compact ? "text-xs" : "text-sm")}>
        {list.map((a, i) => {
          const name = plainName(a.name);
          const pres = pks.includes(nameKey(a.name));
          const code = codeFor(links, a.name);
          const label = (
            <>
              {name}
              {showMarks && marks[i] ? <sup className="ml-px text-[0.6em] tabular-nums">{marks[i]}</sup> : null}
              {pres ? <sup className="text-[0.7em] text-primary" aria-label="presenting">*</sup> : null}
            </>
          );
          return (
            <span key={i}>
              <span className="text-muted-foreground">{joiner(i, list.length)}</span>
              {code ? (
                <Link to="/id/$code" params={{ code }} onClick={(e) => e.stopPropagation()}
                  className={cn("author-link", pres ? "font-semibold text-foreground" : "text-foreground/85")}>{label}</Link>
              ) : (
                <span className={pres ? "font-semibold text-foreground" : "text-foreground/75"}>{label}</span>
              )}
            </span>
          );
        })}
      </p>
      {orgs.length ? (
        <p className={cn("mt-0.5 italic text-muted-foreground", compact ? "text-[0.68rem]" : "text-xs")}>
          {orgs.map((o, i) => (
            <span key={o}>{i ? " · " : ""}{showMarks ? <sup className="not-italic tabular-nums">{i + 1}</sup> : null}{o}</span>
          ))}
        </p>
      ) : null}
      {pk ? <p className="mt-0.5 text-[0.62rem] italic text-muted-foreground"><span className="text-primary">*</span> Presenting author{pks.length > 1 ? "s" : ""}</p> : null}
    </div>
  );
}

/** Copy an APA 7 reference or BibTeX entry. */
export function CiteButton({ authors, title, code }: { authors: AuthorRef[]; title: string; code?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Couldn't copy"); }
    setOpen(false);
  };
  if (!authors.length) return null;
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="tap inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground hover:text-foreground">
        <Quote className="h-3 w-3" /> Cite
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-20 mt-1 flex min-w-36 flex-col overflow-hidden rounded-md border border-border bg-popover text-xs shadow-lg animate-in fade-in slide-in-from-top-1">
          <button type="button" className="px-3 py-2 text-left hover:bg-secondary" onClick={() => copy(apaCitation(authors, title), "APA 7 reference")}>Copy APA 7</button>
          <button type="button" className="px-3 py-2 text-left hover:bg-secondary" onClick={() => copy(bibtex(authors, title, code), "BibTeX")}>Copy BibTeX</button>
        </span>
      ) : null}
    </span>
  );
}
