import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, SectionHeading } from "@/components/AppShell";
import { MeetMoment, PineCone, WaveIcon, buzz } from "@/components/network/Delight";
import { useAuth } from "@/hooks/useAuth";
import { directoryPeopleQuery, sendWave, useNetworkMarks, wavesQuery } from "@/lib/network-data";
import { initials, type DirPerson } from "@/lib/network";
import { feed, icebreaker, mutualWaves, type MeLite } from "@/lib/network-social";
import { myPersonQuery } from "@/lib/registry-data";
import { sessionsQuery } from "@/lib/conference";
import { connectionsQuery } from "@/components/me/MetPeople";
import { ribbon } from "@/lib/phase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/network/")({
  head: () => ({
    meta: [
      { title: "For you, Pan-IIM 2026 Network" },
      { name: "description", content: "Suggested people to meet at the 11th Pan-IIM WMC, with reasons, waves and matches." },
      { property: "og:title", content: "For you, Pan-IIM 2026 Network" },
      { property: "og:description", content: "Swipe through people worth meeting at IIM Shillong." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForYou,
});

const SKIP_KEY = "paniim.network.skip";

function ForYou() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const dir = useQuery(directoryPeopleQuery);
  const me = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });
  const sessions = useQuery(sessionsQuery);
  const waves = useQuery(wavesQuery(user?.id ?? null));
  const met = useQuery({ ...connectionsQuery, enabled: !!user });
  const marks = useNetworkMarks(user?.id ?? null);
  const [skip, setSkip] = useState<string[]>([]);
  const [match, setMatch] = useState<DirPerson | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    try {
      setSkip(JSON.parse(localStorage.getItem(SKIP_KEY) ?? "[]"));
    } catch {
      /* fresh */
    }
  }, []);
  const persistSkip = (next: string[]) => {
    setSkip(next);
    localStorage.setItem(SKIP_KEY, JSON.stringify(next.slice(-400)));
  };

  const person = me.data?.person as { delegate_code?: string; full_name?: string; organization?: string | null; keywords?: string[] } | undefined;
  const meLite: MeLite = useMemo(
    () => ({
      code: person?.delegate_code ?? "",
      keywords: person?.keywords ?? [],
      tracks: (me.data?.subs ?? []).map((s) => s.submissions?.track).filter(Boolean) as string[],
      organization: person?.organization ?? null,
    }),
    [person, me.data?.subs],
  );
  const sess = useMemo(
    () => (sessions.data ?? []).map((s) => ({ id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, venue: s.venues?.short_name ?? s.venues?.name ?? null })),
    [sessions.data],
  );
  const wavedOut = new Set((waves.data ?? []).filter((w) => w.direction === "out").map((w) => w.code));
  const people = dir.data ?? [];
  const stack = useMemo(
    () => feed(meLite, people, { skip: [...skip, ...wavedOut], met: (met.data ?? []).map((m) => m.code), sessions: sess }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meLite, people, skip, waves.data, met.data, sess],
  );
  const incoming = (waves.data ?? []).filter((w) => w.direction === "in" && !wavedOut.has(w.code));
  const matches = mutualWaves(waves.data ?? []);
  const byCode = (c: string) => people.find((p) => p.code === c);

  const wave = useCallback(
    async (p: DirPerson) => {
      buzz(14);
      try {
        const r = await sendWave(p.code);
        if (r.mutual) setMatch(p);
        else toast(`You waved at ${p.full_name.split(" ")[0]}`, { description: "If they wave back, it's a match." });
        qc.invalidateQueries({ queryKey: ["network", "waves"] });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [qc],
  );

  const refresh = async () => {
    setRefreshing(true);
    persistSkip([]);
    await Promise.all([qc.invalidateQueries({ queryKey: ["network"] }), new Promise((r) => setTimeout(r, 700))]);
    setRefreshing(false);
  };

  const top = stack.slice(0, 3);

  return (
    <>
      {incoming.length ? (
        <div className="card-surface rise mb-4 flex items-center gap-3 px-4 py-3">
          <WaveIcon className="wave-anim h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{incoming.length === 1 ? "Someone waved at you" : `${incoming.length} people waved at you`}</p>
            <p className="truncate text-xs text-muted-foreground">{incoming.map((w) => byCode(w.code)?.full_name ?? w.code).join(", ")}</p>
          </div>
          <div className="flex -space-x-2">
            {incoming.slice(0, 3).map((w) => {
              const p = byCode(w.code);
              return p ? (
                <button key={w.code} type="button" onClick={() => wave(p)} aria-label={`Wave back at ${p.full_name}`} className="tap grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-primary text-[0.65rem] font-bold text-primary-foreground">
                  {initials(p.full_name)}
                </button>
              ) : null;
            })}
          </div>
        </div>
      ) : null}

      {dir.isLoading ? (
        <EmptyNote>Shuffling the deck…</EmptyNote>
      ) : !top.length ? (
        <div className="index-card px-5 py-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <p className="text-display mt-2 text-lg">You've seen everyone for now</p>
          <p className="mt-1 text-sm text-muted-foreground">New people appear as they join the directory.</p>
          <button type="button" onClick={refresh} className="tap mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold">
            <RotateCcw className="h-3.5 w-3.5" /> Show skipped again
          </button>
        </div>
      ) : (
        <>
          <div className="relative h-[25rem]">
            {top
              .map((x, i) => (
                <SwipeCard
                  key={x.p.code}
                  depth={i}
                  person={x.p}
                  reasons={x.reasons}
                  hint={icebreaker(meLite, x.p)}
                  marked={marks.people.includes(x.p.code)}
                  onSkip={() => persistSkip([...skip, x.p.code])}
                  onWave={() => wave(x.p)}
                />
              ))
              .reverse()}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <RoundBtn label="Skip" onClick={() => top[0] && persistSkip([...skip, top[0].p.code])}>
              <X className="h-5 w-5" />
            </RoundBtn>
            <RoundBtn
              label={top[0] && marks.people.includes(top[0].p.code) ? "Saved" : "Save"}
              onClick={() => top[0] && marks.toggle({ code: top[0].p.code }).then(() => buzz(8)).catch((e: Error) => toast.error(e.message))}
            >
              <Bookmark className="h-5 w-5" fill={top[0] && marks.people.includes(top[0].p.code) ? "currentColor" : "none"} />
            </RoundBtn>
            <RoundBtn label="Wave" primary onClick={() => top[0] && wave(top[0].p)}>
              <WaveIcon className="h-6 w-6" />
            </RoundBtn>
          </div>
          <p className="mt-2 text-center text-[0.65rem] text-muted-foreground">Swipe right to wave, left to skip, {stack.length} to go</p>
        </>
      )}

      {matches.length ? (
        <>
          <SectionHeading title={`Matches, ${matches.length}`} />
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {matches.map((c) => {
              const p = byCode(c);
              if (!p) return null;
              return (
                <Link key={c} to="/network/$code" params={{ code: c }} className="tap w-24 shrink-0 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-accent ring-offset-2 ring-offset-background">
                    {initials(p.full_name)}
                  </span>
                  <span className="mt-1.5 block truncate text-xs font-semibold">{p.full_name.split(" ")[0]}</span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">You both waved. Say hi at the next tea break, then tap cards to make it official.</p>
        </>
      ) : null}

      <button type="button" onClick={refresh} className="tap mx-auto mt-6 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <PineCone className={cn("h-4 w-4", refreshing && "pine-spin")} /> {refreshing ? "Refreshing…" : "Refresh suggestions"}
      </button>

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

function RoundBtn({ children, label, onClick, primary }: { children: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="tap flex flex-col items-center gap-1 text-[0.65rem] font-semibold text-muted-foreground">
      <span className={cn("grid place-items-center rounded-full shadow-md", primary ? "h-16 w-16 bg-primary text-primary-foreground" : "h-12 w-12 bg-card text-foreground")}>{children}</span>
      {label}
    </button>
  );
}

function SwipeCard({
  person: p,
  reasons,
  hint,
  depth,
  marked,
  onSkip,
  onWave,
}: {
  person: DirPerson;
  reasons: string[];
  hint: string;
  depth: number;
  marked: boolean;
  onSkip: () => void;
  onWave: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const r = ribbon(p.roles);
  const active = depth === 0;

  const set = (dx: number, animate = false) => {
    const n = el.current;
    if (!n) return;
    n.style.transition = animate ? "transform 320ms cubic-bezier(0.2,0,0,1), opacity 320ms" : "none";
    n.style.transform = `translate3d(${dx}px, 0, 0) rotate(${dx / 18}deg)`;
    const stamp = n.querySelector<HTMLElement>("[data-stamp]");
    if (stamp) {
      stamp.style.opacity = String(Math.min(1, Math.abs(dx) / 90));
      stamp.textContent = dx > 0 ? "WAVE" : "SKIP";
      stamp.dataset["side"] = dx > 0 ? "r" : "l";
    }
  };
  const fling = (dir: 1 | -1) => {
    set(dir * 480, true);
    if (el.current) el.current.style.opacity = "0";
    buzz(10);
    setTimeout(() => (dir > 0 ? onWave() : onSkip()), 220);
  };

  return (
    <div
      ref={el}
      onPointerDown={(e) => {
        if (!active) return;
        start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => start.current && set(e.clientX - start.current.x)}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        const v = Math.abs(dx) / Math.max(1, Date.now() - s.t);
        if (Math.abs(dx) > 110 || (Math.abs(dx) > 40 && v > 0.6)) fling(dx > 0 ? 1 : -1);
        else set(0, true);
      }}
      onPointerCancel={() => {
        start.current = null;
        set(0, true);
      }}
      className={cn("index-card absolute inset-x-0 top-0 flex h-[24rem] touch-pan-y flex-col overflow-hidden select-none", active ? "cursor-grab active:cursor-grabbing" : "pointer-events-none")}
      style={{
        transform: `translate3d(0, ${depth * 10}px, 0) scale(${1 - depth * 0.04})`,
        transition: "transform 320ms cubic-bezier(0.34,1.3,0.64,1)",
        zIndex: 10 - depth,
      }}
    >
      <span
        data-stamp
        className="pointer-events-none absolute top-14 z-10 rounded-md border-[3px] border-primary px-2 py-0.5 text-lg font-black tracking-widest text-primary opacity-0 data-[side=l]:right-5 data-[side=l]:rotate-12 data-[side=r]:left-5 data-[side=r]:-rotate-12"
      />
      <div className="flex items-center justify-between bg-primary px-4 py-2 text-[0.6rem] font-bold text-primary-foreground">
        <span>{r.main}</span>
        {marked ? <Bookmark className="h-3.5 w-3.5" fill="currentColor" /> : <span className="opacity-70">{p.code}</span>}
      </div>
      <div className="flex flex-1 flex-col px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-secondary text-lg font-bold text-primary">{initials(p.full_name)}</span>
          <div className="min-w-0">
            <p className="text-display text-[1.3rem] leading-tight">{p.full_name}</p>
            <p className="truncate text-sm text-muted-foreground">{p.organization ?? ""}</p>
          </div>
        </div>
        {reasons.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {reasons.slice(0, 3).map((x) => (
              <span key={x} className="rounded-full bg-accent/25 px-2.5 py-1 text-[0.7rem] font-semibold text-foreground">{x}</span>
            ))}
          </div>
        ) : null}
        {p.keywords.length ? (
          <div className="mt-3 flex flex-wrap gap-1">{p.keywords.slice(0, 5).map((k) => <span key={k} className="kw-stamp">{k}</span>)}</div>
        ) : null}
        <p className="mt-auto rounded-xl bg-muted/60 px-3 py-2.5 text-xs leading-snug">
          <span className="font-semibold">Icebreaker, </span>
          {hint}
        </p>
        {active ? (
          <Link to="/network/$code" params={{ code: p.code }} className="tap mt-2 text-center text-xs font-semibold text-primary" onPointerDown={(e) => e.stopPropagation()}>
            Open full profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}
