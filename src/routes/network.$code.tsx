import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Download, Linkedin, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, SectionHeading } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { directoryPeopleQuery, useNetworkMarks } from "@/lib/network-data";
import { initials } from "@/lib/network";
import { ribbon } from "@/lib/phase";
import { sessionsQuery } from "@/lib/conference";
import { longDay, rangeLabel } from "@/lib/format";
import { addConnection } from "@/components/me/MetPeople";
import { toVCard } from "@/lib/vcard";

export const Route = createFileRoute("/network/$code")({
  head: () => ({
    meta: [
      { title: "Delegate profile, Pan-IIM 2026 Network" },
      { name: "description", content: "Research interests, papers and session times for a Pan-IIM 2026 delegate." },
      { property: "og:title", content: "Delegate profile, Pan-IIM 2026" },
      { property: "og:description", content: "Meet them at the 11th Pan-IIM WMC, IIM Shillong." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonSheet,
});

function PersonSheet() {
  const { code } = Route.useParams();
  const { user } = useAuth();
  const dir = useQuery(directoryPeopleQuery);
  const sessions = useQuery(sessionsQuery);
  const marks = useNetworkMarks(user?.id ?? null);
  const p = dir.data?.find((x) => x.code.toUpperCase() === code.toUpperCase());
  if (dir.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  if (!p) return <EmptyNote>This person isn't listed in the directory.</EmptyNote>;
  const r = ribbon(p.roles);
  const marked = marks.people.includes(p.code);

  function save() {
    const blob = new Blob([toVCard({ full_name: p!.full_name, organization: p!.organization, email: p!.email, linkedin_url: p!.linkedin_url })], { type: "text/vcard" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p!.full_name}.vcf`;
    a.click();
  }

  return (
    <>
      <div className="index-card overflow-hidden">
        <div className="bg-primary px-5 py-2 text-[0.62rem] font-bold text-primary-foreground">
          {[r.main, ...r.extra].join(", ")}{p.is_placeholder ? ", TEST" : ""}
        </div>
        <div className="flex gap-4 px-5 pt-4 pb-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-secondary text-lg font-bold text-primary">{initials(p.full_name)}</span>
          <div className="min-w-0">
            <h2 className="text-display text-[1.4rem] leading-tight">{p.full_name}</h2>
            <p className="text-sm text-muted-foreground">{p.organization ?? ""}</p>
            <p className="mt-1 text-[0.68rem] text-muted-foreground">{p.code}</p>
          </div>
        </div>
        {p.bio ? <p className="px-5 pb-4 text-sm">{p.bio}</p> : null}
        {p.keywords.length ? (
          <div className="flex flex-wrap gap-1.5 px-5 pb-5">{p.keywords.map((k) => <span key={k} className="kw-stamp">{k}</span>)}</div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => marks.toggle({ code: p.code }).catch((e: Error) => toast.error(e.message))} className="tap flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground">
          <Bookmark className="h-3.5 w-3.5" fill={marked ? "currentColor" : "none"} /> {marked ? "Bookmarked" : "Bookmark"}
        </button>
        <button type="button" onClick={() => addConnection(p.code, "code").then(() => toast.success("Added to people you've met")).catch((e: Error) => toast.error(e.message))} className="tap flex items-center justify-center gap-1.5 rounded-full bg-secondary px-4 py-2.5 text-xs font-semibold">
          <UserPlus className="h-3.5 w-3.5" /> Add to met
        </button>
        {p.linkedin_url ? (
          <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="tap flex items-center justify-center gap-1.5 rounded-full bg-secondary px-4 py-2.5 text-xs font-semibold"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a>
        ) : null}
        {p.email ? (
          <a href={`mailto:${p.email}`} className="tap flex items-center justify-center gap-1.5 rounded-full bg-secondary px-4 py-2.5 text-xs font-semibold"><Mail className="h-3.5 w-3.5" /> Email</a>
        ) : null}
        <button type="button" onClick={save} className="tap flex items-center justify-center gap-1.5 rounded-full bg-secondary px-4 py-2.5 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> Save contact</button>
      </div>

      <SectionHeading title={`At this conference (${p.papers.length})`} />
      {p.papers.length ? (
        <div className="space-y-3">
          {p.papers.map((x) => {
            const s = sessions.data?.find((y) => y.id === x.session_id);
            return (
              <div key={x.id} className="pass px-5 py-4">
                <p className="text-xs text-muted-foreground">#{x.code}{x.track ? `, ${x.track}` : ""}</p>
                <p className="text-display mt-1 leading-snug">{x.title ?? "Title awaited"}</p>
                <p className="mt-2 text-xs text-muted-foreground">{s ? `${longDay(s.starts_at)}, ${rangeLabel(s.starts_at, s.ends_at)}, ${s.venues?.name ?? ""}` : "Slot awaited"}</p>
                {s ? <Link to="/session/$sessionId" params={{ sessionId: s.id }} className="mt-2 inline-block text-xs font-semibold text-primary">Open in agenda →</Link> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyNote>No papers listed.</EmptyNote>
      )}
    </>
  );
}
