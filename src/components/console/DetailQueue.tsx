import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/registry-data";
import { cleanName, KIND_LABEL, type Author, type DetailKind } from "@/lib/detail-requests";
import { cn } from "@/lib/utils";
import { standardizeAffiliation, type Alias } from "@/lib/affiliation";

function useAliases() {
  return useQuery({
    queryKey: ["registry", "institution-aliases-lite"], staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await db.from("institution_aliases").select("raw, canonical").range(0, 4999);
      if (error) throw error;
      return (data ?? []) as Alias[];
    },
  });
}

type Item = {
  proposed_org: string | null;
  id: string; kind: DetailKind; status: string; created_at: string; author_index: number | null;
  proposed_name: string | null; proposed_email: string | null; note: string | null; decision_note: string | null;
  code: string; full_name: string; email: string; alt_email: string | null; organization: string | null;
  submission_code: string | null; title: string | null; authors: Author[] | null; presenter_name: string | null;
};

const REJECT = [
  "This name isn't on the paper's author list we received.",
  "That email is already on another pass. Please visit the help desk.",
  "We need the registration payer to confirm this change.",
];

export function DetailQueue() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["detail-queue"], refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await db.rpc("detail_queue");
      if (error) throw error;
      return (data as unknown as Item[]).filter((i) => (i.kind as string) !== "confirm");
    },
  });
  const items = q.data ?? [];
  const pending = items.filter((i) => i.status === "pending");
  const done = items.filter((i) => i.status !== "pending").slice(0, 20);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Guests asking to correct what prints on their card. Approving updates their pass right away; rejecting sends your note back so they can try again.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {pending.map((i) => <DetailRow key={i.id} i={i} onDone={() => qc.invalidateQueries({ queryKey: ["detail-queue"] })} />)}
      </div>
      {!pending.length && <p className="help-ticket px-4 py-6 text-sm text-muted-foreground">{q.isLoading ? "Loading" : q.error ? "Couldn't load requests." : "No detail changes waiting."}</p>}
      {done.length ? (
        <details>
          <summary className="tap cursor-pointer text-xs text-muted-foreground">Recently decided ({done.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {done.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 border-b border-border py-1.5">
                <span className="min-w-0 truncate">{i.full_name}: {i.kind === "email" ? i.proposed_email : i.kind === "affiliation" ? i.proposed_org : i.proposed_name}</span>
                <span className={cn("shrink-0 text-xs", i.status === "approved" ? "text-primary" : "text-destructive")}>{i.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function DetailRow({ i, onDone }: { i: Item; onDone: () => void }) {
  const [name, setName] = useState(i.proposed_name ? cleanName(i.proposed_name) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const aliases = useAliases();
  const isOrg = i.kind === "affiliation";
  const sugg = isOrg && aliases.data ? standardizeAffiliation(i.proposed_org ?? "", aliases.data) : null;
  const [org, setOrg] = useState<string | null>(null);
  const orgValue = org ?? sugg?.canonical ?? i.proposed_org ?? "";
  const canonNames = isOrg ? [...new Set((aliases.data ?? []).map((a) => a.canonical))] : [];
  async function decide(approve: boolean) {
    if (!approve && !note.trim()) { toast.error("Add a short reason so they know what to fix."); return; }
    if (approve && isOrg && !orgValue.trim()) { toast.error("Pick the standard institution name."); return; }
    setBusy(true);
    const { error } = await db.rpc("decide_detail_change", {
      _id: i.id, _approve: approve, _note: note,
      _name: i.kind === "email" || isOrg ? null : name, _org: isOrg ? orgValue.trim() : null,
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Updated their pass" : "Sent back with your note");
    onDone();
  }
  return (
    <article className="help-ticket px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{KIND_LABEL[i.kind]}</p>
          <p className="text-display text-[1rem]">{i.full_name} <span className="text-xs text-muted-foreground tabular-nums">{i.code}</span></p>
          <p className="truncate text-xs text-muted-foreground">{i.email}{i.organization ? `, ${i.organization}` : ""}</p>
        </div>
        <span className="ticket-stamp shrink-0 text-muted-foreground">Pending</span>
      </div>

      {i.kind === "presenter" && i.authors ? (
        <div className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">Paper {i.submission_code}: {i.title}</p>
          <ol className="mt-1.5 space-y-0.5">
            {i.authors.map((a, n) => (
              <li key={n} className={cn("flex gap-2", n + 1 === i.author_index && "font-semibold text-primary")}>
                <span className="w-4 tabular-nums text-muted-foreground">{n + 1}</span>{cleanName(a.name)}
                {n + 1 === i.author_index ? <span className="text-xs">picked</span> : null}
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-xs text-muted-foreground">Listed presenter now: {i.presenter_name ?? "none"}</p>
        </div>
      ) : i.kind === "email" ? (
        <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">Add <b>{i.proposed_email}</b> as a second sign-in email{i.alt_email ? ` (replaces ${i.alt_email})` : ""}</p>
      ) : isOrg ? (
        <div className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">
          <p><span className="text-muted-foreground">Now: </span>{i.organization || "none"}</p>
          <p><span className="text-muted-foreground">They typed: </span><b>{i.proposed_org}</b></p>
          <label className="mt-2 block text-xs text-muted-foreground">
            Standard name{sugg ? <span className={cn("ml-1.5 rounded-full px-1.5 text-[0.62rem]", sugg.how === "new" ? "bg-warn/30" : "bg-primary/15 text-primary")}>{sugg.how === "new" ? "no match, adds a new institution" : sugg.how}</span> : null}
            <input list={`inst-${i.id}`} value={orgValue} onChange={(e) => setOrg(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground" />
            <datalist id={`inst-${i.id}`}>{canonNames.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <p className="mt-1 text-[0.7rem] text-muted-foreground">Approving saves their spelling under this name, so future entries map the same way.</p>
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">{i.full_name} → <b>{i.proposed_name}</b></p>
      )}
      {i.note ? <p className="mt-2 text-xs"><span className="text-muted-foreground">They said: </span>{i.note}</p> : null}

      {i.kind !== "email" && !isOrg ? (
        <label className="mt-3 block text-xs text-muted-foreground">Name to print
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground" />
        </label>
      ) : null}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to guest (needed to reject)" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {REJECT.map((r) => <button key={r} type="button" onClick={() => setNote(r)} className="tap rounded border border-border px-2 py-0.5 text-[0.7rem] text-muted-foreground">{r.split(".")[0]}</button>)}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy} onClick={() => decide(false)} className="tap rounded-full border border-border px-4 py-1.5 text-sm">Send back</button>
        <button disabled={busy} onClick={() => decide(true)} className="tap btn-sheen flex-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Approve</button>
      </div>
    </article>
  );
}
