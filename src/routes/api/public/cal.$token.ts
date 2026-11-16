import { createFileRoute } from "@tanstack/react-router";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { COMMON_TYPES } from "@/lib/my-agenda";

// Private calendar feed: the unguessable token is the only key. Returns only
// programme sessions (public information) chosen by that person, no contact data.
export const Route = createFileRoute("/api/public/cal/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token.replace(/\.ics$/, "");
        if (!/^[0-9a-f]{36}$/.test(token)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data: feed } = await db.from("calendar_feeds").select("user_id").eq("token", token).maybeSingle();
        if (!feed) return new Response("Not found", { status: 404 });

        const [bm, person, sessions] = await Promise.all([
          db.from("bookmarks").select("session_id").eq("user_id", feed.user_id),
          db.from("people").select("id, submission_people(submissions(session_id))").eq("user_id", feed.user_id).maybeSingle(),
          db.from("sessions").select("id, title, starts_at, ends_at, session_type, status, room, venues(name)").neq("status", "cancelled"),
        ]);
        const papers = new Set<string>(
          ((person.data?.submission_people ?? []) as { submissions: { session_id: string | null } | null }[])
            .map((x) => x.submissions?.session_id).filter((x): x is string => !!x),
        );
        const want = new Set<string>([...(bm.data ?? []).map((b: { session_id: string }) => b.session_id), ...papers]);
        const events: IcsEvent[] = (sessions.data ?? [])
          .filter((s: any) => want.has(s.id) || COMMON_TYPES.includes(s.session_type))
          .map((s: any) => ({
            id: s.id,
            title: papers.has(s.id) ? `You present, ${s.title}` : s.title,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            location: [s.room, s.venues?.name, "IIM Shillong"].filter(Boolean).join(", "),
            url: `https://paniim.planos.in/session/${s.id}`,
          }));
        return new Response(buildIcs(events), {
          headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
        });
      },
    },
  },
});
