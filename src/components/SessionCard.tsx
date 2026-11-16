import { Link } from "@tanstack/react-router";
import { Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLive, timeOf } from "@/lib/format";
import { trackTextClass, type Session } from "@/lib/conference";

/** Ink-stamped status marks: on air, cancelled, moved, delayed. */
export function StatusPill({ session, now }: { session: Session; now: Date }) {
  if (session.status === "cancelled") {
    return <span className="stamp text-destructive">Cancelled</span>;
  }
  if (isLive(session.starts_at, session.ends_at, now)) {
    return (
      <span className="stamp text-live">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
        On air
      </span>
    );
  }
  if (session.status === "moved" || session.status === "delayed") {
    return (
      <span className="stamp text-warn-foreground/80">
        {session.status === "moved" ? "Room changed" : "Delayed"}
      </span>
    );
  }
  return null;
}

function durationMinutes(session: Session) {
  const ms = new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

/** Fraction of the session already elapsed, 0 when not running. */
function elapsedFraction(session: Session, now: Date) {
  const start = new Date(session.starts_at).getTime();
  const end = new Date(session.ends_at).getTime();
  if (now.getTime() <= start || end <= start) return 0;
  return Math.min(1, (now.getTime() - start) / (end - start));
}

/** Printed clock reading: big numerals, small meridiem, kept on one line. */
function Clock({ value, big }: { value: string; big?: boolean }) {
  const [digits, meridiem] = value.split(" ");
  return (
    <span
      className={cn(
        "flex items-baseline gap-0.5 font-mono leading-none whitespace-nowrap tabular-nums",
        big ? "text-[0.95rem] font-bold" : "text-[0.75rem] text-muted-foreground",
      )}
    >
      {digits}
      {meridiem ? (
        <span className="text-[0.52rem] font-bold tracking-[0.06em] opacity-70">
          {meridiem}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The conference pass: a printed ticket with a time stub on the left, a
 * perforated tear seam, and the session details on the counterfoil.
 */
export function SessionCard({
  session,
  now,
  starred,
  onToggleStar,
}: {
  session: Session;
  now: Date;
  starred?: boolean;
  onToggleStar?: (id: string) => void;
}) {
  const accent = session.tracks?.accent ?? "indigo";
  const cancelled = session.status === "cancelled";
  const live = !cancelled && isLive(session.starts_at, session.ends_at, now);
  const mins = durationMinutes(session);
  const progress = live ? elapsedFraction(session, now) : 0;

  return (
    <div className={cn("pass press overflow-hidden", live && "ring-1 ring-live/45")}>
      <Link
        to="/session/$sessionId"
        params={{ sessionId: session.id }}
        className="flex items-stretch"
      >
        {/* time stub */}
        <div className="flex w-[5.3rem] shrink-0 flex-col items-center justify-center gap-1 bg-surface-muted/80 py-5">
          <Clock value={timeOf(session.starts_at)} big />
          <span className="h-3 w-px bg-seam" />
          <Clock value={timeOf(session.ends_at)} />
          <span className="mt-1.5 text-[0.55rem] font-bold text-muted-foreground">
            {mins} min
          </span>
        </div>

        <div className="seam my-0" aria-hidden />

        {/* counterfoil */}
        <div className="min-w-0 flex-1 py-4 pr-4 pl-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {session.tracks ? (
                <p
                  className={cn(
                    "font-mono text-[0.58rem] font-bold",
                    trackTextClass[accent] ?? "text-track-indigo",
                  )}
                >
                  {session.tracks.name}
                </p>
              ) : null}
              <h3
                className={cn(
                  "text-display mt-1 text-[1.02rem] leading-snug",
                  cancelled && "line-through opacity-60",
                )}
              >
                {session.title}
              </h3>
            </div>
            {onToggleStar ? (
              <button
                type="button"
                aria-label={starred ? "Remove from my agenda" : "Add to my agenda"}
                onClick={(e) => {
                  e.preventDefault();
                  onToggleStar(session.id);
                }}
                className="tap -mt-1 -mr-1 rounded-full p-2 text-muted-foreground hover:text-primary"
              >
                <Star
                  className={cn("h-[1.1rem] w-[1.1rem]", starred && "fill-primary text-primary")}
                  strokeWidth={2}
                />
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {session.venues ? (
              <span className="gate-plate">
                Room, {session.venues.short_name ?? session.venues.name}
              </span>
            ) : null}
            {session.papers?.length ? (
              <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                <Users className="h-3.5 w-3.5" strokeWidth={1.9} />
                {session.papers.length} papers
              </span>
            ) : null}
            <StatusPill session={session} now={now} />
          </div>

          {session.status_note ? (
            <p className="mt-2 text-xs text-muted-foreground">{session.status_note}</p>
          ) : null}
        </div>
      </Link>

      {live ? (
        <div className="h-[3px] w-full bg-live/15">
          <div
            className="h-full bg-live transition-[width] duration-1000"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
