import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/registry-data";
import { PageHead } from "./console";

export const Route = createFileRoute("/console/activity")({ component: ActivityLog });

type Row = { id: string; action: string; table_name: string; at: string; diff: unknown };

function ActivityLog() {
  const [table, setTable] = useState("all");
  const q = useQuery({
    queryKey: ["audit", "full"],
    queryFn: async () => {
      const { data, error } = await db.from("audit_log").select("id, action, table_name, at, diff").order("at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as Row[];
    },
  });
  const tables = [...new Set((q.data ?? []).map((r) => r.table_name))].sort();
  const rows = (q.data ?? []).filter((r) => table === "all" || r.table_name === table);
  return (
    <>
      <PageHead eyebrow="Admin" title="Activity log">
        <select value={table} onChange={(e) => setTable(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
          <option value="all">Everything</option>
          {tables.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
      </PageHead>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{new Date(r.at).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2">{r.action.toLowerCase().replace(/_/g, " ")}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.table_name.replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="px-4 py-6 text-sm text-muted-foreground">No activity yet.</p>}
      </div>
    </>
  );
}
