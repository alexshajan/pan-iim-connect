import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db, auditQuery, peopleQuery, reviewQuery, submissionsQuery, directoryQuery } from "@/lib/registry-data";
import { PageHead, useConsoleAccess } from "./console";

export const Route = createFileRoute("/console/")({ component: Overview });

function Overview() {
  const { canEdit } = useConsoleAccess();
  const people = useQuery({ ...(canEdit ? peopleQuery : directoryQuery) });
  const subs = useQuery({ ...submissionsQuery, enabled: canEdit });
  const review = useQuery({ ...reviewQuery, enabled: canEdit });
  const audit = useQuery({ ...auditQuery, enabled: canEdit });
  const list = people.data ?? [];
  const real = list.filter((p) => !p.is_placeholder);
  const claimed = real.filter((p) => p.user_id || (p as unknown as { claimed?: boolean }).claimed).length;

  const checkins = useQuery({
    queryKey: ["checkins", "count"],
    queryFn: async () => {
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const { count } = await db.from("check_ins").select("id", { count: "exact", head: true }).eq("event_day", day).is("voided_at", null);
      return count ?? 0;
    },
  });
  const stats = useQuery({
    queryKey: ["registry", "completeness"], enabled: canEdit,
    queryFn: async () => { const { data, error } = await db.rpc("data_completeness"); if (error) throw error; return data as { papers: Record<string, number>; presenters: Record<string, number> }; },
  });
  const onCampus = real.filter((p) => (p as unknown as { attendance_mode?: string }).attendance_mode === "on_campus").length;
  const breakdown = stats.data ? [
    { label: "On campus", value: onCampus },
    { label: "Remote", value: real.length - onCampus },
    { label: "Papers in person", value: (stats.data.papers["offline"] ?? 0) + (stats.data.papers["unconfirmed"] ?? 0) },
    { label: "Papers online", value: stats.data.papers["online"] ?? 0 },
    { label: "Papers with no slot", value: stats.data.papers["unscheduled"] ?? 0 },
  ] : [];
  const tiles = [
    { label: "Registrants", value: real.length, to: "/console/people" },
    { label: "Submissions", value: (subs.data ?? []).filter((s) => !s.is_placeholder).length, to: "/console/submissions" },
    { label: "Signed in", value: claimed, to: "/console/people" },
    { label: "Checked in today", value: checkins.data ?? 0, to: "/console/checkin" },
    { label: "Open issues", value: review.data?.length ?? 0, to: "/console/review" },
  ] as const;

  return (
    <>
      <PageHead eyebrow="Overview" title="Who's registered" />
      {people.error && (
        <p className="mb-4 rounded-xl bg-warn/20 px-4 py-3 text-sm">
          The registry isn't available yet. It switches on once this version is accepted.
        </p>
      )}
      {list.length > real.length && (
        <Link to="/console/placeholders" className="mb-4 block rounded-xl border border-dashed border-border px-4 py-3 text-sm">
          {list.length - real.length} test-cohort people are mixed in. They're excluded from these counts.
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="card-surface tap px-5 py-4">
            <p className="text-3xl tabular-nums">{t.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.label}</p>
          </Link>
        ))}
      </div>
      {breakdown.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {breakdown.map((b) => (
            <Link key={b.label} to="/console/data" className="card-surface tap px-4 py-3">
              <p className="text-xl tabular-nums">{b.value.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">{b.label}</p>
            </Link>
          ))}
        </div>
      )}
      {canEdit && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">Recent edits</h2>
          <ul className="card-surface divide-y divide-border">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  {a.action.toLowerCase()}, {a.table_name.replace("_", " ")}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString("en-IN")}</span>
              </li>
            ))}
            {!audit.data?.length && <li className="px-4 py-3 text-sm text-muted-foreground">No edits yet.</li>}
          </ul>
        </section>
      )}
    </>
  );
}
