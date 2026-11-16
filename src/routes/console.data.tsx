import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/registry-data";
import { PageHead, useConsoleAccess } from "./console";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/console/data")({ component: DataHealth });

type Stats = {
  papers: Record<"total" | "offline" | "online" | "unconfirmed" | "no_presenter" | "no_track" | "unscheduled" | "online_no_link", number>;
  presenters: Record<"total" | "offline" | "online" | "both" | "multi_paper" | "no_email" | "signed_in", number>;
  authors: Record<"total" | "on_campus" | "remote" | "mixed" | "multi_paper" | "no_email" | "no_affiliation" | "no_phone" | "signed_in", number>;
  tracks: { name: string; total: number; offline: number; online: number; unconfirmed: number }[];
  scaffold: { days: number; slots: number; rooms: number };
};

const statsQuery = {
  queryKey: ["registry", "completeness"],
  queryFn: async () => {
    const [{ data, error }, uns] = await Promise.all([
      db.rpc("data_completeness"),
      // Papers are placed through their session; the old slot/room fields are unused.
      db.from("submissions").select("id", { count: "exact", head: true }).eq("is_placeholder", false).is("session_id", null),
    ]);
    if (error) throw error;
    const stats = data as Stats;
    if (!uns.error && uns.count != null) stats.papers.unscheduled = uns.count;
    return stats;
  },
};

function Tile({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className={cn("card-surface min-w-0 px-3.5 py-3 sm:px-4 sm:py-3.5", tone === "warn" && value > 0 && "ring-1 ring-warn")}>
      <p className="text-xl tabular-nums sm:text-2xl">{value.toLocaleString("en-IN")}</p>
      <p className="mt-0.5 text-[0.8rem] leading-tight sm:text-sm">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Bar({ label, have, total }: { label: string; have: number; total: number }) {
  const pct = total ? Math.round((have / total) * 100) : 0;
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-x-2 text-[0.8rem] sm:text-sm"><span className="min-w-0">{label}</span><span className="text-xs tabular-nums text-muted-foreground">{have}/{total}, {pct}%</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DataHealth() {
  const { canEdit } = useConsoleAccess();
  const qc = useQueryClient();
  const stats = useQuery({ ...statsQuery, enabled: canEdit });
  const pending = useQuery({
    queryKey: ["registry", "unconfirmed-mode"],
    enabled: canEdit,
    queryFn: async () => {
      const { data, error } = await db.from("submissions")
        .select("id, submission_code, title, track, presenter_name, presentation_mode")
        .eq("mode_status", "unconfirmed_default").order("submission_code");
      if (error) throw error;
      return data as { id: string; submission_code: string; title: string; track: string; presenter_name: string; presentation_mode: string }[];
    },
  });
  const gaps = useQuery({
    queryKey: ["registry", "gaps"],
    enabled: canEdit,
    queryFn: async () => {
      const { data, error } = await db.from("people").select("id, full_name, email, organization, email_missing, delegate_code")
        .or("email_missing.eq.true,organization.is.null").order("full_name").limit(200);
      if (error) throw error;
      return data as { id: string; full_name: string; email: string; organization: string | null; email_missing: boolean; delegate_code: string }[];
    },
  });

  async function setMode(id: string, mode: "offline" | "online") {
    const { error } = await db.rpc("set_presentation_mode", { _submission: id, _mode: mode });
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${mode}`);
    qc.invalidateQueries({ queryKey: ["registry"] });
  }

  if (!canEdit) return <PageHead eyebrow="Data health" title="Editors only" />;
  const s = stats.data;

  return (
    <>
      <PageHead eyebrow="Data health" title="How complete is our data?" />
      {stats.error && <p className="mb-4 rounded-xl bg-warn/20 px-4 py-3 text-sm">Couldn't load numbers: {(stats.error as Error).message}</p>}
      {!s ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="grid gap-8">
          <section>
            <h2 className="mb-3 text-xs text-muted-foreground">Papers</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Total papers" value={s.papers.total} />
              <Tile label="Offline, confirmed" value={s.papers.offline} sub="On campus" />
              <Tile label="Online" value={s.papers.online} sub="Zoom / Meet" />
              <Tile label="Mode not confirmed" value={s.papers.unconfirmed} sub="Treated as offline" tone="warn" />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs text-muted-foreground">Presenters (registered authors)</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Presenters" value={s.presenters.total} />
              <Tile label="Presenting offline" value={s.presenters.offline} />
              <Tile label="Presenting online" value={s.presenters.online} />
              <Tile label="Both modes" value={s.presenters.both} sub="Need both flows" tone="warn" />
              <Tile label="Presenting 2+ papers" value={s.presenters.multi_paper} sub="Avoid same-slot clashes" />
              <Tile label="Presenter with no email" value={s.presenters.no_email} tone="warn" />
              <Tile label="Presenters signed in" value={s.presenters.signed_in} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs text-muted-foreground">All authors</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Unique authors" value={s.authors.total} sub={s.authors.total === s.presenters.total ? "No co-authors added yet" : `${s.authors.total - s.presenters.total} co-authors`} />
              <Tile label="Expected on campus" value={s.authors.on_campus} sub="Has an offline paper" />
              <Tile label="Remote only" value={s.authors.remote} />
              <Tile label="On 2+ papers" value={s.authors.multi_paper} />
            </div>
            <div className="card-surface mt-3 grid gap-3 px-4 py-4 sm:px-5">
              <Bar label="Email on file" have={s.authors.total - s.authors.no_email} total={s.authors.total} />
              <Bar label="Affiliation on file" have={s.authors.total - s.authors.no_affiliation} total={s.authors.total} />
              <Bar label="Phone on file" have={s.authors.total - s.authors.no_phone} total={s.authors.total} />
              <Bar label="Signed in to the app" have={s.authors.signed_in} total={s.authors.total} />
              <Bar label="Papers with a presenter" have={s.papers.total - s.papers.no_presenter} total={s.papers.total} />
              <Bar label="Papers placed in a session" have={s.papers.total - s.papers.unscheduled} total={s.papers.total} />
              <Bar label="Online papers with a meeting link" have={s.papers.online - s.papers.online_no_link} total={s.papers.online} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs text-muted-foreground">Mode not confirmed, {pending.data?.length ?? 0}</h2>
            <ul className="grid gap-2 lg:grid-cols-2">
              {(pending.data ?? []).map((p) => (
                <li key={p.id} className="card-surface grid gap-3 px-4 py-3 sm:flex sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">#{p.submission_code}, {p.track}</p>
                    <p className="truncate text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.presenter_name}</p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                    <button onClick={() => setMode(p.id, "offline")} className="tap min-h-11 rounded-full border border-border px-4 text-sm font-semibold">Offline</button>
                    <button onClick={() => setMode(p.id, "online")} className="tap min-h-11 rounded-full border border-border px-4 text-sm font-semibold">Online</button>
                  </div>
                </li>
              ))}
              {pending.data?.length === 0 && <li className="text-sm text-muted-foreground">Every paper has a confirmed mode.</li>}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xs text-muted-foreground">By track</h2>
            <ul className="grid gap-2 sm:hidden">
              {s.tracks.map((t) => (
                <li key={t.name} className="card-surface px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold leading-snug">{t.name}</p>
                    <p className="shrink-0 text-xl tabular-nums">{t.total}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {t.offline} offline, {t.online} online{t.unconfirmed ? `, ${t.unconfirmed} unconfirmed` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <div className="card-surface hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2">Track</th><th className="px-2 text-right">Papers</th><th className="px-2 text-right">Offline</th><th className="px-2 text-right">Online</th><th className="px-4 text-right">Unconfirmed</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  {s.tracks.map((t) => (
                    <tr key={t.name} className="border-t border-border">
                      <td className="px-4 py-2 font-sans">{t.name}</td>
                      <td className="px-2 text-right">{t.total}</td><td className="px-2 text-right">{t.offline}</td>
                      <td className="px-2 text-right">{t.online}</td><td className="px-4 text-right">{t.unconfirmed || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs text-muted-foreground">Missing email or affiliation, {gaps.data?.length ?? 0}</h2>
            <ul className="grid gap-1.5 text-sm md:grid-cols-2">
              {(gaps.data ?? []).map((p) => (
                <li key={p.id} className="flex justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <Link to="/console/people" search={{ q: p.delegate_code }} className="truncate underline-offset-2 hover:underline">{p.full_name}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{[p.email_missing && "no email", !p.organization && "no affiliation"].filter(Boolean).join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xs text-muted-foreground">Programme frame (draft)</h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Tile label="Days" value={s.scaffold.days} sub="Day 1 not final" />
              <Tile label="Paper slots" value={s.scaffold.slots} sub="3 each on days 2 and 3" />
              <Tile label="Parallel rooms" value={s.scaffold.rooms} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
