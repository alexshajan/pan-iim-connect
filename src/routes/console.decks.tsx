import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Folder, Upload } from "lucide-react";
import { db } from "@/lib/registry-data";
import { PageHead, useConsoleAccess } from "./console";

export const Route = createFileRoute("/console/decks")({ component: Decks });

type Row = {
  submission_id: string; submission_code: string; title: string | null; track: string | null; presenter_name: string | null;
  session_title: string | null; starts_at: string | null; venue: string | null;
  deck_id: string | null; file_path: string | null; file_name: string | null; version: number | null; uploaded_at: string | null;
};
type Group = "room" | "track" | "day";

const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "Unscheduled";

function Decks() {
  const { canEdit } = useConsoleAccess();
  const qc = useQueryClient();
  const rows = useQuery({
    queryKey: ["decks"],
    queryFn: async () => {
      const [{ data, error }, rooms] = await Promise.all([
        db.rpc("deck_drive"),
        db.from("sessions").select("title,starts_at,room"),
      ]);
      if (error) throw error;
      // Paper sessions carry a room number rather than a linked venue; use it when the venue is empty.
      const roomOf = new Map<string, string | null>(((rooms.data ?? []) as { title: string; starts_at: string; room: string | null }[]).map((x) => [`${x.title}|${new Date(x.starts_at).getTime()}`, x.room]));
      return (data as Row[]).map((r) => {
        if (r.venue) return r;
        const room = r.session_title && r.starts_at ? roomOf.get(`${r.session_title}|${new Date(r.starts_at).getTime()}`) : null;
        return { ...r, venue: room ? (room.startsWith("Room") ? room : `Room ${room}`) : null };
      });
    },
  });
  const setting = useQuery({
    queryKey: ["settings", "deck_grouping"],
    queryFn: async () => {
      const { data } = await db.from("console_settings").select("value").eq("key", "deck_grouping").maybeSingle();
      return (data?.value as Group) ?? "room";
    },
  });
  const [group, setGroup] = useState<Group | null>(null);
  const [todayOnly, setTodayOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const g = group ?? setting.data ?? "room";
  const todayKey = fmtDay(new Date().toISOString());

  const folders = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows.data ?? []) {
      if (todayOnly && fmtDay(r.starts_at) !== todayKey) continue;
      const k = g === "room" ? r.venue ?? (r.starts_at ? "Room not set" : "Not scheduled") : g === "track" ? r.track ?? "No track" : fmtDay(r.starts_at);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows.data, g, todayOnly, todayKey]);

  async function openDeck(r: Row) {
    if (!r.file_path) return;
    const { data, error } = await db.storage.from("decks").createSignedUrl(r.file_path, 600);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  const current = folders.find(([k]) => k === open);

  return (
    <>
      <PageHead title="Deck drive">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["room", "track", "day"] as Group[]).map((x) => (
            <button key={x} onClick={() => { setGroup(x); setOpen(null); }} className={`tap rounded-full border border-border px-3 py-1 capitalize ${g === x ? "bg-plate text-plate-foreground" : ""}`}>
              By {x}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1.5">
            <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} /> Today only
          </label>
        </div>
      </PageHead>
      {rows.error && <p className="text-sm text-destructive">{(rows.error as Error).message}</p>}

      {!current ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map(([k, list]) => (
            <button key={k} onClick={() => setOpen(k)} className="card-surface tap flex flex-col items-start gap-2 px-4 py-4 text-left">
              <Folder className="size-6 text-primary" />
              <p className="font-medium">{k}</p>
              <p className="text-xs text-muted-foreground">
                {list.filter((r) => r.deck_id).length}/{list.length} decks in
              </p>
            </button>
          ))}
          {!folders.length && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        </div>
      ) : (
        <>
          <button onClick={() => setOpen(null)} className="tap mb-3 text-sm text-muted-foreground">← All folders</button>
          <h2 className="text-display mb-3 text-xl">{current[0]}</h2>
          <div className="card-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-normal">Time</th>
                  <th className="px-4 py-2 font-normal">Paper</th>
                  <th className="px-4 py-2 font-normal">Presenter</th>
                  <th className="px-4 py-2 font-normal">Slides</th>
                </tr>
              </thead>
              <tbody>
                {current[1].map((r) => (
                  <tr key={r.submission_id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums">
                      {r.starts_at ? new Date(r.starts_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs tabular-nums text-muted-foreground">{r.submission_code}</p>
                      <p>{r.title ?? "Untitled"}</p>
                    </td>
                    <td className="px-4 py-2.5">{r.presenter_name ?? ""}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {r.deck_id ? (
                          <button onClick={() => openDeck(r)} className="tap inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                            <FileText className="size-3.5" /> Open v{r.version}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Missing</span>
                        )}
                        {canEdit && <UploadBtn row={r} onDone={() => qc.invalidateQueries({ queryKey: ["decks"] })} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function UploadBtn({ row, onDone }: { row: Row; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(f: File) {
    setBusy(true);
    const version = (row.version ?? 0) + 1;
    const path = `${row.submission_code}/v${version}-${f.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await db.storage.from("decks").upload(path, f, { upsert: false });
    if (up.error) { setBusy(false); { toast.error(up.error.message); return; } }
    const { data: u } = await db.auth.getUser();
    const { error } = await db.from("submission_decks").insert({ submission_id: row.submission_id, file_path: path, file_name: f.name, version, uploaded_by: u.user?.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Uploaded v${version}`);
    onDone();
  }
  return (
    <>
      <input ref={ref} type="file" accept=".pdf,.ppt,.pptx,.key" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button disabled={busy} onClick={() => ref.current?.click()} className="tap inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs" aria-label="Upload slides">
        <Upload className="size-3.5" /> {busy ? "…" : "Upload"}
      </button>
    </>
  );
}
