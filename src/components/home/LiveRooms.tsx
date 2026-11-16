import { Link } from "@tanstack/react-router";
import type { Session } from "@/lib/conference";
import { rangeLabel } from "@/lib/format";

/** Snap carousel of sessions running now in parallel rooms. */
export function LiveRooms({ live }: { live: Session[] }) {
  if (!live.length) return null;
  return (
    <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
      {live.map((s, i) => (
        <Link
          key={s.id}
          to="/session/$sessionId"
          params={{ sessionId: s.id }}
          className="pass tap rise w-[15rem] shrink-0 snap-start px-4 py-4"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span className="stamp text-live animate-pulse">Live</span>
          <p className="text-display mt-2 line-clamp-2 text-[0.98rem] leading-snug">{s.title}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {s.venues?.name ?? "Venue awaited"}, {rangeLabel(s.starts_at, s.ends_at)}
          </p>
        </Link>
      ))}
    </div>
  );
}
