import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, FilterChip, SectionHeading } from "@/components/AppShell";
import { IndexCard } from "@/components/network/IndexCard";
import { useAuth } from "@/hooks/useAuth";
import { directoryPeopleQuery, useNetworkMarks } from "@/lib/network-data";
import { filterPeople, keywordOverlap, suggest } from "@/lib/network";
import { myPersonQuery } from "@/lib/registry-data";
import { sessionsQuery } from "@/lib/conference";
import { isLive } from "@/lib/format";

export const Route = createFileRoute("/network/people")({
  head: () => ({
    meta: [
      { title: "People, Pan-IIM 2026 Network" },
      { name: "description", content: "Browse consenting delegates by research keywords, track, institute and role." },
      { property: "og:title", content: "People, Pan-IIM 2026 Network" },
      { property: "og:description", content: "Find who to meet at the 11th Pan-IIM WMC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

const ROLE_CHIPS = [
  ["presenter", "Presenters"],
  ["track_chair", "Chairs"],
  ["keynote", "Keynotes"],
] as const;

function PeoplePage() {
  const { user } = useAuth();
  const dir = useQuery(directoryPeopleQuery);
  const me = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });
  const sessions = useQuery(sessionsQuery);
  const marks = useNetworkMarks(user?.id ?? null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>();
  const [track, setTrack] = useState<string>();
  const [onlyMarked, setOnlyMarked] = useState(false);

  const people = dir.data ?? [];
  const myKw = ((me.data?.person as { keywords?: string[] } | undefined)?.keywords) ?? [];
  const myCode = me.data?.person.delegate_code ?? "";
  const myTracks = (me.data?.subs ?? []).map((s) => s.submissions?.track).filter(Boolean) as string[];
  const tracks = useMemo(() => Array.from(new Set(people.flatMap((p) => p.papers.map((x) => x.track)).filter(Boolean))) as string[], [people]);
  const filtering = !!(q || role || track || onlyMarked);
  const list = filterPeople(people, { q, role, track, bookmarked: onlyMarked ? marks.people : undefined });
  const picks = suggest({ code: myCode, keywords: myKw, tracks: myTracks }, people, 6);
  const today = new Date().toDateString();
  const todayIds = new Set((sessions.data ?? []).filter((s) => new Date(s.starts_at).toDateString() === today || isLive(s.starts_at, s.ends_at, new Date())).map((s) => s.id));
  const presenting = people.filter((p) => p.papers.some((x) => x.session_id && todayIds.has(x.session_id)));

  const mark = (code: string) => marks.toggle({ code }).catch((e: Error) => toast.error(e.message));
  const card = (p: (typeof people)[number]) => (
    <IndexCard key={p.code} p={p} shared={keywordOverlap(myKw, p.keywords)} marked={marks.people.includes(p.code)} onMark={() => mark(p.code)} />
  );

  return (
    <>
      <label className="card-surface flex items-center gap-2 px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, institute, topic or paper…" className="w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        <FilterChip active={onlyMarked} onClick={() => setOnlyMarked(!onlyMarked)}>Bookmarked</FilterChip>
        {ROLE_CHIPS.map(([r, l]) => (
          <FilterChip key={r} active={role === r} onClick={() => setRole(role === r ? undefined : r)}>{l}</FilterChip>
        ))}
        {tracks.map((t) => (
          <FilterChip key={t} active={track === t} onClick={() => setTrack(track === t ? undefined : t)}>{t}</FilterChip>
        ))}
      </div>

      {dir.isLoading ? <EmptyNote>Opening the card index…</EmptyNote> : null}

      {!filtering && picks.length ? (
        <>
          <SectionHeading title="Suggested for you" />
          <div className="space-y-3">{picks.map((x) => card(x.p))}</div>
        </>
      ) : null}
      {!filtering && !myKw.length && me.data ? (
        <p className="mt-4 text-xs text-muted-foreground">Add research keywords on your Me page to get suggestions.</p>
      ) : null}

      {!filtering && presenting.length ? (
        <>
          <SectionHeading title="Presenting today" />
          <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5">
            {presenting.map((p) => <div key={p.code} className="w-[17rem] shrink-0 snap-start">{card(p)}</div>)}
          </div>
        </>
      ) : null}

      <SectionHeading title={filtering ? `${list.length} found` : "Everyone"} />
      {list.length ? <div className="space-y-3">{list.map(card)}</div> : dir.isLoading ? null : <EmptyNote>No one matches yet. People appear here once they choose to be listed.</EmptyNote>}
    </>
  );
}
