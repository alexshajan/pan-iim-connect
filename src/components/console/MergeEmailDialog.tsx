import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { previewLinkedEmail, sendLinkedEmail } from "@/lib/emails.functions";

let open: ((id: string) => void) | null = null;
/** Call right after any successful merge; the organizer then approves the email. */
export function askMergeEmail(personId: string) { open?.(personId); }

export function MergeEmailDialog() {
  const [id, setId] = useState<string | null>(null);
  const [prev, setPrev] = useState<{ html: string; subject: string; recipients: string[]; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useServerFn(previewLinkedEmail);
  const send = useServerFn(sendLinkedEmail);
  useEffect(() => { open = (x) => { setPrev(null); setId(x); }; return () => { open = null; }; }, []);
  useEffect(() => {
    if (!id) return;
    preview({ data: { personId: id } }).then((r) => { if (r.ok) setPrev(r); else { toast.error(r.message); setId(null); } })
      .catch(() => { toast.error("Couldn't build the email preview"); setId(null); });
  }, [id]);

  async function go() {
    if (!id) return;
    setBusy(true);
    try { const r = await send({ data: { personId: id } }); r.ok ? toast.success(r.message) : toast.error(r.message); if (r.ok) setId(null); }
    catch { toast.error("Send failed"); } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && setId(null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Tell {prev?.name ?? "them"} both emails work?</DialogTitle></DialogHeader>
        {!prev ? <p className="py-10 text-center text-sm text-muted-foreground">Preparing the email…</p> : (
          <>
            <p className="text-sm text-muted-foreground">
              One copy each to {prev.recipients.map((r, i) => <b key={r} className="text-foreground">{i ? " and " : ""}{r}</b>)}.
              <span className="block">Subject: {prev.subject}</span>
            </p>
            <iframe title="Email preview" srcDoc={prev.html} sandbox="" className="h-[52vh] w-full rounded-lg border border-border bg-white" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setId(null)} className="tap rounded-full border border-border px-4 py-2 text-sm">Not now</button>
              <button type="button" disabled={busy || !prev.recipients.length} onClick={go}
                className="tap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Sending…" : "Approve and send"}</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
