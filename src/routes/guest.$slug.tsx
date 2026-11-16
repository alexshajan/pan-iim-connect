import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyNote, SectionHeading } from "@/components/AppShell";
import { sessionsQuery } from "@/lib/conference";
import { longDay, rangeLabel } from "@/lib/format";
import { guestsOf } from "@/lib/featured";
import { GUEST_PHOTOS } from "@/lib/guest-photos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guest/$slug")({
  head: () => ({
    meta: [
      { title: "Guest speaker, 11th Pan-IIM WMC" },
      { name: "description", content: "Keynote and panel guest at the 11th Pan-IIM WMC, IIM Shillong." },
      { property: "og:title", content: "Guest speaker, 11th Pan-IIM WMC" },
      { property: "og:description", content: "Keynote and panel guest at the 11th Pan-IIM WMC, IIM Shillong." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestPage,
});

const initials = (n: string) =>
  n.replace(/\b(padma\s+\w+|prof|dr|shri|smt|ms|mr|mrs)\b\.?\s*/gi, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

function GuestPage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(sessionsQuery);
  const guest = data ? guestsOf(data).find((g) => g.slug === slug) : undefined;

  if (isLoading) return <AppShell title="Guest"><div className="h-64 animate-pulse rounded-lg bg-muted" /></AppShell>;
  if (!guest) return <AppShell title="Guest"><EmptyNote>We could not find this guest in the programme.</EmptyNote></AppShell>;

  const keynote = guest.appearances.some((a) => a.kind === "keynote");
  const name = guest.name.replace(/^padma\s+\w+\s*/i, "");
  const photo = GUEST_PHOTOS[guest.slug];

  return (
    <AppShell title="Guest">
      <article className={cn("featured-plate vip-card relative overflow-hidden", keynote ? "featured-keynote" : "featured-panel")}>
        <div className="flex items-center gap-4">
          {photo ? (
            <img src={photo.src} alt={name} className="vip-portrait h-20 w-20 shrink-0 rounded-full object-cover" />
          ) : (
            <span aria-hidden className="guest-seal vip-portrait grid h-20 w-20 shrink-0 place-items-center rounded-full text-xl font-bold">{initials(guest.name)}</span>
          )}
          <div className="min-w-0">
            {guest.honour ? <p className="vip-honour text-[0.65rem] font-bold">{guest.honour}</p> : null}
            <h1 className="text-display text-2xl leading-tight">{name}</h1>
            {guest.role ? <p className="mt-1 text-sm leading-snug opacity-80">{guest.role}</p> : null}
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold opacity-70">{keynote ? "Keynote speaker" : "Panel guest"}</p>
        {photo?.credit ? <p className="mt-1 text-[0.6rem] opacity-60">Photo: {photo.credit}</p> : null}
      </article>

      <SectionHeading title="At the conference" className="mt-6" />
      <ul className="space-y-2">
        {guest.appearances.map((a) => (
          <li key={a.sessionId}>
            <Link to="/session/$sessionId" params={{ sessionId: a.sessionId }} className="card-flat press-tile block px-4 py-3">
              <p className="text-sm font-semibold">{a.label}</p>
              {a.topic ? <p className="mt-0.5 text-sm text-muted-foreground">{a.topic}</p> : null}
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{longDay(a.starts_at)}, {rangeLabel(a.starts_at, a.ends_at)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
