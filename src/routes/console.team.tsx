import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/registry-data";
import { ASSIGNABLE, ROLE_LABELS, type ConsoleRole } from "@/lib/console-access";
import { PageHead } from "./console";

export const Route = createFileRoute("/console/team")({ component: Team });

type Member = { user_id: string; email: string; full_name: string | null; roles: string[] };

function Team() {
  const qc = useQueryClient();
  const team = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await db.rpc("console_team");
      if (error) throw error;
      return data as Member[];
    },
  });
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<string[]>(["desk_volunteer"]);

  async function save(e: string, roles: string[]) {
    const { data, error } = await db.rpc("set_user_roles", { _email: e, _roles: roles });
    if (error) { toast.error(error.message); return; }
    if (data.status === "no_account") { toast.error("That email hasn't signed in to the app yet. Ask them to sign in once first."); return; }
    toast.success("Roles saved");
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <>
      <PageHead eyebrow="Admin" title="Team & roles" />
      <form
        className="card-surface mb-6 flex flex-wrap items-end gap-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) save(email, picked).then(() => setEmail(""));
        }}
      >
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Add by email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@iimshillong.ac.in" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
        </label>
        <RolePicker value={picked} onChange={setPicked} />
        <button className="tap rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add</button>
      </form>

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-normal">Person</th>
              <th className="px-4 py-2 font-normal">Roles</th>
            </tr>
          </thead>
          <tbody>
            {(team.data ?? []).map((m) => (
              <tr key={m.user_id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">
                  <p>{m.full_name ?? m.email}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <RolePicker value={m.roles} onChange={(r) => save(m.email, r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.error && <p className="px-4 py-3 text-sm text-destructive">{(team.error as Error).message}</p>}
      </div>
    </>
  );
}

function RolePicker({ value, onChange }: { value: string[]; onChange: (r: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ASSIGNABLE.map((r) => {
        const on = value.includes(r);
        return (
          <button
            type="button"
            key={r}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
            className={`tap rounded-full border px-2.5 py-1 text-xs ${on ? "border-transparent bg-plate text-plate-foreground" : "border-border text-muted-foreground"}`}
          >
            {ROLE_LABELS[r as ConsoleRole]}
          </button>
        );
      })}
    </div>
  );
}
