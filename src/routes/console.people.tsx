import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, Package, Plus, QrCode } from "lucide-react";
import { downloadQr, exportVendorZip, NewPersonForm } from "@/components/console/CardTools";
import { PersonEditor } from "@/components/console/PersonEditor";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { db, directoryQuery, peopleQuery, type Person } from "@/lib/registry-data";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { PRESETS, personPreset, roleOnCard } from "@/lib/id-cards";
import { findIssues, ISSUE_LABELS, type IssueKind } from "@/lib/people-issues";
import { PageHead, useConsoleAccess } from "./console";

export const Route = createFileRoute("/console/people")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s["q"] === "string" ? { q: s["q"] } : {}),
  component: PeoplePage,
});

function PeoplePage() {
  const { canEdit } = useConsoleAccess();
  const { data = [], error } = useQuery(canEdit ? peopleQuery : directoryQuery);
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => setQ(search.q ?? ""), [search.q]);
  const [cat, setCat] = useState("all");
  const [claim, setClaim] = useState<"all" | "yes" | "no">("all");
  const [open, setOpen] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<IssueKind | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const issues = useMemo(() => (canEdit ? findIssues(data) : []), [data, canEdit]);
  const issueCounts = useMemo(() => {
    const m = new Map<IssueKind, number>();
    issues.forEach((i) => m.set(i.kind, (m.get(i.kind) ?? 0) + 1));
    return [...m.entries()];
  }, [issues]);
  const issueIds = useMemo(() => new Set(issues.filter((i) => i.kind === issue).flatMap((i) => i.ids)), [issues, issue]);
  const { data: unmatched = [] } = useQuery({
    queryKey: ["registry", "unmatched"], enabled: canEdit,
    queryFn: async () => { const { data, error } = await db.rpc("unmatched_signins"); if (error) return []; return data as { user_id: string; email: string }[]; },
  });

  // Role groups follow the card structure (one Panelist group for every panel), not raw registration categories.
  const groupOf = (p: Person) =>
    p.category === "Visitor" || p.person_roles?.some((r) => r.role === "visitor") ? "Visitor"
    : p.card_role || /panel|editor|director|keynote|purva/i.test(p.category ?? "") ? personPreset(p).label
    : roleOnCard(p);
  const cats = useMemo(() => {
    const counts = new Map<string, number>();
    data.forEach((p) => { const g = groupOf(p); counts.set(g, (counts.get(g) ?? 0) + 1); });
    const order = ["Presenter", "Delegate", ...PRESETS.map((x) => x.label), "Visitor"];
    const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : 999);
    return [...counts.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [data]);
  const rows = data.filter((p) => {
    const s = q.toLowerCase();
    const isClaimed = !!(p.user_id || (p as unknown as { claimed?: boolean }).claimed);
    return (
      (!s || [p.full_name, p.email, p.alt_email, p.phone, p.organization, p.delegate_code].some((v) => v?.toLowerCase().includes(s))) &&
      (cat === "all" || groupOf(p) === cat) &&
      (claim === "all" || (claim === "yes") === isClaimed) &&
      (!issue || issueIds.has(p.id))
    );
  });

  return (
    <>
      <PageHead eyebrow={`${rows.length} of ${data.length}`} title="People">
        {canEdit && (
          <>
          <button onClick={() => setAdding(true)} className="tap inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"><Plus className="size-4" /> New profile</button>
          <button disabled={busy} onClick={async () => { setBusy(true); try { await exportVendorZip(sel.length ? data.filter((p) => sel.includes(p.id)) : rows); } finally { setBusy(false); } }}
            className="tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm disabled:opacity-60">
            <Package className="size-4" /> {busy ? "Preparing…" : `Export for NFC vendor${sel.length ? ` (${sel.length})` : ""}`}
          </button>
          <button
            onClick={() =>
              downloadCsv(
                "people.csv",
                rows.map((p) => ({
                  code: p.delegate_code, name: p.full_name, email: p.email, phone: p.phone, organization: p.organization,
                  category: p.category, roles: p.person_roles?.map((r) => r.role).join(" "), signed_in: p.user_id ? "yes" : "no",
                  placeholder: p.is_placeholder ? "yes" : "",
                })),
              )
            }
            className="tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm"
          >
            <Download className="size-4" /> Export CSV
          </button>
          </>
        )}
      </PageHead>
      {error && <p className="mb-4 text-sm text-muted-foreground">The registry switches on once this version is accepted.</p>}
      {canEdit && (issueCounts.length > 0 || unmatched.length > 0) && (
        <div className="card-surface mb-4 p-3">
          <p className="mb-2 text-[0.65rem] text-muted-foreground">Needs attention</p>
          <div className="flex flex-wrap gap-1.5">
            {issueCounts.map(([k, n]) => (
              <button key={k} onClick={() => setIssue(issue === k ? null : k)}
                className={cn("tap rounded-full border px-3 py-1 text-xs", issue === k ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {ISSUE_LABELS[k]}, {n}
              </button>
            ))}
            {unmatched.length > 0 && (
              <button onClick={() => setShowUnmatched((v) => !v)} className="tap rounded-full border border-border px-3 py-1 text-xs">
                Signed in, no profile, {unmatched.length}
              </button>
            )}
          </div>
          {showUnmatched && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {unmatched.map((u) => <li key={u.user_id} className="">{u.email}</li>)}
              <li>Add one of these as a profile's second email, or create a profile for them.</li>
            </ul>
          )}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, institution or code"
          className="min-w-60 flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-full border border-border bg-card px-3 py-2 text-sm">
          <option value="all">All roles</option>
          {cats.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
        <select value={claim} onChange={(e) => setClaim(e.target.value as typeof claim)} className="rounded-full border border-border bg-card px-3 py-2 text-sm">
          <option value="all">Signed in or not</option>
          <option value="yes">Signed in</option>
          <option value="no">Not yet</option>
        </select>
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[0.65rem] text-muted-foreground">
            <tr className="border-b border-border">
              {canEdit && <th className="w-8 px-3" />}<th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Name</th>
              <th className="hidden px-4 py-2.5 md:table-cell">Institution</th><th className="hidden px-4 py-2.5 lg:table-cell">Role</th>{canEdit && <th className="px-4 py-2.5">QR</th>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((p) => (
              <tr key={p.id} onClick={() => canEdit && setOpen(p)} className={cn("border-b border-border/60 last:border-0", canEdit && "cursor-pointer hover:bg-muted/40")}>
                {canEdit && <td className="px-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${p.full_name}`} checked={sel.includes(p.id)} onChange={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} /></td>}
                <td className="px-4 py-2.5 text-xs">{p.delegate_code}</td>
                <td className="px-4 py-2.5">
                  {p.full_name}
                  {p.is_placeholder && <span className="ml-2 rounded-full border border-dashed border-border px-2 py-0.5 text-[0.65rem]">test</span>}
                  {canEdit && <div className="text-xs text-muted-foreground">{p.email}</div>}
                </td>
                <td className="hidden px-4 py-2.5 md:table-cell">{p.organization}</td>
                <td className="hidden px-4 py-2.5 lg:table-cell">{groupOf(p)}</td>
                {canEdit && <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><button onClick={() => downloadQr(p, "png")} aria-label={`Download QR for ${p.full_name}`} className="tap rounded-full bg-secondary p-1.5 text-primary"><QrCode className="size-4" /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 300 && <p className="px-4 py-3 text-xs text-muted-foreground">Showing first 300, narrow the search.</p>}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <PersonEditor key={open.id} person={open} all={data} onDone={() => setOpen(null)} />}
        </SheetContent>
      </Sheet>
      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <NewPersonForm onDone={() => setAdding(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

