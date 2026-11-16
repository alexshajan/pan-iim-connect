import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_MAP, parseRows, type ColumnMap, type ParsedImport, type RawRow } from "@/lib/registry";
import { batchesQuery, commitImport, db } from "@/lib/registry-data";
import { PageHead } from "./console";

export const Route = createFileRoute("/console/imports")({ component: ImportsPage });

const FIELDS: [keyof ColumnMap, string][] = [
  ["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["organization", "Institution"], ["address", "Address"],
  ["category", "Category"], ["presenter", "Presenting author"], ["submission1", "Submission ID"],
  ["submission2", "Second submission ID"], ["payment", "Payment status (optional)"],
];

function ImportsPage() {
  const qc = useQueryClient();
  const batches = useQuery(batchesQuery);
  const [file, setFile] = useState<string>("");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>(DEFAULT_MAP);
  const [busy, setBusy] = useState(false);
  const parsed: ParsedImport | null = rows.length ? parseRows(rows, map) : null;

  async function onFile(f: File) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer());
    const data = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[wb.SheetNames[0]!]!, { defval: "" });
    const headers = Object.keys(data[0] ?? {});
    setFile(f.name);
    setRows(data);
    setCols(headers);
    setMap((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, headers.includes(v) ? v : ""])) as ColumnMap);
  }

  async function commit() {
    if (!parsed) return;
    setBusy(true);
    try {
      await commitImport(file, parsed);
      toast.success(`Imported ${parsed.people.length} people`);
      setRows([]);
      qc.invalidateQueries({ queryKey: ["registry"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
    setBusy(false);
  }

  async function rollback(id: string) {
    if (!confirm("Remove everything this upload added?")) return;
    const { error } = await db.rpc("rollback_import", { _batch: id });
    if (error) toast.error(error.message); else { toast.success("Rolled back"); qc.invalidateQueries({ queryKey: ["registry"] }); }
  }

  const issueCounts = parsed?.issues.reduce<Record<string, number>>((a, i) => ({ ...a, [i.kind]: (a[i.kind] ?? 0) + 1 }), {});

  return (
    <>
      <PageHead eyebrow="Registration sheets" title="Imports" />
      <label className="card-surface tap block cursor-pointer border-2 border-dashed border-border px-6 py-8 text-center">
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <p className="text-display text-lg">{file || "Drop in the registration sheet"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Excel or CSV. Re-uploading updates people by email and papers by submission ID.</p>
      </label>

      {parsed && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="card-surface px-5 py-4">
            <h2 className="mb-3 text-sm font-medium">Match the columns</h2>
            <div className="space-y-2">
              {FIELDS.map(([k, l]) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm">
                  {l}
                  <select value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })}
                    className="w-56 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
                    <option value=""> not in sheet </option>
                    {cols.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>
          <section className="card-surface px-5 py-4">
            <h2 className="mb-3 text-sm font-medium">Preview</h2>
            <div className="grid grid-cols-3 gap-3 ">
              <Stat n={rows.length} l="rows" /><Stat n={parsed.people.length} l="people" /><Stat n={parsed.submissions.length} l="submissions" />
            </div>
            <ul className="mt-4 space-y-1 text-sm">
              <li>{parsed.duplicates.length} possible duplicate people (sent to review, not merged)</li>
              {Object.entries(issueCounts ?? {}).map(([k, n]) => <li key={k}>{n} × {k.replace(/_/g, " ")}</li>)}
            </ul>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Show issues</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {parsed.issues.map((i, n) => <li key={n}>Row {i.row}: {i.message}</li>)}
              </ul>
            </details>
            <button disabled={busy || !map.email} onClick={commit}
              className="tap mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "Importing…" : "Import"}
            </button>
          </section>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium">Past uploads</h2>
        <ul className="card-surface divide-y divide-border">
          {(batches.data ?? []).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {b.file_name} <span className="text-muted-foreground">,  {b.row_count} rows, {new Date(b.created_at).toLocaleString("en-IN")}</span>
              </span>
              {b.rolled_back_at ? <span className="text-xs text-muted-foreground">rolled back</span> : (
                <button onClick={() => rollback(b.id)} className="text-xs underline">Roll back</button>
              )}
            </li>
          ))}
          {!batches.data?.length && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing uploaded yet.</li>}
        </ul>
      </section>
    </>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div><p className="text-2xl tabular-nums">{n}</p><p className="font-sans text-xs text-muted-foreground">{l}</p></div>;
}
