import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Maximize2, Minus, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, FilterChip } from "@/components/AppShell";
import { WaveIcon, buzz } from "@/components/network/Delight";
import { connectionsQuery } from "@/components/me/MetPeople";
import { useAuth } from "@/hooks/useAuth";
import { directoryPeopleQuery, sendWave } from "@/lib/network-data";
import { initials } from "@/lib/network";
import {
  layoutMap,
  mapPeople,
  overlap,
  regionLabel,
  trackColours,
  trackOrder,
  tracksOf,
  type MapNode,
} from "@/lib/network-map";
import { myPersonQuery } from "@/lib/registry-data";
import { cn } from "@/lib/utils";

type View = "constellation" | "overlap";

export const Route = createFileRoute("/network/map")({
  validateSearch: (s: Record<string, unknown>): { view?: View } =>
    s["view"] === "overlap" ? { view: "overlap" } : {},
  head: () => ({
    meta: [
      { title: "Your map, Pan-IIM 2026 Network" },
      {
        name: "description",
        content:
          "See the people you have met at the 11th Pan-IIM WMC, grouped by conference track, and where tracks overlap.",
      },
      { property: "og:title", content: "Your map, Pan-IIM 2026 Network" },
      { property: "og:description", content: "Your connections at IIM Shillong, by track." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

function useMapData() {
  const { user } = useAuth();
  const dir = useQuery(directoryPeopleQuery);
  const me = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });
  const met = useQuery({ ...connectionsQuery, enabled: !!user });
  const person = me.data?.person as
    { delegate_code?: string; full_name?: string; keywords?: string[] } | undefined;
  const meForMap = useMemo(
    () => ({
      code: person?.delegate_code ?? "me",
      name: person?.full_name ?? "You",
      keywords: person?.keywords ?? [],
      tracks: Array.from(
        new Set((me.data?.subs ?? []).map((s) => s.submissions?.track).filter(Boolean) as string[]),
      ),
    }),
    [person, me.data?.subs],
  );
  const loading = dir.isLoading || met.isLoading || me.isLoading;
  return { dir: dir.data ?? [], met: met.data ?? [], meForMap, loading };
}

function MapPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view: View = search.view ?? "constellation";
  return (
    <>
      <div
        role="group"
        aria-label="Map view"
        className="card-flat mb-4 grid max-w-sm grid-cols-2 gap-1 p-1"
      >
        {(
          [
            ["constellation", "Constellation"],
            ["overlap", "Overlap"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() =>
              navigate({ search: v === "overlap" ? { view: "overlap" } : {}, replace: true })
            }
            className={cn(
              "tap min-h-10 rounded-full text-xs font-semibold transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {view === "overlap" ? <Overlap /> : <Constellation />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Constellation                                                       */
/* ------------------------------------------------------------------ */

function useBoxWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

function Constellation() {
  const qc = useQueryClient();
  const { dir, met, meForMap, loading } = useMapData();
  const [withSuggested, setWithSuggested] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [asList, setAsList] = useState(false);
  const [zoom, setZoom] = useState(1);
  const box = useBoxWidth();
  const W = Math.max(300, box.w);
  const H = W >= 640 ? 520 : 420;

  const nodes = useMemo(
    () => mapPeople(meForMap, met, dir, { withSuggested }),
    [meForMap, met, dir, withSuggested],
  );
  const tracks = useMemo(() => trackOrder(nodes), [nodes]);
  const colours = useMemo(() => trackColours(tracks), [tracks]);
  const lay = useMemo(() => layoutMap(nodes, W, H), [nodes, W, H]);
  const byCode = useMemo(() => new Map(nodes.map((n) => [n.code, n])), [nodes]);
  const selected = sel ? byCode.get(sel) : undefined;
  const metCount = nodes.filter((n) => n.ring === "met").length;
  const dim = (n: MapNode) => !!focus && n.ring !== "me" && !n.tracks.includes(focus);
  const colourOf = (n: MapNode) => (n.tracks[0] && colours[n.tracks[0]]) || "#8c8b82";

  const wave = async (n: MapNode) => {
    buzz(12);
    try {
      const r = await sendWave(n.code);
      toast(
        r.mutual
          ? `You and ${n.name.split(" ")[0]} both waved`
          : `You waved at ${n.name.split(" ")[0]}`,
        {
          description: r.mutual
            ? "Say hi at the next tea break."
            : "If they wave back, it's a match.",
        },
      );
      qc.invalidateQueries({ queryKey: ["network", "waves"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) return <EmptyNote>Drawing your map…</EmptyNote>;

  const vw = W / zoom;
  const vh = H / zoom;
  const me = lay.pos[meForMap.code];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-3">
        <div
          className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5"
          role="group"
          aria-label="Highlight a track"
        >
          <FilterChip active={!focus} onClick={() => setFocus(null)}>
            All tracks
          </FilterChip>
          {tracks.map((t) => (
            <FilterChip
              key={t}
              active={focus === t}
              onClick={() => setFocus(focus === t ? null : t)}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: colours[t] }}
                aria-hidden="true"
              />
              {t}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Who to show"
            className="card-flat grid grid-cols-2 gap-1 p-1"
          >
            <ToggleBtn on={!withSuggested} onClick={() => setWithSuggested(false)}>
              Met
            </ToggleBtn>
            <ToggleBtn on={withSuggested} onClick={() => setWithSuggested(true)}>
              Met + worth meeting
            </ToggleBtn>
          </div>
          <span className="flex-1" />
          <IconBtn
            label={asList ? "Show as map" : "Show as a list"}
            onClick={() => setAsList(!asList)}
          >
            {asList ? <Share2 className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </IconBtn>
          {asList ? null : (
            <>
              <IconBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(2.6, z * 1.25))}>
                <Plus className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(0.8, z / 1.25))}>
                <Minus className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Fit to screen" onClick={() => setZoom(1)}>
                <Maximize2 className="h-4 w-4" />
              </IconBtn>
            </>
          )}
        </div>

        <div ref={box.ref}>
          {!metCount && !withSuggested ? (
            <EmptyNote>
              Your map starts with your first connection. Tap someone's card or scan their pass on
              the Me page.
            </EmptyNote>
          ) : asList ? (
            <MapList
              nodes={nodes}
              focus={focus}
              onPick={(c) => {
                setSel(c);
                setAsList(false);
              }}
            />
          ) : (
            <div className="card-surface overflow-hidden">
              <svg
                viewBox={`${(W - vw) / 2} ${(H - vh) / 2} ${vw} ${vh}`}
                width="100%"
                role="group"
                aria-label={`Your map with ${nodes.length - 1} people`}
                className="block"
              >
                {Object.entries(lay.anchors).map(([t, a]) => (
                  <g key={t} aria-hidden="true" opacity={focus && focus !== t ? 0.25 : 1}>
                    <circle
                      cx={a.x}
                      cy={a.y}
                      r={lay.hullR}
                      fill={colours[t]}
                      fillOpacity={0.09}
                      stroke={colours[t]}
                      strokeOpacity={0.5}
                      strokeDasharray="5 5"
                      strokeWidth={1.4}
                    />
                    <text
                      x={a.x}
                      y={a.y - lay.hullR - 7}
                      textAnchor="middle"
                      fontSize={11.5}
                      fontWeight={600}
                      className="fill-foreground"
                      paintOrder="stroke"
                      stroke="var(--color-background)"
                      strokeWidth={3}
                    >
                      {t.length > 26 ? `${t.slice(0, 25)}…` : t}
                    </text>
                  </g>
                ))}
                {me
                  ? nodes
                      .filter((n) => n.ring === "met")
                      .map((n) => {
                        const p = lay.pos[n.code]!;
                        const hi = sel === n.code;
                        return (
                          <line
                            key={`l-${n.code}`}
                            x1={me.x}
                            y1={me.y}
                            x2={p.x}
                            y2={p.y}
                            className={hi ? "stroke-foreground" : "stroke-muted-foreground"}
                            strokeOpacity={dim(n) ? 0.2 : hi ? 1 : 0.55}
                            strokeWidth={hi ? 2.6 : 1.6}
                          />
                        );
                      })
                  : null}
                {nodes.map((n) => {
                  const p = lay.pos[n.code]!;
                  if (n.ring === "me")
                    return (
                      <g key={n.code} aria-hidden="true">
                        <circle cx={p.x} cy={p.y} r={p.r} className="fill-foreground" />
                        <text
                          x={p.x}
                          y={p.y + 4}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={700}
                          className="fill-background"
                        >
                          You
                        </text>
                      </g>
                    );
                  const on = sel === n.code;
                  const second = n.tracks[1] ? colours[n.tracks[1]] : undefined;
                  return (
                    <g
                      key={n.code}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      aria-label={`${n.name}${n.tracks.length ? `, ${n.tracks.join(" and ")}` : ""}, ${n.ring === "met" ? "you have met" : "worth meeting"}`}
                      onClick={() => setSel(n.code)}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(n.code))
                      }
                      className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-ring"
                      opacity={dim(n) ? 0.22 : 1}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={p.r + 4}
                        fill="none"
                        strokeWidth={2.5}
                        className={on ? "stroke-foreground" : "stroke-transparent"}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={p.r}
                        fill={colourOf(n)}
                        className="stroke-card"
                        strokeWidth={2}
                        strokeDasharray={n.ring === "suggested" ? "3 2" : undefined}
                      />
                      {second ? (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={Math.max(3, p.r * 0.38)}
                          fill={second}
                          className="stroke-card"
                          strokeWidth={1.2}
                        />
                      ) : null}
                      {n.ring === "met" || on ? (
                        <text
                          x={p.x}
                          y={p.y + p.r + 14}
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={on ? 700 : 500}
                          className="fill-foreground"
                          paintOrder="stroke"
                          stroke="var(--color-card)"
                          strokeWidth={3}
                        >
                          {n.name.split(" ")[0]}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
        {asList ? null : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bigger dot = someone you have met, joined to you by a line. Small dashed dots are listed
            delegates who share your track or keywords. Dots sit in the circle of their track; a
            small inner dot shows a second track.
          </p>
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-20" aria-live="polite">
        {selected && selected.ring !== "me" ? (
          <div className="card-surface space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: colourOf(selected) }}
              >
                {initials(selected.name)}
              </span>
              <div className="min-w-0">
                <p className="text-display truncate text-base">{selected.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.organization ?? ""}
                </p>
              </div>
            </div>
            {selected.tracks.length ? (
              <div className="flex flex-wrap gap-1.5">
                {selected.tracks.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[0.7rem] font-semibold"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: colours[t] ?? "#8c8b82" }}
                      aria-hidden="true"
                    />
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {selected.ring === "met"
                ? "You've met. Their card is pinned on your Met wall."
                : selected.reasons.join(" · ") || "Listed in the directory."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/network/$code"
                params={{ code: selected.code }}
                className="tap grid min-h-11 place-items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                Open profile
              </Link>
              {selected.ring === "suggested" ? (
                <button
                  type="button"
                  onClick={() => wave(selected)}
                  className="tap inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-primary px-3 text-xs font-semibold text-primary"
                >
                  <WaveIcon className="h-4 w-4" /> Wave
                </button>
              ) : (
                <Link
                  to="/network/met"
                  className="tap grid min-h-11 place-items-center rounded-full border border-primary px-3 text-xs font-semibold text-primary"
                >
                  Met wall
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="card-flat p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Tap a dot</p>
            <p className="mt-1">
              See who they are and what you share. On a keyboard, Tab to a dot and press Enter.
            </p>
          </div>
        )}
        <div className="card-flat p-4 text-xs text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">{metCount}</span>{" "}
            {metCount === 1 ? "person" : "people"} met
            {withSuggested ? (
              <>
                ,{" "}
                <span className="font-semibold text-foreground">{nodes.length - 1 - metCount}</span>{" "}
                worth meeting
              </>
            ) : null}
            .
          </p>
          <p className="mt-1">Only people who chose to be listed appear as suggestions.</p>
        </div>
      </aside>
    </div>
  );
}

function MapList({
  nodes,
  focus,
  onPick,
}: {
  nodes: MapNode[];
  focus: string | null;
  onPick: (code: string) => void;
}) {
  const show = (ring: MapNode["ring"]) =>
    nodes.filter((n) => n.ring === ring && (!focus || n.tracks.includes(focus)));
  const group = (title: string, list: MapNode[]) => (
    <div className="card-surface overflow-hidden">
      <p className="px-4 pt-3 pb-1 text-[0.68rem] font-semibold text-muted-foreground">{title}</p>
      {list.length ? (
        <ul className="divide-y divide-border">
          {list.map((n) => (
            <li key={n.code} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-primary">
                {initials(n.name)}
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  to="/network/$code"
                  params={{ code: n.code }}
                  className="block truncate text-sm font-semibold hover:underline"
                >
                  {n.name}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {n.tracks.join(", ") || n.organization || ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onPick(n.code)}
                className="tap min-h-11 px-2 text-xs font-semibold text-primary"
              >
                Show on map
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-sm text-muted-foreground">No one here for this track.</p>
      )}
    </div>
  );
  return (
    <div className="space-y-3">
      {group("You've met", show("met"))}
      {show("suggested").length ? group("Worth meeting", show("suggested")) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlap                                                             */
/* ------------------------------------------------------------------ */

const VENN = {
  3: {
    c: [
      { x: 118, y: 112 },
      { x: 212, y: 112 },
      { x: 165, y: 192 },
    ],
    r: 92,
    h: 290,
    pos: {
      "100": [78, 96],
      "010": [252, 96],
      "001": [165, 246],
      "110": [165, 80],
      "101": [116, 170],
      "011": [214, 170],
      "111": [165, 136],
    },
  },
  2: {
    c: [
      { x: 125, y: 150 },
      { x: 205, y: 150 },
    ],
    r: 92,
    h: 300,
    pos: { "100": [90, 150], "010": [240, 150], "110": [165, 150] },
  },
  1: { c: [{ x: 165, y: 150 }], r: 100, h: 300, pos: { "100": [165, 150] } },
} as const;

function Overlap() {
  const { dir, met, loading } = useMapData();
  const [scope, setScope] = useState<"met" | "everyone">("met");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  const byCode = useMemo(() => new Map(dir.map((p) => [p.code, p])), [dir]);
  const allTracks = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of dir) for (const t of tracksOf(p)) n.set(t, (n.get(t) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [dir]);
  const colours = useMemo(() => trackColours(allTracks), [allTracks]);
  const pool = useMemo(
    () =>
      scope === "met"
        ? met.map((m) => ({
            code: m.code,
            name: m.full_name,
            org: m.organization,
            tracks: byCode.get(m.code) ? tracksOf(byCode.get(m.code)!) : [],
          }))
        : dir.map((p) => ({
            code: p.code,
            name: p.full_name,
            org: p.organization,
            tracks: tracksOf(p),
          })),
    [scope, met, dir, byCode],
  );
  const chosen = picked ?? allTracks.slice(0, 3);
  const o = overlap(pool, chosen);
  const n = Math.min(chosen.length, 3) as 0 | 1 | 2 | 3;
  const active = region && o.keys.includes(region) ? region : (o.keys[o.keys.length - 1] ?? null);
  const people = active
    ? (o.regions[active] ?? []).map((c) => pool.find((p) => p.code === c)!).filter(Boolean)
    : [];

  const toggle = (t: string) => {
    const cur = chosen;
    if (cur.includes(t)) {
      if (cur.length > 1) setPicked(cur.filter((x) => x !== t));
    } else if (cur.length < 3) setPicked([...cur, t]);
    setRegion(null);
  };

  if (loading) return <EmptyNote>Counting tracks…</EmptyNote>;
  if (!allTracks.length)
    return <EmptyNote>Tracks appear here once papers are placed in the programme.</EmptyNote>;

  const v = n ? VENN[n] : null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">Pick up to 3 tracks</p>
            <p className="text-xs text-muted-foreground">{chosen.length} of 3</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTracks.map((t) => {
              const on = chosen.includes(t);
              const off = !on && chosen.length >= 3;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  disabled={off}
                  onClick={() => toggle(t)}
                  className={cn(
                    "tap inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-muted text-muted-foreground",
                    off && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: colours[t] }}
                    aria-hidden="true"
                  />
                  {t}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Three is the most that stays readable on a phone.
          </p>
        </div>

        <div
          role="group"
          aria-label="Who to count"
          className="card-flat grid max-w-sm grid-cols-2 gap-1 p-1"
        >
          <ToggleBtn
            on={scope === "met"}
            onClick={() => {
              setScope("met");
              setRegion(null);
            }}
          >
            People I've met
          </ToggleBtn>
          <ToggleBtn
            on={scope === "everyone"}
            onClick={() => {
              setScope("everyone");
              setRegion(null);
            }}
          >
            Everyone listed
          </ToggleBtn>
        </div>

        {v ? (
          <div className="card-surface p-4">
            <svg
              viewBox={`0 0 330 ${v.h}`}
              className="mx-auto block w-full max-w-sm"
              role="group"
              aria-label={`Overlap of ${chosen.join(", ")}`}
            >
              {chosen.slice(0, 3).map((t, i) => (
                <circle
                  key={t}
                  cx={v.c[i]!.x}
                  cy={v.c[i]!.y}
                  r={v.r}
                  fill={colours[t]}
                  fillOpacity={0.16}
                  stroke={colours[t]}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                />
              ))}
              {(Object.entries(v.pos) as [string, readonly [number, number]][]).map(
                ([k, [x, y]]) => {
                  const cnt = o.regions[k]?.length ?? 0;
                  const on = active === k;
                  return (
                    <g
                      key={k}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      aria-label={`${regionLabel(k, chosen)}: ${cnt} ${cnt === 1 ? "person" : "people"}`}
                      onClick={() => setRegion(k)}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setRegion(k))
                      }
                      className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-ring"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={21}
                        className={on ? "fill-card stroke-foreground" : "fill-card stroke-border"}
                        fillOpacity={on ? 1 : 0.75}
                        strokeWidth={on ? 2.4 : 1}
                      />
                      <text
                        x={x}
                        y={y + 6}
                        textAnchor="middle"
                        fontSize={17}
                        fontWeight={700}
                        className="fill-foreground"
                      >
                        {cnt}
                      </text>
                    </g>
                  );
                },
              )}
            </svg>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
              {chosen.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colours[t] }}
                    aria-hidden="true"
                  />
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            {o.total} {o.total === 1 ? "person" : "people"}
          </span>{" "}
          {scope === "met" ? "you have met" : "in the directory"} present in at least one of these
          tracks; the {o.keys.length} numbers add up to {o.total}. Only people who chose to be
          listed are counted.
        </p>
      </div>

      <aside className="card-surface overflow-hidden lg:sticky lg:top-20" aria-live="polite">
        <p className="px-4 pt-3 pb-1 text-[0.68rem] font-semibold text-muted-foreground">
          {active
            ? `${regionLabel(active, chosen)} · ${people.length} ${people.length === 1 ? "person" : "people"}`
            : "Pick a region"}
        </p>
        {people.length ? (
          <ul className="divide-y divide-border">
            {people.slice(0, 40).map((p) => (
              <li key={p.code} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-primary">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.org ?? ""}
                  </span>
                </span>
                <Link
                  to="/network/$code"
                  params={{ code: p.code }}
                  className="tap min-h-11 px-2 text-xs font-semibold leading-[2.75rem] text-primary"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No one in this region.</p>
        )}
        {people.length > 40 ? (
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            Showing 40 of {people.length}. Use People to search the rest.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ToggleBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "tap min-h-10 rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors",
        on ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="tap grid size-11 place-items-center rounded-full bg-surface-muted text-foreground"
    >
      {children}
    </button>
  );
}
