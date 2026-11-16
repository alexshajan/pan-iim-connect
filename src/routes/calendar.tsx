import { CalendarSync } from "@/components/schedule/CalendarSync";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ChevronRight, Coffee, FileDown, MapPin, Presentation, Search, X } from "lucide-react";
import { EventDrawer } from "@/components/schedule/EventDrawer";
import { AppShell, EmptyNote } from "@/components/AppShell";
import { UrgentBanner } from "@/components/UrgentBanner";
import { CardSkeleton } from "@/components/PageSkeleton";
import { SlotSheet } from "@/components/schedule/SlotSheet";
import { placeOf, sessionsQuery, trackAccentClass, type Session } from "@/lib/conference";
import { dayKey, isLive, timeOf } from "@/lib/format";
import { conferenceDays, findClashes, overlaps, searchSchedule } from "@/lib/schedule";
import { buildDayStream, nowIndex, onlyMine, type StreamRow } from "@/lib/calendar";
import { myAgendaItems, type AgendaReason } from "@/lib/my-agenda";
import { myPersonQuery } from "@/lib/registry-data";
import { useAuth } from "@/hooks/useAuth";
import { useBookmarks } from "@/hooks/useBookmarks";
import { cn } from "@/lib/utils";
import { featuredOf } from "@/lib/featured";
import { Lozenge } from "@/components/brand/Loom";
import { StarToggle } from "@/components/schedule/StarToggle";

type CalSearch = { day?: string | undefined; mine?: boolean | undefined; mode?: "in_person" | "online" | undefined; area?: string | undefined };

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar, 11th Pan-IIM WMC 2026" },
      {
        name: "description",
        content:
          "The three-day programme for 27–29 November at IIM Shillong: keynotes, panels and parallel paper rooms in one scrollable day.",
      },
      { property: "og:title", content: "Calendar, 11th Pan-IIM WMC 2026" },
      { property: "og:description", content: "Every session by day, with your own picks and paper slots marked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): CalSearch => ({
    day: typeof raw["day"] === "string" ? (raw["day"] as string) : undefined,
    mine: raw["mine"] === true || raw["mine"] === "true" ? true : undefined,
    mode: raw["mode"] === "in_person" || raw["mode"] === "online" ? (raw["mode"] as "in_person" | "online") : undefined,
    area: typeof raw["area"] === "string" && raw["area"] ? (raw["area"] as string) : undefined,
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(sessionsQuery);
  },
  component: CalendarPage,
});

const REASON_LABEL: Partial<Record<AgendaReason, string>> = {
  presenting: "You present",
  "co-author": "Your paper",
  chair: "You chair",
};

function CalendarPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { user, loading: authLoading } = useAuth();
  const { starred, toggle } = useBookmarks(user?.id ?? null);
  const sessions = useQuery(sessionsQuery);
  const me = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (next: CalSearch) => navigate({ search: (p) => ({ ...p, ...next }), replace: true });

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [slotFocus, setSlotFocus] = useState<Session | null>(null);
  const [openEvent, setOpenEvent] = useState<Session | null>(null);

  const all = useMemo(() => sessions.data ?? [], [sessions.data]);
  const days = useMemo(() => conferenceDays(all), [all]);
  const todayKey = dayKey(now.toISOString());
  const activeDay = search.day ?? days.find((d) => d.key === todayKey)?.key ?? days[0]?.key ?? null;

  // Why each session is "mine": my paper, chairing, or starred.
  const reasons = useMemo(() => {
    const items = myAgendaItems(all, {
      fullName: me.data?.person.full_name ?? null,
      subs: (me.data?.subs ?? []).map((x) => ({ role: x.role, session_id: x.submissions?.session_id ?? null })),
      starred,
    });
    const m = new Map<string, AgendaReason>();
    for (const i of items) if (i.reason !== "common" && !m.has(i.session.id)) m.set(i.session.id, i.reason);
    return m;
  }, [all, me.data, starred]);
  const mineSet = useMemo(() => new Set(reasons.keys()), [reasons]);
  const myCodes = useMemo(
    () => new Set((me.data?.subs ?? []).map((x) => x.submissions?.submission_code).filter((c): c is string => !!c)),
    [me.data],
  );
  const paperIds = useMemo(
    () => new Set([...reasons].filter(([, r]) => r === "presenting" || r === "co-author").map(([id]) => id)),
    [reasons],
  );
  const myPapers = useMemo(() => all.filter((s) => paperIds.has(s.id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [all, paperIds]);
  const goToMySlot = () => {
    const s = myPapers[0];
    if (!s) return;
    setSearch({ day: dayKey(s.starts_at), mine: undefined });
    setOpenEvent(s);
  };

  // Arriving from the slot email (?mine=true): open the presenter's slot straight away, once.
  const slotOpened = useRef(false);
  useEffect(() => {
    if (slotOpened.current || !search.mine || !myPapers[0]) return;
    slotOpened.current = true;
    const s = myPapers[0];
    setSearch({ day: dayKey(s.starts_at), mine: true });
    setOpenEvent(s);
  }, [search.mine, myPapers]);

  const rows = useMemo(() => {
    const day = all.filter(
      (s) =>
        dayKey(s.starts_at) === activeDay &&
        (!s.mode || !search.mode || (search.mode === "online" ? s.mode === "online" : s.mode !== "online")) &&
        (!s.area || !search.area || s.area === search.area),
    );
    const stream = buildDayStream(day, mineSet);
    return search.mine ? onlyMine(stream, mineSet) : stream;
  }, [all, activeDay, mineSet, search.mine, search.mode, search.area]);
  const areas = useMemo(() => [...new Set(all.map((s) => s.area).filter((a): a is string => !!a))].sort(), [all]);

  const clashes = useMemo(() => findClashes(all, starred), [all, starred]);
  const results = useMemo(() => searchSchedule(all, query), [all, query]);
  const searching = query.trim().length >= 2;
  const isToday = activeDay === todayKey;
  const nowAt = isToday ? nowIndex(rows, now) : -1;

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const jumpToNow = () => rowRefs.current[nowAt]?.scrollIntoView({ behavior: "smooth", block: "center" });
  const autoJumped = useRef(false);
  useEffect(() => {
    if (autoJumped.current || nowAt < 1) return;
    autoJumped.current = true;
    rowRefs.current[nowAt]?.scrollIntoView({ block: "center" });
  }, [nowAt]);

  const slotSessions = useMemo(
    () =>
      slotFocus
        ? all.filter((s) => (slotFocus.slot_code ? s.slot_code === slotFocus.slot_code : overlaps(s, slotFocus))).sort((a, b) => (a.venues?.sort_order ?? 99) - (b.venues?.sort_order ?? 99))
        : [],
    [all, slotFocus],
  );

  if (!user) {
    return (
      <AppShell eyebrow="27–29 November, IIM Shillong" title="Calendar">
        {authLoading ? (
          <div className="card-flat h-40 animate-pulse" />
        ) : (
          <div className="card-surface px-5 py-6">
            <p className="text-display text-lg">Sign in to see the programme</p>
            <p className="mt-1 text-sm text-muted-foreground">Use the email you registered with. Your paper slot shows up first, then every session across the three days.</p>
            <Link
              to="/auth"
              onClick={() => sessionStorage.setItem("after_auth", window.location.pathname + window.location.search)}
              className="tap btn-sheen mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="27–29 November, IIM Shillong" title="Calendar">
      <UrgentBanner />

      {/* One sticky control bar: days, then plan/search */}
      <div className="sticky top-0 z-20 -mx-5 mb-4 bg-background/90 px-5 pt-2 pb-3 backdrop-blur-md">
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Conference day">
          {days.map((d, i) => {
            const date = new Date(d.iso);
            const active = d.key === activeDay;
            return (
              <button
                key={d.key}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setSearch({ day: d.key })}
                className={cn(
                  "press relative flex min-h-12 flex-col items-center justify-center rounded-lg border px-2 py-2 transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                )}
              >
                <span className={cn("text-[0.62rem] font-semibold tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>
                  Day {i + 1}, {date.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}
                </span>
                <span className="text-display text-lg leading-tight">
                  {date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                </span>
                {d.key === todayKey ? <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-live" aria-label="Today" /> : null}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="card-flat flex flex-1 p-1" role="group" aria-label="What to show">
            <button
              type="button"
              onClick={() => setSearch({ mine: undefined })}
              className={cn("min-h-10 flex-1 rounded-full text-xs font-semibold", !search.mine ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
            >
              Everything
            </button>
            <button
              type="button"
              onClick={() => setSearch({ mine: true })}
              className={cn("min-h-10 flex-1 rounded-full text-xs font-semibold", search.mine ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
            >
              My plan{mineSet.size ? `, ${mineSet.size}` : ""}
            </button>
          </div>
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Search papers and authors"}
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setQuery("");
            }}
            className="tap grid h-12 w-12 place-items-center rounded-full border border-border bg-card"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="card-flat flex p-1" role="group" aria-label="Format">
            {([[undefined, "All"], ["in_person", "In person"], ["online", "Online"]] as const).map(([v, l]) => (
              <button
                key={l}
                type="button"
                aria-pressed={search.mode === v}
                onClick={() => setSearch({ mode: v })}
                className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", search.mode === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Track</span>
            <select
              value={search.area ?? ""}
              onChange={(e) => setSearch({ area: e.target.value || undefined })}
              className={cn("min-h-11 w-full truncate rounded-full border bg-card px-3.5 text-xs font-semibold", search.area ? "border-primary text-primary" : "border-border")}
            >
              <option value="">All tracks</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>
        {searchOpen ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paper title, author or institution"
            className="card-surface mt-2.5 w-full px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        ) : null}
        <div className="mt-2 flex items-center gap-2">
          {myPapers.length ? (
            <button type="button" onClick={goToMySlot} className="press inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground">
              <Presentation className="h-3.5 w-3.5" /> {myPapers.length > 1 ? `My ${myPapers.length} presentations` : "My presentation slot"}
            </button>
          ) : null}
          <span className="ml-auto" />
          <CalendarSync userId={user?.id ?? null} />
          <a href="/programme" className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold">
            <FileDown className="h-3.5 w-3.5" /> View as PDF
          </a>
        </div>
      </div>

      {clashes.length && !searching ? (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-warn/25 px-4 py-2.5 text-xs font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {clashes.length} of your picks overlap. Look for the amber rows.
        </p>
      ) : null}

      {sessions.isError ? (
        <div className="card-flat px-5 py-7 text-center text-sm">
          <p>The programme didn&apos;t load. Check your connection.</p>
          <button type="button" onClick={() => sessions.refetch()} className="tap mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Try again
          </button>
        </div>
      ) : sessions.isPending ? (
        <CardSkeleton rows={5} />
      ) : searching ? (
        <SearchResults results={results} onOpen={setOpenEvent} />
      ) : !rows.length ? (
        <EmptyNote>
          {search.mine
            ? "Nothing in your plan for this day. Star a session in Everything to add it."
            : "Nothing scheduled for this day yet."}
        </EmptyNote>
      ) : (
        <ol className="relative space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.slot.startIso + i}>
              <div ref={(el) => { rowRefs.current[i] = el; }} className="scroll-mt-40">
                <Row
                  row={r}
                  now={now}
                  isNow={i === nowAt}
                  reasons={reasons}
                  starred={starred}
                  onStar={toggle}
                  onOpenSlot={setSlotFocus}
                  onOpen={setOpenEvent}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {isToday && nowAt > 0 && !searching ? (
        <button
          type="button"
          onClick={jumpToNow}
          className="press fixed right-5 bottom-28 z-30 inline-flex items-center gap-1.5 rounded-full bg-live px-4 py-2.5 text-xs font-semibold text-live-foreground shadow-lg"
        >
          <ArrowDown className="h-3.5 w-3.5" /> Now
        </button>
      ) : null}

      <SlotSheet
        open={!!slotFocus}
        onOpenChange={(v) => !v && setSlotFocus(null)}
        slotSessions={slotSessions}
        focusId={slotFocus?.id ?? null}
        starred={starred}
        onToggleStar={toggle}
        onOpen={setOpenEvent}
        mineIds={paperIds}
      />
      <EventDrawer
        session={openEvent}
        onClose={() => setOpenEvent(null)}
        inAgenda={!!openEvent && starred.includes(openEvent.id)}
        presenting={!!openEvent && paperIds.has(openEvent.id)}
        myCodes={myCodes}
        onToggleAgenda={toggle}
        onCompare={(s) => { setOpenEvent(null); setSlotFocus(s); }}
      />
    </AppShell>
  );
}

/** Marks sessions the organizers moved or rescheduled. */
function MovedMark({ s, onDark = false }: { s: Session; onDark?: boolean }) {
  const moved = s.status === "moved" || s.status === "delayed" || !!s.moved_at;
  if (!moved || s.status === "cancelled") return null;
  const label = s.status === "delayed" ? "Delayed" : "Moved";
  return (
    <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold", onDark ? "bg-primary-foreground/20" : "bg-warn/30 text-warn-foreground")}>
      <AlertTriangle className="h-3 w-3" /> {label}
      {s.moved_at ? `, updated ${new Date(s.moved_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : ""}
    </span>
  );
}

function TimeRail({ start, end, isNow, compact = false }: { start: string; end: string; isNow: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex w-[3.9rem] shrink-0 flex-col items-end whitespace-nowrap text-right", !compact && "pt-0.5")}>
      <span className={cn("text-[0.78rem] font-bold tabular-nums", isNow && "text-live")}>{timeOf(start)}</span>
      {compact ? null : <span className="text-[0.62rem] text-muted-foreground tabular-nums">{timeOf(end)}</span>}
      {isNow ? <span className="mt-1 rounded-full bg-live px-1.5 py-0.5 text-[0.55rem] font-bold text-live-foreground">Now</span> : null}
    </div>
  );
}

function Row({
  row,
  now,
  isNow,
  reasons,
  starred,
  onStar,
  onOpenSlot,
  onOpen,
}: {
  row: StreamRow;
  now: Date;
  isNow: boolean;
  reasons: Map<string, AgendaReason>;
  starred: string[];
  onStar: (id: string) => void;
  onOpenSlot: (s: Session) => void;
  onOpen: (s: Session) => void;
}) {
  const first = row.slot.sessions[0]!;
  const end = row.slot.sessions.reduce((m, s) => (s.ends_at > m ? s.ends_at : m), first.ends_at);

  if (row.kind === "pause") {
    return (
      <div className="flex items-center gap-2.5 py-0.5">
        <TimeRail start={first.starts_at} end={end} isNow={isNow} compact />
        <div className="flex flex-1 items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
          <Coffee className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium">{row.session.title}</span>
          {row.session.venues ? <span className="shrink-0">,  {placeOf(row.session)}</span> : null}
          <span aria-hidden className="ml-1 h-px min-w-6 flex-1 bg-border" /><Lozenge className="opacity-70" />
        </div>
      </div>
    );
  }

  if (row.kind === "common") {
    const s = row.session;
    const reason = reasons.get(s.id);
    const live = s.status !== "cancelled" && isLive(s.starts_at, s.ends_at, now);
    const f = featuredOf(s);
    const role = f?.kind === "keynote" ? f.guests[0]?.role : f?.guests.length ? `${f.guests.length} guests` : null;
    return (
      <div className="flex gap-2.5">
        <TimeRail start={s.starts_at} end={s.ends_at} isNow={isNow} />
        <div className={cn("stub-card group pass relative flex min-w-0 flex-1 items-stretch overflow-hidden", f?.kind === "keynote" && "stub-keynote", live && "ring-1 ring-live/50", starred.includes(s.id) && "stub-card-kept")}>
          <span aria-hidden className={cn("w-1 shrink-0", f?.kind === "keynote" ? "bg-loom-gold" : f ? "bg-plate" : trackAccentClass[s.tracks?.accent ?? ""] ?? "bg-primary/70")} />
          <button type="button" onClick={() => onOpen(s)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
            <p className="text-[0.58rem] font-bold text-primary">
              {f ? f.label : REASON_LABEL[reason ?? "common"] ?? s.session_type}
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h3 className={cn("text-display min-w-0 text-[0.98rem] leading-snug", s.status === "cancelled" && "line-through opacity-60")}>{f ? f.headline : s.title}</h3>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3 w-3" /> {placeOf(s)}
              </span>
            </div>
            {role ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{role}</p> : null}
            {s.status_note ? <p className="mt-1 text-xs font-semibold text-warn-foreground">{s.status_note}</p> : null}
            <MovedMark s={s} />
          </button>
          <span aria-hidden className="seam my-0 self-stretch" />
          <div className="grid w-12 shrink-0 place-items-center">
            <StarToggle on={starred.includes(s.id)} onClick={() => onStar(s.id)} size="sm" />
          </div>
        </div>
      </div>
    );
  }

  // Parallel rooms: show my pick(s) up front, the rest one tap away.
  const others = row.slot.sessions.length - row.picks.length;
  return (
    <div className="flex gap-2.5">
      <TimeRail start={first.starts_at} end={end} isNow={isNow} />
      <div className={cn("stub-card pass min-w-0 flex-1 overflow-hidden", row.clash && "ring-2 ring-warn")}>
        <p className="flex items-center justify-between px-3.5 pt-2.5 text-[0.58rem] font-bold text-muted-foreground">
          <span>{row.slot.sessions.length} parallel sessions</span>
          {row.clash ? <span className="flex items-center gap-1 text-warn-foreground"><AlertTriangle className="h-3 w-3" /> Clash</span> : null}
        </p>
        {row.picks.length ? (
          <div className="divide-y divide-border">
            {row.picks.map((s) => {
              const r = reasons.get(s.id);
              const paper = r === "presenting" || r === "co-author";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpen(s)}
                  className={cn("press flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left", paper && "bg-primary text-primary-foreground")}
                >
                  {paper ? <Presentation className="mt-0.5 h-4 w-4 shrink-0" /> : <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", trackAccentClass[s.tracks?.accent ?? ""] ?? "bg-primary")} />}
                  <span className="min-w-0 flex-1">
                    {paper ? <span className="block text-[0.6rem] font-bold opacity-85">{REASON_LABEL[r!]}</span> : null}
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <span className="min-w-0 text-[0.95rem] leading-snug font-semibold">{featuredOf(s) ? `${featuredOf(s)!.label}: ${featuredOf(s)!.headline}` : s.title}</span>
                      <span className={cn("ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium", paper ? "opacity-85" : "text-muted-foreground")}>
                        <MapPin className="h-3 w-3" /> {placeOf(s)}
                      </span>
                    </span>
                    {!paper ? <span className="mt-0.5 block text-[0.65rem] font-semibold text-primary">{REASON_LABEL[r ?? "starred"] ?? "Your pick"}</span> : null}
                    <MovedMark s={s} onDark={paper} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-3.5 pt-1">
            <p className="text-sm font-semibold">Choose a room for this slot</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {row.slot.sessions.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onOpenSlot(s)} className="press inline-flex max-w-[11rem] items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[0.7rem] font-medium text-secondary-foreground">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", trackAccentClass[s.tracks?.accent ?? ""] ?? "bg-primary")} />
                    <span className="truncate">{s.area ?? s.tracks?.name ?? s.title}</span>
                  </button>
                </li>
              ))}
              {row.slot.sessions.length > 6 ? <li className="self-center text-[0.7rem] text-muted-foreground">+{row.slot.sessions.length - 6} more</li> : null}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => onOpenSlot(row.picks[0] ?? first)}
          className="tap flex w-full items-center justify-between border-t border-border px-3.5 py-2.5 text-xs font-semibold text-primary"
        >
          {row.picks.length ? (row.clash ? "Compare and keep one" : `See the other ${others} sessions`) : `Browse all ${row.slot.sessions.length} sessions`}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


function SearchResults({ results, onOpen }: { results: ReturnType<typeof searchSchedule>; onOpen: (s: Session) => void }) {
  if (!results.sessions.length && !results.papers.length) {
    return <EmptyNote>Nothing matched. Try an author surname or a keyword.</EmptyNote>;
  }
  return (
    <div className="space-y-2">
      {results.sessions.map((s) => (
        <button key={s.id} type="button" onClick={() => onOpen(s)} className="card-surface tap block w-full px-4 py-3 text-left">
          <p className="text-[0.9rem] font-semibold leading-snug">{s.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{timeOf(s.starts_at)}, {placeOf(s)}</p>
        </button>
      ))}
      {results.papers.slice(0, 30).map((p) => (
        <button key={p.paperId} type="button" onClick={() => onOpen(p.session)} className="card-surface tap block w-full px-4 py-3 text-left">
          <p className="text-[0.88rem] leading-snug font-semibold">{p.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.authors}{p.affiliation ? `, ${p.affiliation}` : ""}</p>
          <p className="mt-1.5 text-[0.68rem] font-semibold text-primary">{p.session.title}, {timeOf(p.session.starts_at)}</p>
        </button>
      ))}
    </div>
  );
}
