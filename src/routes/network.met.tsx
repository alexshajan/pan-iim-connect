import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyNote, SectionHeading } from "@/components/AppShell";
import { HandshakeIcon, StampIcon, Stubs, buzz } from "@/components/network/Delight";
import { connectionsQuery } from "@/components/me/MetPeople";
import { useAuth } from "@/hooks/useAuth";
import { directoryPeopleQuery } from "@/lib/network-data";
import { initials } from "@/lib/network";
import { STAMPS, earnedStamps, readFlags, setFlag, type Flags } from "@/lib/stamps";
import { longDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/network/met")({
  head: () => ({
    meta: [
      { title: "People you've met, Pan-IIM 2026 Network" },
      { name: "description", content: "Your corkboard of handshakes and collectible stamps from the 11th Pan-IIM WMC." },
      { property: "og:title", content: "People you've met, Pan-IIM 2026" },
      { property: "og:description", content: "Every card you tapped at IIM Shillong, pinned in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetWall,
});

function MetWall() {
  const { user } = useAuth();
  const met = useQuery({ ...connectionsQuery, enabled: !!user });
  const dir = useQuery(directoryPeopleQuery);
  const [flags, setFlags] = useState<Flags>({});
  const [shaking, setShaking] = useState(false);
  const [party, setParty] = useState(false);

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 23 || h < 4) setFlag("owl");
    setFlags(readFlags());
  }, []);

  // Easter egg: shake the phone on the wall.
  useEffect(() => {
    let last = 0;
    let hits = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const f = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      const now = Date.now();
      if (f > 38 && now - last > 250) {
        last = now;
        hits += 1;
        if (hits >= 3) {
          hits = 0;
          trigger();
        }
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trigger() {
    setShaking(true);
    buzz([20, 30, 20]);
    setTimeout(() => setShaking(false), 600);
    if (!readFlags().shake) {
      setFlag("shake");
      setFlags(readFlags());
      setParty(true);
      toast.success("Secret stamp unlocked: Shaken, not stirred");
      setTimeout(() => setParty(false), 2200);
    }
  }

  const rows = met.data ?? [];
  const roleOf = useMemo(() => new Map((dir.data ?? []).map((p) => [p.code, p.roles])), [dir.data]);
  const earned = earnedStamps({
    met: rows.map((r) => ({ organization: r.organization, roles: roleOf.get(r.code) })),
    visitedLake: !!flags.lake,
    shook: !!flags.shake,
    now: flags.owl ? new Date(2026, 0, 1, 23) : new Date(2026, 0, 1, 12),
  });
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = longDay(r.created_at);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows]);

  return (
    <>
      {party ? <Stubs /> : null}
      <div className="card-surface flex items-center gap-4 px-4 py-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <HandshakeIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-3xl leading-none tabular-nums">{rows.length}</p>
          <p className="text-xs text-muted-foreground">{rows.length === 1 ? "person met" : "people met"}, {earned.size}/{STAMPS.length} stamps</p>
        </div>
        <Link to="/me" className="tap shrink-0 rounded-full bg-secondary px-3 py-2 text-xs font-semibold">Tap a card</Link>
      </div>

      <SectionHeading title="Stamps" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {STAMPS.filter((s) => !s.hidden || earned.has(s.id)).map((s, i) => {
          const got = earned.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toast(got ? s.label : `Locked: ${s.label}`, { description: s.hint })}
              className="tap flex flex-col items-center gap-1 text-center"
            >
              <span
                className={cn(
                  "grid h-14 w-14 place-items-center rounded-full border-2 border-dashed",
                  got ? "stamp-in border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground/50",
                )}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <StampIcon className="h-6 w-6" />
              </span>
              <span className={cn("text-[0.6rem] leading-tight font-semibold", !got && "text-muted-foreground")}>{s.label}</span>
            </button>
          );
        })}
      </div>

      <SectionHeading title="Your corkboard" />
      {!user ? (
        <EmptyNote>Sign in to see the people you've met.</EmptyNote>
      ) : met.isLoading ? (
        <EmptyNote>Unpinning cards…</EmptyNote>
      ) : !rows.length ? (
        <EmptyNote>No cards yet. Tap someone's ID card with your phone, or scan their pass QR from Me.</EmptyNote>
      ) : (
        <div className={cn("corkboard -mx-5 space-y-5 px-5 py-5", shaking && "jiggle")}>
          {groups.map(([day, list]) => (
            <div key={day}>
              <p className="mb-2 text-[0.62rem] font-bold text-muted-foreground">{day}</p>
              <div className="grid grid-cols-2 gap-3">
                {list.map((c, i) => {
                  const tilt = ((c.code.charCodeAt(c.code.length - 1) % 7) - 3) * 0.8;
                  return (
                    <Link
                      key={c.id}
                      to="/network/$code"
                      params={{ code: c.code }}
                      className="press rise index-card relative block px-3 pt-4 pb-3"
                      style={{ transform: `rotate(${tilt}deg)`, animationDelay: `${i * 50}ms`, ["--tilt" as string]: `${tilt}deg` }}
                    >
                      <span aria-hidden className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-accent shadow" />
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials(c.full_name)}</span>
                      <p className="mt-2 truncate text-sm font-semibold">{c.full_name}</p>
                      <p className="truncate text-[0.68rem] text-muted-foreground">{c.organization ?? ""}</p>
                      <p className="mt-1 text-[0.58rem] text-muted-foreground">via {c.source}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" onClick={trigger} className="mx-auto block text-[0.6rem] text-muted-foreground/60">
            psst… try shaking your phone
          </button>
        </div>
      )}
    </>
  );
}
