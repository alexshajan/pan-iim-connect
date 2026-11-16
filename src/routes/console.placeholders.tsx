import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, peopleQuery } from "@/lib/registry-data";
import { PageHead } from "./console";

export const Route = createFileRoute("/console/placeholders")({ component: PlaceholdersPage });

function PlaceholdersPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery(peopleQuery);
  const test = data.filter((p) => p.is_placeholder);

  async function run(fn: string, msg: string) {
    const { error } = await db.rpc(fn);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["registry"] });
  }

  return (
    <>
      <PageHead eyebrow="Test cohort" title="Placeholders" />
      <p className="max-w-xl text-sm text-muted-foreground">
        Fifteen made-up people with invented papers, rooms and session slots, so we can build and test before the real
        paper list and room allotment arrive. They're tagged and never mix with real registrants.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => run("seed_placeholder_cohort", "Test cohort added")}
          className="tap rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Add test cohort</button>
        <button disabled={!test.length} onClick={() => confirm("Delete every placeholder record?") && run("clear_placeholders", "Placeholders removed")}
          className="tap rounded-full border border-border bg-card px-5 py-2.5 text-sm disabled:opacity-50">Remove all placeholders</button>
      </div>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {test.map((p) => (
          <li key={p.id} className="slip px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground">{p.delegate_code}</p>
            <p>{p.full_name}</p>
            <p className="text-xs text-muted-foreground">{p.person_roles?.map((r) => r.role).join(", ")}, {p.accommodations?.[0]?.residence} {p.accommodations?.[0]?.room_no}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
