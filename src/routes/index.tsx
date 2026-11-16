import { BrandBar } from "@/components/brand/Loom";
import { alertsFor } from "@/lib/alerts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, QrCode, Users, Utensils } from "lucide-react";
import { AppShell, DesktopNav, SectionHeading } from "@/components/AppShell";
import { HomeTiles } from "@/components/home/HomeTiles";
import { announcementsQuery, sessionsQuery, type Session } from "@/lib/conference";
import { isLive, rangeLabel, relativeToNow } from "@/lib/format";
import { campusServicesQuery, currentOrNextMeal, messMealsQuery } from "@/lib/campus";
import { useAuth } from "@/hooks/useAuth";
import { phaseAt } from "@/lib/phase";
import { myPersonQuery } from "@/lib/registry-data";
import { connectionsQuery } from "@/components/me/MetPeople";
import { useBookmarks } from "@/hooks/useBookmarks";
import { WoodClock, WeatherStation } from "@/components/home/Instruments";
import { DelegatePass } from "@/components/me/DelegatePass";
import { LiveRooms } from "@/components/home/LiveRooms";
import { directoryPeopleQuery } from "@/lib/network-data";
import { suggest } from "@/lib/network";
import { useModules } from "@/hooks/useModules";
import { MyDetails } from "@/components/me/MyDetails";
import { HelpDesk } from "@/components/me/HelpDesk";
import { HomeNudges } from "@/components/home/HomeNudges";
import { UpdatesBell, openUpdates, useUnread } from "@/components/NotificationCenter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "11th Pan-IIM WMC 2026, IIM Shillong" },
      {
        name: "description",
        content:
          "Live schedule, paper sessions, campus navigation, networking and travel guidance for delegates at the 11th Pan-IIM WMC, IIM Shillong.",
      },
      { property: "og:title", content: "11th Pan-IIM WMC 2026, IIM Shillong" },
      { property: "og:description", content: "What's on now, what's next, and who to meet on campus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { user } = useAuth();
  const mods = useModules();
  const phase = phaseAt(now);
  const me = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });
  const { starred } = useBookmarks(user?.id ?? null);
  const sessions = useQuery(sessionsQuery);
  const announcements = useQuery(announcementsQuery);
  const met = useQuery({ ...connectionsQuery, enabled: !!user });

  const all = sessions.data ?? [];
  const paperIds = (me.data?.subs ?? []).map((x) => x.submissions?.session_id).filter(Boolean) as string[];
  const mine = [...paperIds, ...starred];
  const live = all.filter((s) => s.status !== "cancelled" && isLive(s.starts_at, s.ends_at, now));
  const notices = alertsFor(announcements.data ?? [], { presenter: paperIds.length > 0, sessionIds: mine });
  const urgent = notices.find((a) => a.urgent);
  const { unread } = useUnread();

  const person = me.data?.person;
  const roles = [...(person?.person_roles ?? []).map((r) => r.role), ...(me.data?.subs ?? []).map((x) => x.role)];
  const hero = (
    <div>
      <BrandBar right={<><DesktopNav />{mods.updates ? <UpdatesBell /> : null}</>} />
      <div className="mx-auto max-w-2xl px-5 pt-4 lg:max-w-5xl">
        <div className={person && mods.idcard ? "lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6" : "mx-auto max-w-2xl"}>
          <div className="space-y-3">
            {user && person ? <MyDetails userId={user.id} /> : null}
            {me.data?.subs.length ? <MyPapers subs={me.data.subs} sessions={all} /> : null}
            <div className="grid grid-cols-2 items-stretch gap-2 pt-2">
              {phase === "before" ? <WoodClock /> : null}
              <WeatherStation />
            </div>
          </div>
          {person && mods.idcard ? (
            <div className="rise mt-3 lg:mt-0 lg:sticky lg:top-20">
              <DelegatePass name={person.full_name} organization={person.organization} code={person.delegate_code} roles={roles} test={person.is_placeholder} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell hero={hero} wide>
      <div>
      {/* A, Act now */}
      <div className="space-y-3">
        {urgent ? (
          <button type="button" onClick={openUpdates} className="rise flex w-full items-start gap-3 rounded-[var(--radius)] bg-warn/25 px-5 py-4 text-left">
            <Bell className="mt-0.5 h-4 w-4 text-warn-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{urgent.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{urgent.body}</span>
            </span>
          </button>
        ) : null}
        <HomeNudges
          userId={user?.id ?? null}
          lead={mods.updates ? unread.filter((a) => a !== urgent && notices.includes(a)).slice(0, 3).map((u) => (
            <button key={u.id} type="button" onClick={openUpdates} className="card-flat tap flex h-full w-full items-center gap-3 px-4 py-3 text-left">
              <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{u.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.body}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )) : []}
        />
        {user && phase !== "after" ? <MyNext now={now} sessions={all} paperSessionIds={paperIds} starred={starred} /> : null}
        {!user ? (
          <Link to="/auth" className="card-surface tap flex items-center gap-3 px-5 py-4">
            <QrCode className="h-4 w-4 text-primary" />
            <span className="flex-1 text-sm"><b>Claim your pass.</b> Sign in for your papers, sessions and pass.</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ) : null}
      </div>

      <div>
      {/* B, Right now / Get ready */}
      {phase === "live" ? (
        <>
          <SectionHeading title={live.length ? `Happening now in ${live.length} rooms` : "Happening now"} action={<Link to="/calendar" className="text-xs font-semibold text-primary">Calendar</Link>} />
          {live.length ? <LiveRooms live={live} /> : <p className="text-sm text-muted-foreground">Between sessions. Your next one is above.</p>}
        </>
      ) : null}
      {phase === "before" ? (
        <>
          <SectionHeading title="Get ready" />
          <HomeTiles tiles={[
            mods.guide ? { to: "/guide/arrival", title: "Plan your trip", kind: "trip" } : { to: "/calendar", title: "Schedule", kind: "calendar" },
            { to: "/me", title: "Your profile", kind: "pass" },
            ...(mods.papers ? [{ to: "/papers", title: "Browse papers", kind: "papers" as const }] : []),
            { to: "/stays", title: "Book a hotel", kind: "key" },
          ]} />
        </>
      ) : null}
      </div>
      </div>

      {/* C, Meet */}
      {phase !== "after" && mods.network ? <MeetCard signedIn={!!user} myCode={me.data?.person.delegate_code} keywords={(me.data?.person as { keywords?: string[] } | undefined)?.keywords ?? []} tracks={(me.data?.subs ?? []).map((s) => s.submissions?.track).filter(Boolean) as string[]} /> : null}
      {phase === "after" && user ? (
        <Link to="/me" className="card-surface tap mt-4 flex items-center gap-3 px-5 py-4">
          <Users className="h-4 w-4 text-primary" />
          <span className="flex-1 text-sm">
            {met.data?.length ? <>You met <b>{met.data.length}</b> people. Save their contacts.</> : "Review the people you met."}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      ) : null}

      {/* D, On campus */}
      {phase !== "after" && mods.meals ? (
        <>
          <SectionHeading title="On campus" action={mods.campus ? <Link to="/campus" className="text-xs font-semibold text-primary">Map</Link> : undefined} />
          <MealStrip now={now} />
          {phase === "live" ? <ServiceStrip /> : null}
        </>
      ) : null}

      {user ? (
        <>
          <SectionHeading title="Help desk" />
          <HelpDesk userId={user.id} />
        </>
      ) : null}


    </AppShell>
  );
}

type MySub = { role: string; submissions: { submission_code: string; title: string | null; track: string | null; session_id: string | null; presentation_mode?: string | null } | null };

function MyPapers({ subs, sessions }: { subs: MySub[]; sessions: Session[] }) {
  const rows = subs.filter((s) => s.submissions);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <section className="card-surface rise overflow-hidden" aria-label="Your presentation">
      <div className="bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        {rows.length > 1 ? `Your ${rows.length} papers` : "Your presentation"}
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const p = r.submissions!;
          const s = sessions.find((x) => x.id === p.session_id) as (Session & { room?: string | null; session_code?: string | null; venues?: { name: string; short_name: string | null } | null }) | undefined;
          const where = s ? [s.venues?.short_name ?? s.venues?.name, s.room].filter(Boolean).join(", ") : "";
          return (
            <li key={p.submission_code}>
              <Link to="/calendar" className="tap block px-5 py-3.5">
                {p.presentation_mode ? (
                  <span className={`mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${p.presentation_mode === "online" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {p.presentation_mode === "online" ? "Presenting online" : "Presenting on campus"}
                  </span>
                ) : null}
                <span className="block text-[0.95rem] font-semibold leading-snug">{p.title ?? p.submission_code}</span>
                {s ? (
                  <span className="mt-1 block text-sm tabular-nums">
                    {fmt(s.starts_at)}{where ? <span className="text-muted-foreground">, {where}</span> : null}
                  </span>
                ) : (
                  <span className="mt-1 block text-sm text-muted-foreground">Slot not assigned yet</span>
                )}
                <span className="mt-0.5 block text-xs text-muted-foreground">Paper {p.submission_code}{s?.session_code ? `, session ${s.session_code}` : ""}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MeetCard({ signedIn, myCode, keywords, tracks }: { signedIn: boolean; myCode?: string | undefined; keywords: string[]; tracks: string[] }) {
  const dir = useQuery({ ...directoryPeopleQuery, enabled: signedIn });
  const list = dir.data ?? [];
  const picks = myCode ? suggest({ code: myCode, keywords, tracks }, list, 4) : [];
  return (
    <>
      <SectionHeading title="Meet" action={<Link to="/network" className="text-xs font-semibold text-primary">Network</Link>} />
      <Link to="/network" className="index-card tap rise block px-5 py-4">
        <p className="text-display text-[1.05rem] leading-snug">
          {!signedIn ? "Find the people working on your topic" : picks.length ? `${picks.length} people share your interests` : `${list.length} delegates in the directory`}
        </p>
        <div className="mt-3 flex -space-x-2">
          {(picks.length ? picks.map((x) => x.p) : list.slice(0, 5)).map((p) => (
            <span key={p.code} className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-secondary text-[0.62rem] font-bold text-primary">
              {p.full_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{signedIn ? "Add your research keywords in Me for better matches." : "Sign in to browse consenting delegates."}</p>
      </Link>
    </>
  );
}

function MyNext({ now, sessions, paperSessionIds, starred }: { now: Date; sessions: Session[]; paperSessionIds: string[]; starred: string[] }) {
  const t = now.getTime();
  const upcoming = sessions.filter((s) => new Date(s.ends_at).getTime() > t);
  const mine = upcoming.find((s) => paperSessionIds.includes(s.id) && new Date(s.starts_at).getTime() - t < 2 * 3600_000);
  const next = mine ?? upcoming.find((s) => starred.includes(s.id));
  if (!next) return null;
  const soon = new Date(next.starts_at).getTime() - t < 15 * 60_000;
  return (
    <Link to="/session/$sessionId" params={{ sessionId: next.id }} className={`pass tap rise block overflow-hidden ${soon ? "nudge-once" : ""}`}>
      <div className={`px-5 py-2 text-[0.66rem] font-bold ${mine || soon ? "bg-warn/40 text-warn-foreground" : "bg-primary text-primary-foreground"}`}>
        {mine ? "You're presenting" : "Your next session"}, {relativeToNow(next.starts_at, now)}
      </div>
      <div className="px-5 py-4">
        <p className="text-display text-[1.1rem] leading-snug">{next.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{rangeLabel(next.starts_at, next.ends_at)}, {next.venues?.name ?? "Venue awaited"}</p>
      </div>
    </Link>
  );
}

function MealStrip({ now }: { now: Date }) {
  const meals = useQuery(messMealsQuery);
  const next = currentOrNextMeal(meals.data ?? [], now);
  if (!next) return null;
  const { meal, serving } = next;
  return (
    <Link to="/campus" className="card-surface tap rise flex items-start gap-3 px-5 py-4">
      <span className="mt-0.5 rounded-full bg-secondary p-1.5 text-primary"><Utensils className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] font-semibold text-primary">{serving ? "Mess is serving" : "Next meal"}</span>
        <span className="mt-1 block text-sm font-semibold">{meal.meal}, {meal.highlight}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{rangeLabel(meal.starts_at, meal.ends_at)}{meal.location_name ? `, ${meal.location_name}` : ""}</span>
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function ServiceStrip() {
  const services = useQuery(campusServicesQuery);
  const featured = (services.data ?? []).filter((s) => s.featured).slice(0, 4);
  if (!featured.length) return null;
  return (
    <div className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
      {featured.map((s) => {
        const href = s.action_url ?? (s.phone ? `tel:${s.phone.replace(/\s/g, "")}` : null);
        const inner = (
          <>
            <span className="text-display block text-[0.98rem] leading-snug">{s.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{s.action_label ?? s.hours ?? "Tap for details"}</span>
          </>
        );
        return href ? (
          <a key={s.id} href={href} target="_blank" rel="noreferrer" className="card-surface tap w-[11.5rem] shrink-0 snap-start px-4 py-4">{inner}</a>
        ) : (
          <Link key={s.id} to="/campus" className="card-surface tap w-[11.5rem] shrink-0 snap-start px-4 py-4">{inner}</Link>
        );
      })}
    </div>
  );
}
