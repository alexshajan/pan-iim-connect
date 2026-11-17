import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bookmark, ChevronRight, ScanLine, Search, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, SectionHeading } from "@/components/AppShell";
import { MeetMoment, WaveIcon, buzz } from "@/components/network/Delight";
import { useAuth } from "@/hooks/useAuth";
import { directoryPeopleQuery, sendWave, useNetworkMarks, wavesQuery } from "@/lib/network-data";
import { initials, type DirPerson } from "@/lib/network";
import { feed, mutualWaves, type MeLite } from "@/lib/network-social";
import { layoutMap, mapPeople, trackColours, trackOrder } from "@/lib/network-map";
import { myPersonQuery } from "@/lib/registry-data";
import { sessionsQuery } from "@/lib/conference";
import { connectionsQuery } from "@/components/me/MetPeople";
import { longDay, timeOf } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/network/")({
  head: () => ({
    meta: [
      { title: "Network, Pan-IIM 2026" },
      {
        name: "description",
        content:
          "Meet the people behind the papers at the 11th Pan-IIM WMC: your session-mates, people worth meeting and your map.",
      },
      { property: "og:title", content: "Network, Pan-IIM 2026" },
      { property: "og:description", content: "Meet the people behind the papers at IIM Shillong." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NetworkHome,
});

function NetworkHome() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const dir = useQuery(directoryPeopleQuery);
  const me = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });
  const sessions = useQuery(sessionsQuery);
  const waves = useQuery(wavesQuery(user?.id ?? null));
  const met = useQuery({ ...connectionsQuery, enabled: !!user });
  const marks = useNetworkMarks(user?.id ?? null);
  const [match, setMatch] = useState<DirPerson | null>(null);

  const person = me.data?.person as
    | {
        delegate_code?: string;
        full_name?: string;
        organization?: string | null;
        keywords?: string[];
      }
    | undefined;
  const myCode = person?.delegate_code ?? "";
  const mySubs = useMemo(() => me.data?.subs ?? [], [me.data?.subs]);
  const meLite: MeLite = useMemo(
    () => ({
      code: myCode,
      keywords: person?.keywords ?? [],
      tracks: mySubs.map((s) => s.submissions?.track).filter(Boolean) as string[],
      organization: person?.organization ?? null,
    }),
    [myCode, person, mySubs],
  );
  const people = dir.data ?? [];
  const metList = useMemo(() => met.data ?? [], [met.data]);
  const metCodes = useMemo(() => new Set(metList.map((m) => m.code)), [metList]);
  const sess = useMemo(
    () =>
      (sessions.data ?? []).map((s) => ({
        id: s.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        venue: s.venues?.short_name ?? s.venues?.name ?? null,
      })),
    [sessions.data],
  );

  // People presenting in the same session(s) as me.
  const mySessionIds = new Set(
    mySubs.map((s) => s.submissions?.session_id).filter(Boolean) as string[],
  );
  const mySession = (sessions.data ?? []).find((s) => mySessionIds.has(s.id));
  const mates = people.filter(
    (p) =>
      p.code !== myCode && p.papers.some((x) => x.session_id && mySessionIds.has(x.session_id)),
  );

  // Ranked suggestions as a plain list (no swiping).
  const wavedOut = new Set(
    (waves.data ?? []).filter((w) => w.direction === "out").map((w) => w.code),
  );
  const picks = useMemo(
    () =>
      feed(meLite, people, { skip: [], met: [...metCodes], sessions: sess })
        .filter((x) => x.reasons.length && !mates.some((m) => m.code === x.p.code))
        .slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meLite, people, metCodes, sess, mates.length],
  );
  const incoming = (waves.data ?? []).filter((w) => w.direction === "in" && !wavedOut.has(w.code));
  const matches = mutualWaves(waves.data ?? []);
  const byCode = (c: string) => people.find((p) => p.code === c);

  const wave = async (p: DirPerson) => {
    buzz(14);
    try {
      const r = await sendWave(p.code);
      if (r.mutual) setMatch(p);
      else
        toast(`You waved at ${p.full_name.split(" ")[0]}`, {
          description: "If they wave back, it's a match.",
        });
      qc.invalidateQueries({ queryKey: ["network", "waves"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const mark = (code: string) => marks.toggle({ code }).catch((e: Error) => toast.error(e.message));

  const row = (p: DirPerson, reasons: string[] = []) => {
    const waved = wavedOut.has(p.code);
    const isMet = metCodes.has(p.code);
    const paper = p.papers.find((x) => x.title)?.title;
    return (
      <li key={p.code} className="flex items-center gap-3 px-4 py-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-primary">
          {initials(p.full_name)}
        </span>
        <span className="min-w-0 flex-1">
          <Link
            to="/network/$code"
            params={{ code: p.code }}
            className="text-display block truncate text-[1rem] hover:underline"
          >
            {p.full_name}
          </Link>
          <span className="block truncate text-xs text-muted-foreground">
            {p.organization ?? ""}
          </span>
          {paper ? (
            <span className="mt-0.5 block text-xs leading-snug [display:-webkit-box] overflow-hidden [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
              {paper}
            </span>
          ) : null}
          {reasons.length ? (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {reasons.slice(0, 2).map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-accent/30 px-2 py-0.5 text-[0.65rem] font-semibold"
                >
                  {r}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        {isMet ? (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.65rem] font-semibold text-primary">
            Met
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => mark(p.code)}
              aria-label={
                marks.people.includes(p.code)
                  ? `Remove bookmark for ${p.full_name}`
                  : `Bookmark ${p.full_name}`
              }
              className="tap grid size-11 place-items-center rounded-full text-primary"
            >
              <Bookmark
                className="h-4 w-4"
                fill={marks.people.includes(p.code) ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              disabled={waved}
              onClick={() => wave(p)}
              aria-label={waved ? `You waved at ${p.full_name}` : `Wave at ${p.full_name}`}
              className={cn(
                "tap grid size-11 place-items-center rounded-full",
                waved ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground",
              )}
            >
              <WaveIcon className="h-5 w-5" />
            </button>
          </span>
        )}
      </li>
    );
  };

  return (
    <>
      <p className="-mt-1 mb-4 text-sm text-muted-foreground">
        Meet the people behind the papers. Only signed-in delegates who chose to be listed appear
        here; change yours on{" "}
        <Link to="/me" className="font-semibold text-primary underline underline-offset-2">
          Me
        </Link>
        .
      </p>

      {incoming.length ? (
        <div className="card-surface rise mb-4 flex items-center gap-3 px-4 py-3">
          <WaveIcon className="wave-anim h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {incoming.length === 1
                ? "Someone waved at you"
                : `${incoming.length} people waved at you`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {incoming.map((w) => byCode(w.code)?.full_name ?? w.code).join(", ")}
            </p>
          </div>
          <div className="flex -space-x-2">
            {incoming.slice(0, 3).map((w) => {
              const p = byCode(w.code);
              return p ? (
                <button
                  key={w.code}
                  type="button"
                  onClick={() => wave(p)}
                  aria-label={`Wave back at ${p.full_name}`}
                  className="tap grid size-11 place-items-center rounded-full border-2 border-card bg-primary text-[0.65rem] font-bold text-primary-foreground"
                >
                  {initials(p.full_name)}
                </button>
              ) : null;
            })}
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-x-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Link
            to="/network/people"
            className="card-surface tap flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"
          >
            <Search className="h-4 w-4" aria-hidden="true" /> Search delegates by name, institute,
            topic or paper
          </Link>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <QuickTile to="/me" icon={<ScanLine className="h-5 w-5" />} label="Scan a pass" />
            <QuickTile to="/network/map" icon={<Share2 className="h-5 w-5" />} label="Your map" />
            <QuickTile to="/network/met" icon={<Users className="h-5 w-5" />} label="Met wall" />
          </div>

          <div className="lg:hidden">
            <MapCard
              myCode={myCode}
              myName={person?.full_name ?? "You"}
              met={metList}
              people={people}
            />
          </div>

          {mates.length ? (
            <>
              <SectionHeading title="Your session-mates" />
              {mySession ? (
                <p className="-mt-1 mb-2 text-xs text-muted-foreground">
                  {mySession.title} · {longDay(mySession.starts_at)}, {timeOf(mySession.starts_at)}
                  {(mySession.venues?.short_name ?? mySession.room)
                    ? ` · ${mySession.venues?.short_name ?? mySession.room}`
                    : ""}
                </p>
              ) : null}
              <ul className="card-surface divide-y divide-border overflow-hidden">
                {mates.slice(0, 8).map((p) => row(p, ["In your session"]))}
              </ul>
            </>
          ) : null}

          <SectionHeading
            title="Worth meeting"
            action={
              <Link to="/network/people" className="text-xs font-semibold text-primary">
                See everyone
              </Link>
            }
          />
          {dir.isLoading ? (
            <EmptyNote>Opening the card index…</EmptyNote>
          ) : picks.length ? (
            <ul className="card-surface divide-y divide-border overflow-hidden">
              {picks.map((x) => row(x.p, x.reasons))}
            </ul>
          ) : (
            <EmptyNote>Add research keywords on your Me page to get suggestions.</EmptyNote>
          )}
        </div>

        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
          <MapCard
            myCode={myCode}
            myName={person?.full_name ?? "You"}
            met={metList}
            people={people}
          />
          {matches.length ? <Matches codes={matches} byCode={byCode} /> : null}
        </aside>
      </div>

      {matches.length ? (
        <div className="lg:hidden">
          <Matches codes={matches} byCode={byCode} />
        </div>
      ) : null}

      <MeetMoment
        open={!!match}
        me={person?.full_name ?? "You"}
        them={match?.full_name ?? ""}
        title="It's a match!"
        sub={`You and ${match?.full_name.split(" ")[0] ?? ""} both want to meet. Say hi at the tea break.`}
        onClose={() => setMatch(null)}
      />
    </>
  );
}

function QuickTile({
  to,
  icon,
  label,
}: {
  to: "/me" | "/network/map" | "/network/met";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="card-surface tap flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 px-2 py-3 text-center text-xs font-semibold"
    >
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Link>
  );
}

/** Small static preview of the map: you and the people you have met, coloured by track. */
function MapCard({
  myCode,
  myName,
  met,
  people,
}: {
  myCode: string;
  myName: string;
  met: { code: string; full_name: string; organization: string | null }[];
  people: DirPerson[];
}) {
  const W = 340;
  const H = 170;
  const nodes = useMemo(
    () =>
      mapPeople({ code: myCode || "me", name: myName, keywords: [], tracks: [] }, met, people, {
        withSuggested: false,
      }),
    [myCode, myName, met, people],
  );
  const colours = useMemo(() => trackColours(trackOrder(nodes)), [nodes]);
  const lay = useMemo(() => layoutMap(nodes, W, H), [nodes]);
  const centre = lay.pos[myCode || "me"];
  const count = nodes.length - 1;
  return (
    <section className="card-surface mt-4 p-4 lg:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-display text-lg">Your network map</h2>
        <Link to="/network/map" className="text-xs font-semibold text-primary">
          Open full map
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        {count
          ? `${count} ${count === 1 ? "person" : "people"} met, grouped by track`
          : "No connections yet"}
      </p>
      {count ? (
        <Link
          to="/network/map"
          aria-label="Open your network map"
          className="tap mt-3 block overflow-hidden rounded-xl bg-background"
        >
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true">
            {centre
              ? nodes
                  .filter((n) => n.ring === "met")
                  .map((n) => {
                    const p = lay.pos[n.code]!;
                    return (
                      <line
                        key={n.code}
                        x1={centre.x}
                        y1={centre.y}
                        x2={p.x}
                        y2={p.y}
                        className="stroke-muted-foreground"
                        strokeOpacity={0.5}
                        strokeWidth={1.4}
                      />
                    );
                  })
              : null}
            {nodes.map((n) => {
              const p = lay.pos[n.code]!;
              if (n.ring === "me")
                return <circle key={n.code} cx={p.x} cy={p.y} r={14} className="fill-foreground" />;
              return (
                <circle
                  key={n.code}
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill={(n.tracks[0] && colours[n.tracks[0]]) || "#8c8b82"}
                  className="stroke-card"
                  strokeWidth={2}
                />
              );
            })}
          </svg>
        </Link>
      ) : (
        <div className="mt-3 rounded-xl bg-background px-4 py-5 text-center text-sm text-muted-foreground">
          Your map starts with your first connection. Tap someone's card or scan their pass.
          <Link
            to="/me"
            className="tap mx-auto mt-3 flex w-fit items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Scan a pass <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}

function Matches({
  codes,
  byCode,
}: {
  codes: string[];
  byCode: (c: string) => DirPerson | undefined;
}) {
  return (
    <section>
      <SectionHeading title={`Matches, ${codes.length}`} />
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {codes.map((c) => {
          const p = byCode(c);
          if (!p) return null;
          return (
            <Link
              key={c}
              to="/network/$code"
              params={{ code: c }}
              className="tap w-20 shrink-0 text-center"
            >
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-accent ring-offset-2 ring-offset-background">
                {initials(p.full_name)}
              </span>
              <span className="mt-1.5 block truncate text-xs font-semibold">
                {p.full_name.split(" ")[0]}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        You both waved. Say hi at the next tea break, then tap cards to make it official.
      </p>
    </section>
  );
}
