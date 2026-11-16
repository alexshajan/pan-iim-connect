import { Link } from "@tanstack/react-router";
import { buildIcs, googleEventUrl, outlookEventUrl, type IcsEvent } from "@/lib/ics";
import { AnimatePresence, motion } from "motion/react";
import { AppleCalendarLogo, GoogleCalendarLogo, OutlookLogo } from "@/components/brand/CalendarLogos";
import { Check, Columns3, MapPin, Monitor, Navigation, Presentation, Star } from "lucide-react";
import type { Session } from "@/lib/conference";
import { placeOf } from "@/lib/conference";
import { rangeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { directionsUrl, venuePoint } from "@/lib/maps";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { featuredOf } from "@/lib/featured";
import { FeaturedGuests } from "./FeaturedGuests";
import { AuthorLine, CiteButton } from "@/components/papers/AuthorLine";

const TYPE_LABEL: Record<string, string> = {
  paper: "Paper session",
  keynote: "Keynote",
  panel: "Panel",
  ceremony: "Ceremony",
  evening: "Evening",
  meal: "Meal",
  break: "Break",
};

/**
 * Bottom drawer for one calendar event: what, when, where, papers, and the
 * one action that matters most, keeping it in My Agenda.
 */
export function EventDrawer({
  session,
  onClose,
  inAgenda,
  presenting,
  myCodes,
  onToggleAgenda,
  onCompare,
}: {
  session: Session | null;
  onClose: () => void;
  inAgenda: boolean;
  presenting: boolean;
  myCodes: ReadonlySet<string>;
  onToggleAgenda: (id: string) => void;
  onCompare?: (s: Session) => void;
}) {
  const s = session;
  const f = s ? featuredOf(s) : null;
  const online = s?.mode === "online";
  const pt = s ? venuePoint(s.venues, (s as { room?: string | null }).room) : null;
  const hasMap = !!pt;
  const day = s ? dateParts(s.starts_at) : { wd: "", d: "", m: "" };
  const ev = s ? { id: s.id, title: s.title, starts_at: s.starts_at, ends_at: s.ends_at, location: `${placeOf(s)}, Shillong`, url: `https://paniim.planos.in/session/${s.id}` } : null!;
  return (
    <Drawer open={!!s} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[88dvh]">
        {s ? (
          <div className="overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* Stub head: date tile + what, like the torn-off top of a ticket. */}
            <div className="stub-in pass overflow-hidden">
              <div className="flex items-stretch bg-primary text-primary-foreground">
                <div className="flex w-[4.6rem] shrink-0 flex-col items-center justify-center py-3 tabular-nums">
                  <span className="text-[0.6rem] font-bold opacity-80">{day.wd}</span>
                  <span className="text-display text-[1.9rem] leading-none">{day.d}</span>
                  <span className="text-[0.6rem] font-bold opacity-80">{day.m}</span>
                </div>
                <span aria-hidden className="seam self-stretch opacity-60" />
                <div className="min-w-0 flex-1 px-4 py-3">
                  <p className="text-[0.62rem] font-bold opacity-85">
                    {presenting ? "Your presentation" : TYPE_LABEL[s.session_type] ?? s.session_type}
                    {s.session_type === "paper" ? `, ${online ? "Online" : "In person"}` : ""}
                  </p>
                  <DrawerTitle className="text-display mt-1 text-[1.3rem] leading-tight">{f ? f.headline : s.title}</DrawerTitle>
                  {f && f.headline !== f.label ? <p className="mt-0.5 text-xs font-semibold opacity-85">{f.label}</p> : null}
                  {s.area && s.area !== s.title ? <p className="mt-1 text-xs opacity-85">{s.area}</p> : null}
                </div>
              </div>
              {/* Venue plate */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  {online ? <Monitor className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                </span>
                <DrawerDescription asChild>
                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-tight font-semibold text-foreground">{placeOf(s)}</p>
                    <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{rangeLabel(s.starts_at, s.ends_at)}</p>
                  </div>
                </DrawerDescription>
                {online ? null : (
                  <Act href={hasMap ? directionsUrl(pt!.lat, pt!.lng, pt!.label) : undefined} to={hasMap ? undefined : "/campus"} className="shrink-0 bg-secondary px-3 text-secondary-foreground">
                    <Navigation className="h-3.5 w-3.5" /> {hasMap ? "Directions" : "Map"}
                  </Act>
                )}
              </div>
              {online ? <p className="border-t border-dashed border-seam px-4 py-2.5 text-xs text-muted-foreground">The join link comes by email.</p> : null}
            </div>
            {f ? <FeaturedGuests f={f} className="stub-in mt-3" /> : null}
            {s.status_note ? <p className="mt-2 rounded-md bg-warn/25 px-3 py-2 text-xs font-semibold">{s.status_note}</p> : null}

            <motion.button
              type="button"
              onClick={() => !presenting && onToggleAgenda(s.id)}
              disabled={presenting}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className={cn(
                "relative mt-3 flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg text-sm font-semibold transition-colors duration-200",
                inAgenda || presenting ? "border border-primary/40 bg-primary/10 text-primary" : "bg-primary text-primary-foreground shadow-[var(--shadow-card)]",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={inAgenda || presenting ? "in" : "out"}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2"
                >
                  {inAgenda || presenting ? <Check className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                  {presenting ? "In My Plan, you present here" : inAgenda ? "Saved to My Plan" : "Save to My Plan"}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            <p className="mt-4 text-[0.62rem] font-bold text-muted-foreground">Add to your calendar</p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <Act href={googleEventUrl(ev)} className="flex-col gap-1 border border-border bg-card py-2.5"><GoogleCalendarLogo className="h-6 w-6" /><span className="text-[0.68rem]">Google</span></Act>
              <Act onClick={() => downloadIcs(ev)} className="flex-col gap-1 border border-border bg-card py-2.5"><AppleCalendarLogo className="h-6 w-6" /><span className="text-[0.68rem]">Apple</span></Act>
              <Act href={outlookEventUrl(ev)} className="flex-col gap-1 border border-border bg-card py-2.5"><OutlookLogo className="h-6 w-6" /><span className="text-[0.68rem]">Outlook</span></Act>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2">
              {onCompare && s.session_type === "paper" ? (
                <Act onClick={() => onCompare(s)} className="border border-border bg-card"><Columns3 className="h-3.5 w-3.5" /> Parallel sessions</Act>
              ) : (
                <Link to="/session/$sessionId" params={{ sessionId: s.id }} className="press flex min-h-11 items-center justify-center rounded-lg border border-border text-xs font-semibold">
                  Full page
                </Link>
              )}
            </div>

            {s.papers?.length ? (
              <section className="mt-5">
                <h4 className="flex items-center gap-1.5 text-[0.62rem] font-bold text-muted-foreground">
                  <Presentation className="h-3.5 w-3.5" /> {s.papers.length} papers, in order
                </h4>
                <ol className="mt-2 divide-y divide-border">
                  {s.papers.map((p, i) => {
                    const mine = !!p.code && myCodes.has(p.code);
                    return (
                      <li key={p.id} className={cn("flex gap-3 py-2.5", mine && "-mx-2 rounded-md bg-primary/10 px-2")}>
                        <span className="w-5 shrink-0 pt-0.5 text-right text-xs font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block text-sm leading-snug font-medium">{p.title}</span>
                          <AuthorLine compact className="mt-1" authors={p.authorList ?? []} presenter={p.presenter} submissionId={p.id} />
                          <span className="mt-1.5 flex items-center gap-2">
                            {p.code ? <span className="text-[0.62rem] text-muted-foreground tabular-nums">MS #{p.code}</span> : null}
                            <CiteButton authors={p.authorList ?? []} title={p.title} code={p.code} />
                            {mine ? <span className="text-[0.62rem] font-bold text-primary">Your paper</span> : null}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : s.summary && s.session_type !== "paper" && !f ? (
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
            ) : null}
            {s.session_code ? <p className="mt-4 text-[0.62rem] text-muted-foreground">Session {s.session_code}</p> : null}
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function dateParts(iso: string) {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-IN", { ...o, timeZone: "Asia/Kolkata" });
  return { wd: f({ weekday: "short" }), d: f({ day: "numeric" }), m: f({ month: "short" }) };
}

function downloadIcs(e: IcsEvent) {
  const blob = new Blob([buildIcs([e], { name: e.title })], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "session.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Springy action button; renders a link, an internal link or a button. */
function Act({ href, to, onClick, className, children }: { href?: string | undefined; to?: "/campus" | undefined; onClick?: () => void; className?: string; children: React.ReactNode }) {
  const cls = cn("flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold", className);
  const motionProps = { whileHover: { y: -1 }, whileTap: { scale: 0.95 }, transition: { type: "spring" as const, stiffness: 500, damping: 24 } };
  if (to) return <motion.div {...motionProps} className="contents"><Link to={to} className={cls}>{children}</Link></motion.div>;
  if (href) return <motion.a {...motionProps} href={href} target="_blank" rel="noreferrer" className={cls}>{children}</motion.a>;
  return <motion.button {...motionProps} type="button" onClick={onClick} className={cls}>{children}</motion.button>;
}
