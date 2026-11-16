import { codeFromScan } from "@/lib/phase";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { CheckCircle2, QrCode, Undo2 } from "lucide-react";
import { db } from "@/lib/registry-data";
import { QrScanner } from "@/components/console/QrScanner";
import { PageHead, useConsoleAccess } from "./console";

export const Route = createFileRoute("/console/checkin")({ component: CheckIn });

type Hit = {
  person_id: string; delegate_code: string; full_name: string; organization: string | null; category: string | null;
  claimed: boolean; roles: string[]; papers: string[]; checked_in_at: string | null; checked_in_by: string | null; check_in_id: string | null;
};

const todayQuery = {
  queryKey: ["checkins", "today"],
  queryFn: async () => {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const { data, error } = await db.from("check_ins").select("checked_in_at").eq("event_day", day).is("voided_at", null);
    if (error) throw error;
    return data as { checked_in_at: string }[];
  },
  refetchInterval: 15000,
};

function CheckIn() {
  const { canEdit } = useConsoleAccess();
  const qc = useQueryClient();
  const today = useQuery(todayQuery);
  const [mode, setMode] = useState<"scan" | "signup">("scan");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const lookup = useCallback(async (text: string, method: "qr" | "manual") => {
    const { data, error } = await db.rpc("checkin_lookup", { _q: codeFromScan(text) ?? text });
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as Hit[];
    setHits(list);
    setDone(null);
    if (!list.length) toast.error("No pass matches that code");
    if (method === "qr" && list.length) navigator.vibrate?.(40);
  }, []);

  const onScan = useCallback((t: string) => lookup(t, "qr"), [lookup]);

  async function checkIn(h: Hit, method: "qr" | "manual") {
    setBusy(true);
    const { data, error } = await db.rpc("check_in_person", { _person_id: h.person_id, _method: method });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["checkins"] });
    await lookup(h.delegate_code, "manual");
    if (data.status === "already") toast.message("Already checked in today");
    else {
      setDone(h.full_name);
      navigator.vibrate?.([30, 40, 30]);
    }
  }

  async function undo(h: Hit) {
    if (!h.check_in_id) return;
    const { error } = await db.rpc("void_check_in", { _id: h.check_in_id });
    if (error) { toast.error(error.message); return; }
    toast.success("Check-in undone");
    qc.invalidateQueries({ queryKey: ["checkins"] });
    lookup(h.delegate_code, "manual");
  }

  const byHour = new Map<number, number>();
  for (const c of today.data ?? []) {
    const h = Number(new Date(c.checked_in_at).toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  const max = Math.max(1, ...byHour.values());

  return (
    <>
      <PageHead eyebrow="On-site" title="Check-in desk">
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          <button onClick={() => setMode("scan")} className={`tap rounded-full px-3 py-1 ${mode === "scan" ? "bg-plate text-plate-foreground" : ""}`}>Scan pass</button>
          <button onClick={() => setMode("signup")} className={`tap rounded-full px-3 py-1 ${mode === "signup" ? "bg-plate text-plate-foreground" : ""}`}>Not signed up</button>
        </div>
      </PageHead>

      {mode === "signup" ? (
        <SignupQr />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="space-y-3">
            <QrScanner onCode={onScan} paused={busy} />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) lookup(q, "manual");
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Delegate code, name or email"
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              <button className="tap rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Find</button>
            </form>
          </div>

          <div className="space-y-3">
            {done && (
              <div className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                <CheckCircle2 className="size-6" />
                <p className="font-medium">{done} is checked in</p>
              </div>
            )}
            {hits.map((h) => (
              <article key={h.person_id} className="card-surface px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{h.delegate_code}</p>
                    <h2 className="text-display text-xl">{h.full_name}</h2>
                    <p className="text-sm text-muted-foreground">{[h.organization, h.category].filter(Boolean).join(", ")}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {h.roles.map((r) => <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs">{r}</span>)}
                      {h.papers.map((p) => <span key={p} className="rounded-full border border-border px-2 py-0.5 text-xs">{p}</span>)}
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs">
                      {!h.claimed && <p className="rounded bg-warn/25 px-2 py-0.5">Hasn't signed in to the app yet, show the sign-up QR after check-in.</p>}
                      {h.roles.includes("visitor") && <p className="rounded bg-warn/25 px-2 py-0.5">Visitor pass, not on the registration list.</p>}
                    </div>
                  </div>
                  {h.checked_in_at ? (
                    <div className="text-right text-sm">
                      <p className="font-medium">Already checked in</p>
                      <p className="text-muted-foreground">
                        {new Date(h.checked_in_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        {h.checked_in_by ? ` by ${h.checked_in_by}` : ""}
                      </p>
                      {canEdit && (
                        <button onClick={() => undo(h)} className="tap mt-2 inline-flex items-center gap-1 text-xs underline">
                          <Undo2 className="size-3" /> Undo
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => checkIn(h, q ? "manual" : "qr")}
                      className="tap rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Check in
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!hits.length && !done && (
              <p className="card-surface px-5 py-6 text-sm text-muted-foreground">Point the camera at a pass QR, or type a code.</p>
            )}

            <section className="card-surface px-5 py-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium">Checked in today</h3>
                <p className="text-2xl tabular-nums">{today.data?.length ?? 0}</p>
              </div>
              <div className="mt-3 flex h-16 items-end gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 7).map((h) => (
                  <div key={h} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-sm bg-primary/70" style={{ height: `${((byHour.get(h) ?? 0) / max) * 48}px` }} />
                    <span className="text-[0.55rem] text-muted-foreground">{h}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function SignupQr() {
  const [src, setSrc] = useState("");
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/auth`;
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 640, margin: 1 }).then(setSrc);
  }, [url]);
  return (
    <div className="card-surface mx-auto max-w-md px-6 py-8 text-center">
      <QrCode className="mx-auto size-6 text-muted-foreground" />
      <h2 className="text-display mt-2 text-2xl">Scan to sign in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Use the email you registered with. Then show your pass QR here.</p>
      {src && <img src={src} alt="Sign-in QR code" className="mx-auto mt-5 w-full max-w-xs rounded-lg bg-card" />}
      <p className="mt-3 text-xs text-muted-foreground">{url}</p>
    </div>
  );
}
