import { askMergeEmail } from "@/components/console/MergeEmailDialog";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, peopleQuery, reviewQuery } from "@/lib/registry-data";
import { supabase } from "@/integrations/supabase/client";
import { PageHead } from "./console";

export const Route = createFileRoute("/console/review")({ component: ReviewPage });

const LABEL: Record<string, string> = {
  same_name_org: "Same name & institution, different emails",
  same_phone: "Same phone, different emails",
  missing_email: "Row without email",
  bad_phone: "Phone needs checking",
  duplicate_submission: "Submission paid by more than one person",
};

function ReviewPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery(reviewQuery);
  const people = useQuery(peopleQuery);
  const byId = new Map((people.data ?? []).map((p) => [p.id, p]));

  async function resolve(id: string, status: "ignored" | "resolved") {
    const { data: u } = await db.auth.getUser();
    await db.from("review_items").update({ status, resolved_by: u.user?.id, resolved_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["registry"] });
  }
  async function merge(itemId: string, keep: string, drop: string[]) {
    for (const d of drop) {
      const { error } = await db.rpc("merge_people", { _keep: keep, _drop: d });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Merged");
    askMergeEmail(keep);
    resolve(itemId, "resolved");
  }

  const claims = useQuery({
    queryKey: ["registry", "role_claims"],
    queryFn: async () => {
      const { data: c } = await supabase.from("role_claims").select("*").eq("status", "open").order("created_at");
      const ids = (c ?? []).map((x) => x.user_id);
      const { data: pp } = ids.length ? await supabase.from("people").select("user_id, full_name, email, organization").in("user_id", ids) : { data: [] };
      return (c ?? []).map((x) => ({ ...x, who: (pp ?? []).find((p) => p.user_id === x.user_id) }));
    },
  });

  return (
    <>
      <PageHead eyebrow={`${data.length + (claims.data?.length ?? 0)} open`} title="Review queue" />
      {claims.data?.length ? (
        <p className="mb-4 text-sm">{claims.data.length} pass claims (new-email sign-ins) now live in <Link to="/console/help" className="underline">Help desk → Pass claims</Link>.</p>
      ) : null}
      <ul className="space-y-3">
        {data.map((r) => (
          <li key={r.id} className="card-surface px-4 py-3.5">
            <p className="text-[0.65rem] text-muted-foreground">{LABEL[r.kind] ?? r.kind}</p>
            {r.person_ids.length > 1 ? (
              <div className="mt-2 space-y-1.5">
                {r.person_ids.map((pid) => {
                  const p = byId.get(pid);
                  return (
                    <div key={pid} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{p?.full_name} <span className="text-muted-foreground">,  {p?.email}, {p?.organization}</span></span>
                      <button onClick={() => merge(r.id, pid, r.person_ids.filter((x) => x !== pid))} className="text-xs underline">
                        Keep this one, merge others in
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-sm">{String(r.detail["message"] ?? r.detail["label"] ?? "")}</p>
            )}
            <div className="mt-3 flex gap-3 text-xs">
              <button onClick={() => resolve(r.id, "resolved")} className="underline">Mark fixed</button>
              <button onClick={() => resolve(r.id, "ignored")} className="text-muted-foreground underline">Not a problem</button>
            </div>
          </li>
        ))}
        {!data.length && <li className="text-sm text-muted-foreground">Nothing to review.</li>}
      </ul>
    </>
  );
}
