import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Linkedin, Nfc, Plus, QrCode, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { codeFromScan } from "@/lib/phase";
import { toVCards } from "@/lib/vcard";
import { EmptyNote } from "@/components/AppShell";

export type Connection = {
  id: string;
  note: string | null;
  source: string;
  created_at: string;
  code: string;
  full_name: string;
  organization: string | null;
  email: string | null;
  linkedin_url: string | null;
};

export const connectionsQuery = {
  queryKey: ["me", "connections"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_connections");
    if (error) throw error;
    return (data ?? []) as Connection[];
  },
};

export async function addConnection(code: string, source: "qr" | "nfc" | "code") {
  const { error } = await supabase.rpc("add_connection", { _code: code, _source: source });
  if (error) throw error;
}

/** One-tap connect: two-way handshake when the card is live, otherwise save to my network. */
export async function connectByCode(code: string, source: "qr" | "nfc" | "code"): Promise<{ name: string | null; mutual: boolean }> {
  if (source !== "code") {
    const { data, error } = await supabase.rpc("record_handshake", { _code: code, _medium: source });
    if (!error) return { name: (data as { full_name?: string } | null)?.full_name ?? null, mutual: true };
    if (!/not activated/i.test(error.message)) throw error;
  }
  await addConnection(code, source);
  return { name: null, mutual: false };
}

const hasNfc = () => typeof window !== "undefined" && "NDEFReader" in window;

export function MetPeople({ linked }: { linked: boolean }) {
  const qc = useQueryClient();
  const list = useQuery({ ...connectionsQuery, enabled: linked });
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [nfc, setNfc] = useState(false);
  useEffect(() => setNfc(hasNfc()), []);

  async function add(raw: string, source: "qr" | "nfc" | "code") {
    const c = codeFromScan(raw);
    if (!c) {
      toast.error("That isn't a delegate code");
      return;
    }
    try {
      const r = await connectByCode(c, source);
      navigator.vibrate?.(40);
      toast.success(r.mutual ? `${r.name ?? "Contact"} saved, you're in their network too` : "Saved to people you've met");
      setCode("");
      qc.invalidateQueries({ queryKey: connectionsQuery.queryKey });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function tapNfc() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reader = new (window as any).NDEFReader();
      await reader.scan();
      toast("Hold the card to the back of your phone");
      reader.onreading = (ev: { message: { records: { recordType: string; data: DataView }[] } }) => {
        for (const r of ev.message.records) {
          if (r.recordType === "url" || r.recordType === "text") {
            add(new TextDecoder().decode(r.data), "nfc");
            return;
          }
        }
      };
    } catch (e) {
      toast.error((e as Error).message || "NFC not available");
    }
  }

  async function saveNote(id: string, note: string) {
    await supabase.from("person_connections").update({ note }).eq("id", id);
  }
  async function remove(ids: string[]) {
    await supabase.from("person_connections").delete().in("id", ids);
    setSel([]);
    qc.invalidateQueries({ queryKey: connectionsQuery.queryKey });
  }
  function exportCards(rows: Connection[]) {
    const blob = new Blob([toVCards(rows)], { type: "text/vcard" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pan-iim-contacts.vcf";
    a.click();
  }

  if (!linked)
    return <EmptyNote>Once your registration is linked, people you meet will appear here.</EmptyNote>;

  const rows = list.data ?? [];
  const chosen = rows.filter((r) => sel.includes(r.id));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setScanning(true)} className="tap card-surface flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
          <QrCode className="h-4 w-4 text-primary" /> Scan QR
        </button>
        {nfc ? (
          <button type="button" onClick={tapNfc} className="tap card-surface flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
            <Nfc className="h-4 w-4 text-primary" /> Tap card
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add(code, "code");
            }}
            className="card-surface flex items-center gap-1 px-2"
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WMC-XXXX" className="w-full bg-transparent px-2 py-3 text-sm outline-none" />
            <button type="submit" aria-label="Add by code" className="tap rounded-full bg-primary p-1.5 text-primary-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>

      {chosen.length ? (
        <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold">
          <span className="flex-1">{chosen.length} selected</span>
          <button type="button" onClick={() => exportCards(chosen)} className="inline-flex items-center gap-1 text-primary"><Download className="h-3.5 w-3.5" /> Save contacts</button>
          <button type="button" onClick={() => remove(sel)} className="inline-flex items-center gap-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
        </div>
      ) : null}

      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="slip flex items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                aria-label={`Select ${r.full_name}`}
                checked={sel.includes(r.id)}
                onChange={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}
                className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{r.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.organization ?? ""}, <span className="">{r.code}</span>
                </p>
                <input
                  defaultValue={r.note ?? ""}
                  onBlur={(e) => e.target.value !== (r.note ?? "") && saveNote(r.id, e.target.value)}
                  placeholder="Add a note…"
                  className="mt-1.5 w-full border-b border-dashed border-border bg-transparent py-1 text-xs outline-none"
                />
              </div>
              {r.linkedin_url ? (
                <a href={r.linkedin_url} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="tap rounded-full bg-secondary p-2 text-primary">
                  <Linkedin className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote>Scan someone's pass QR or tap their card to save them here.</EmptyNote>
      )}
      {rows.length > 1 && !chosen.length ? (
        <button type="button" onClick={() => exportCards(rows)} className="text-xs font-semibold text-primary">
          Save all {rows.length} contacts
        </button>
      ) : null}

      {scanning ? <Scanner onClose={() => setScanning(false)} onCode={(t) => { setScanning(false); add(t, "qr"); }} /> : null}
    </div>
  );
}

function Scanner({ onClose, onCode }: { onClose: () => void; onCode: (t: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    (async () => {
      const { default: jsQR } = await import("jsqr");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        toast.error("Camera permission is needed to scan");
        onClose();
        return;
      }
      const v = video.current!;
      v.srcObject = stream;
      await v.play();
      const tick = () => {
        if (done) return;
        if (v.videoWidth) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(v, 0, 0);
          const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
          if (hit?.data) {
            done = true;
            onCode(hit.data);
            return;
          }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onClose, onCode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-foreground/90 px-6">
      <video ref={video} playsInline muted className="aspect-square w-full max-w-sm rounded-[var(--radius)] object-cover" />
      <p className="mt-4 text-sm text-background">Point at a pass QR code</p>
      <button type="button" onClick={onClose} className="tap mt-4 inline-flex items-center gap-1.5 rounded-full bg-background px-5 py-2.5 text-sm font-semibold">
        <X className="h-4 w-4" /> Close
      </button>
    </div>
  );
}
