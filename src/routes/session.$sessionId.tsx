import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthorLine, CiteButton } from "@/components/papers/AuthorLine";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Navigation, Star, UserRound } from "lucide-react";
import { AppShell, EmptyNote, SectionHeading } from "@/components/AppShell";
import { StatusPill } from "@/components/SessionCard";
import { sessionQuery } from "@/lib/conference";
import { longDay, rangeLabel } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useBookmarks } from "@/hooks/useBookmarks";
import { cn } from "@/lib/utils";
import { directionsUrl, venuePoint } from "@/lib/maps";
import { featuredOf } from "@/lib/featured";
import { FeaturedGuests } from "@/components/schedule/FeaturedGuests";

export const Route = createFileRoute("/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Session details, 11th Pan-IIM WMC 2026" },
      {
        name: "description",
        content: "Timing, venue, chair and paper line-up for this conference session.",
      },
      { property: "og:title", content: "Session details, Pan-IIM 2026" },
      {
        property: "og:description",
        content: "Timing, venue, chair and paper line-up for this conference session.",
      },
    ],
  }),
  component: SessionDetail,
});

function SessionDetail() {
  const { sessionId } = Route.useParams();
  const now = new Date();
  const { user } = useAuth();
  const { starred, toggle } = useBookmarks(user?.id ?? null);
  const { data: session, isLoading } = useQuery(sessionQuery(sessionId));

  if (isLoading) {
    return (
      <AppShell title="Session">
        <EmptyNote>Loading…</EmptyNote>
      </AppShell>
    );
  }
  if (!session) {
    return (
      <AppShell title="Session">
        <EmptyNote>This session is no longer on the schedule.</EmptyNote>
      </AppShell>
    );
  }

  const venue = session.venues;
  const pt = venuePoint(venue, (session as { room?: string | null }).room);
  const isStarred = starred.includes(session.id);
  const papers = [...(session.papers ?? [])].sort((a, b) => a.slot_order - b.slot_order);
  const featured = featuredOf(session);

  return (
    <AppShell eyebrow={featured?.label ?? session.tracks?.name ?? session.session_type} title={featured?.headline ?? session.title}>
      <Link
        to="/calendar"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Back to agenda
      </Link>

      <div className="card-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill session={session} now={now} />
          {session.status_note ? (
            <span className="text-xs text-muted-foreground">{session.status_note}</span>
          ) : null}
        </div>
        <p className="text-display mt-2 text-lg">{longDay(session.starts_at)}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {rangeLabel(session.starts_at, session.ends_at)}
        </p>
        {venue ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" strokeWidth={1.9} />
            {venue.name}
            {venue.walk_minutes ? (
              <span className="text-muted-foreground">,  {venue.walk_minutes} min walk</span>
            ) : null}
          </p>
        ) : null}
        {session.chair ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <UserRound className="h-4 w-4" strokeWidth={1.9} /> Chair: {session.chair}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => toggle(session.id)}
            className={cn(
              "tap inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium",
              isStarred
                ? "bg-accent text-accent-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            <Star className={cn("h-4 w-4", isStarred && "fill-current")} strokeWidth={1.9} />
            {isStarred ? "In my agenda" : "Add to my agenda"}
          </button>
          {pt && session.mode !== "online" ? (
            <a
              href={directionsUrl(pt.lat, pt.lng, pt.label)}
              target="_blank"
              rel="noreferrer"
              className="tap inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium"
            >
              <Navigation className="h-4 w-4" strokeWidth={1.9} /> Take me there
            </a>
          ) : null}
        </div>
      </div>

      {featured ? (
        <FeaturedGuests f={featured} className="mt-4" />
      ) : session.summary ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{session.summary}</p>
      ) : null}

      {papers.length ? (
        <>
          <SectionHeading title={`${papers.length} papers in this session`} />
          <div className="space-y-3">
            {papers.map((p, i) => (
              <div key={p.id} className="card-surface px-5 py-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground tabular-nums">
                  Paper {i + 1}{p.code ? <span className="font-normal">MS #{p.code}</span> : null}
                  <span className="ml-auto"><CiteButton authors={p.authorList ?? []} title={p.title} code={p.code} /></span>
                </p>
                <h3 className="text-display mt-1 text-[1.02rem] leading-snug">{p.title}</h3>
                {p.authorList?.length ? (
                  <AuthorLine className="mt-2" authors={p.authorList} presenter={p.presenter} submissionId={p.id} />
                ) : (
                  <>
                    <p className="mt-1.5 text-sm">{p.authors}</p>
                    {p.affiliation ? <p className="text-xs text-muted-foreground">{p.affiliation}</p> : null}
                  </>
                )}
                {p.abstract ? (
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {p.abstract}
                  </p>
                ) : null}
                {p.discussant ? (
                  <p className="mt-2 text-xs text-muted-foreground">Discussant: {p.discussant}</p>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
