import { isActive } from "@/lib/alerts";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Venue = {
  id: string;
  name: string;
  short_name: string | null;
  kind: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  walk_minutes: number | null;
  sort_order: number;
};

export type Track = {
  id: string;
  name: string;
  accent: string;
  description: string | null;
  sort_order: number;
};

export type Paper = {
  id: string;
  session_id: string;
  title: string;
  abstract: string | null;
  authors: string;
  affiliation: string | null;
  discussant: string | null;
  slot_order: number;
  /** Submission ID, for paper sessions built from submissions. */
  code?: string;
  presenter?: string | null;
  mode?: string;
  /** Ordered authors with institutions, for APA bylines. */
  authorList?: { name: string; org?: string | null }[];
};

export type Session = {
  id: string;
  title: string;
  summary: string | null;
  session_type: string;
  track_id: string | null;
  venue_id: string | null;
  starts_at: string;
  ends_at: string;
  chair: string | null;
  capacity: number | null;
  status: string;
  status_note: string | null;
  session_code?: string | null;
  slot_code?: string | null;
  mode?: string | null;
  room?: string | null;
  area?: string | null;
  parallel_track?: string | null;
  in_everyone_plan?: boolean;
  moved_at?: string | null;
  venues?: Venue | null;
  tracks?: Track | null;
  papers?: Paper[];
};

export type ContentBlock = {
  id: string;
  category: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  meta: Record<string, string>;
  sort_order: number;
};

export type MapPin = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  lat: number;
  lng: number;
  sort_order: number;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  urgent: boolean;
  published_at: string;
  kind?: string | null;
  ends_at?: string | null;
  withdrawn_at?: string | null;
  session_id?: string | null;
};

export type Participant = {
  id: string;
  email: string;
  full_name: string;
  affiliation: string | null;
  role: string;
  residence: string | null;
  room_no: string | null;
  arrival_note: string | null;
};

const SESSION_SELECT =
  "*, venues(*), tracks(*)";
const PAPER_COLS = "id, session_id, submission_code, title, presenter_name, session_order, presentation_mode, authors";

type RawSub = { id: string; session_id?: string; submission_code: string; title: string | null; presenter_name: string | null; session_order: number | null; presentation_mode: string; authors: { name: string; org?: string | null }[] | null };

const normName = (s: string) => s.toLowerCase().replace(/\b(dr|prof|mr|ms|mrs)\.?\s*/g, "").replace(/[^a-z]/g, "");

/** The presenter's own institution; the first author's only when no presenter matches. */
export function presenterOrg(x: Pick<RawSub, "authors" | "presenter_name">): string | null {
  const list = x.authors ?? [];
  const p = x.presenter_name ? normName(x.presenter_name.split(",")[0]!) : "";
  const hit = p ? list.find((a) => normName(a.name) === p) ?? list.find((a) => { const n = normName(a.name); return !!n && (n.includes(p) || p.includes(n)); }) : undefined;
  return (hit ?? list[0])?.org ?? null;
}

/** Papers in a session come from the submissions assigned to it. */
function withPapers(row: Record<string, unknown>, subs: RawSub[] = []): Session {
  const papers: Paper[] = subs
    .map((x, i) => {
      const names = (x.authors ?? []).map((a) => a.name);
      return {
        id: x.id,
        session_id: row["id"] as string,
        title: x.title ?? "Title to be confirmed",
        abstract: null,
        authors: names.length ? names.join(", ") : (x.presenter_name ?? ""),
        affiliation: presenterOrg(x),
        discussant: null,
        slot_order: x.session_order ?? i + 1,
        code: x.submission_code,
        presenter: x.presenter_name,
        mode: x.presentation_mode,
        authorList: x.authors ?? [],
      };
    })
    .sort((a, b) => a.slot_order - b.slot_order);
  return { ...(row as unknown as Session), papers };
}

/** Where a session happens, in words a guest understands. */
export function placeOf(s: Session): string {
  if (s.mode === "online") return "Online";
  if (s.room) return `Room ${s.room}`;
  return s.venues?.short_name ?? s.venues?.name ?? "Venue to be announced";
}

export const sessionsQuery = queryOptions({
  queryKey: ["sessions"],
  queryFn: async (): Promise<Session[]> => {
    const [{ data, error }, papers] = await Promise.all([
      supabase.from("sessions").select(SESSION_SELECT).order("starts_at", { ascending: true }),
      supabase.from("public_papers").select(PAPER_COLS).range(0, 2999),
    ]);
    if (error) throw error;
    const bySession = new Map<string, RawSub[]>();
    for (const p of (papers.data ?? []) as unknown as RawSub[]) {
      const k = p.session_id ?? "";
      bySession.set(k, [...(bySession.get(k) ?? []), p]);
    }
    return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => withPapers(r, bySession.get(r["id"] as string)));
  },
});

export const sessionQuery = (id: string) =>
  queryOptions({
    queryKey: ["session", id],
    queryFn: async (): Promise<Session | null> => {
      const [{ data, error }, papers] = await Promise.all([
        supabase.from("sessions").select(SESSION_SELECT).eq("id", id).maybeSingle(),
        supabase.from("public_papers").select(PAPER_COLS).eq("session_id", id),
      ]);
      if (error) throw error;
      return data ? withPapers(data as unknown as Record<string, unknown>, (papers.data ?? []) as unknown as RawSub[]) : null;
    },
  });

export const tracksQuery = queryOptions({
  queryKey: ["tracks"],
  queryFn: async (): Promise<Track[]> => {
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Track[];
  },
});

export const venuesQuery = queryOptions({
  queryKey: ["venues"],
  queryFn: async (): Promise<Venue[]> => {
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Venue[];
  },
});

export const contentQuery = (category: string) =>
  queryOptions({
    queryKey: ["content", category],
    queryFn: async (): Promise<ContentBlock[]> => {
      const { data, error } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("category", category)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ContentBlock[];
    },
  });

export const allContentQuery = queryOptions({
  queryKey: ["content", "all"],
  queryFn: async (): Promise<ContentBlock[]> => {
    const { data, error } = await supabase
      .from("content_blocks")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as ContentBlock[];
  },
});

export const pinsQuery = queryOptions({
  queryKey: ["map_pins"],
  queryFn: async (): Promise<MapPin[]> => {
    const { data, error } = await supabase
      .from("map_pins")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MapPin[];
  },
});

export const announcementsQuery = queryOptions({
  queryKey: ["announcements"],
  queryFn: async (): Promise<Announcement[]> => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) throw error;
    const now = new Date();
    return ((data ?? []) as Announcement[]).filter((a) => isActive(a, now));
  },
});

export const bookmarksQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["bookmarks", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      if (!userId) return [];
      const { data, error } = await supabase.from("bookmarks").select("session_id");
      if (error) throw error;
      return (data ?? []).map((r: { session_id: string }) => r.session_id);
    },
  });

export const myParticipantQuery = (email: string | null) =>
  queryOptions({
    queryKey: ["participant", email],
    enabled: !!email,
    queryFn: async (): Promise<Participant | null> => {
      if (!email) return null;
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Participant | null;
    },
  });

export const participantsQuery = queryOptions({
  queryKey: ["participants"],
  queryFn: async (): Promise<Participant[]> => {
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Participant[];
  },
});

export const helpRequestsQuery = queryOptions({
  queryKey: ["help_requests"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("help_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const trackAccentClass: Record<string, string> = {
  indigo: "bg-track-indigo",
  moss: "bg-track-moss",
  sky: "bg-track-sky",
  sand: "bg-track-sand",
  clay: "bg-track-clay",
};

export const trackTextClass: Record<string, string> = {
  indigo: "text-track-indigo",
  moss: "text-track-moss",
  sky: "text-track-sky",
  sand: "text-track-sand",
  clay: "text-track-clay",
};

/** Soft tinted surface + text for schedule blocks and legend pills. */
export const trackSoftClass: Record<string, string> = {
  indigo: "bg-track-indigo/12 text-track-indigo",
  moss: "bg-track-moss/12 text-track-moss",
  sky: "bg-track-sky/12 text-track-sky",
  sand: "bg-track-sand/14 text-track-sand",
  clay: "bg-track-clay/12 text-track-clay",
};

