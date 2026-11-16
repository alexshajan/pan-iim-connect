import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { StateWeave, LoomLoader } from "@/components/brand/Loom";
import { MeetMoment } from "@/components/network/Delight";
import { Check, Contact, Handshake, HelpCircle, Linkedin, Mail, Nfc, Sparkles, UserRound, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeCode, ribbon } from "@/lib/phase";
import { toVCard } from "@/lib/vcard";
import { addConnection, connectByCode, connectionsQuery, type Connection } from "@/components/me/MetPeople";

type Profile = {
  code: string; full_name: string; opted_in: boolean; organization?: string | null; email?: string | null;
  linkedin_url?: string | null; roles?: string[]; papers?: { code: string; title: string | null; track: string | null }[];
};
type Status = { exists: boolean; active: boolean; is_self: boolean } | null;
type Done = { full_name: string; organization: string | null; shared_keywords: string[]; shared_tracks: string[] };

export const Route = createFileRoute("/c/$code")({
  beforeLoad: ({ params }) => {
    if (/^(blank|setup|new)$/i.test(params.code)) throw redirect({ to: "/card/setup" });
  },
  validateSearch: (s: Record<string, unknown>): { m?: "qr" | "nfc" } => (s["m"] === "qr" ? { m: "qr" } : s["m"] === "nfc" ? { m: "nfc" } : {}),
  head: () => ({
    meta: [
      { title: "Connect, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "You tapped a Pan-IIM 2026 delegate card. Connect to save each other's contact." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Connect at Pan-IIM 2026" },
      { property: "og:description", content: "Tap a delegate card to save each other's contact." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HandshakePage,
});

function HandshakePage() {
  const code = normalizeCode(Route.useParams().code);
  const { m } = Route.useSearch();
  const medium = m === "qr" ? "qr" : "nfc";
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["handshake", code, user?.id ?? null],
    enabled: !loading,
    queryFn: async () => {
      const [p, s] = await Promise.all([supabase.rpc("public_profile", { _code: code }), supabase.rpc("card_status", { _code: code })]);
      if (p.error) throw p.error;
      return { profile: p.data as unknown as Profile | null, status: s.data as unknown as Status };
    },
  });

  const tried = useRef(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [mutual, setMutual] = useState(true);
  const [ok, setOk] = useState(false);
  const [moment, setMoment] = useState(false);
  useEffect(() => {
    const st = q.data?.status;
    if (tried.current || !user || !st || st.is_self || !q.data?.profile) return;
    tried.current = true;
    (async () => {
      try {
        const r = await connectByCode(code, medium);
        navigator.vibrate?.(40);
        setMutual(r.mutual);
        if (r.mutual) setMoment(true);
        setSaved(r.name ?? q.data!.profile!.full_name);
        qc.invalidateQueries({ queryKey: connectionsQuery.queryKey });
      } catch (e) {
        if (/your pass is not linked/i.test((e as Error).message)) toast.error("Finish setting up your pass first, then tap again.");
        else toast.error((e as Error).message);
      }
    })();
  }, [q.data, user, code, medium, qc]);

  async function connect() {
    setBusy(true);
    const { data, error } = await supabase.rpc("record_handshake", { _code: code, _medium: medium });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigator.vibrate?.(30);
    setDone(data as unknown as Done);
    setMoment(true);
    qc.invalidateQueries({ queryKey: connectionsQuery.queryKey });
  }

  async function saveNote() {
    const list = (await qc.fetchQuery(connectionsQuery)) as Connection[];
    const c = list.find((x) => x.code.toUpperCase() === code.toUpperCase());
    if (!c) return;
    const { error } = await supabase.from("person_connections").update({ note: note.trim() || null }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Note saved");
  }

  function signIn() {
    sessionStorage.setItem("after_auth", `/c/${code}?m=${medium}`);
  }

  const mine = useQuery({
    queryKey: ["my_card_share", user?.id ?? null],
    enabled: !!user && !!q.data?.status?.is_self,
    queryFn: async () => (await supabase.from("people").select("share_contact_card").eq("user_id", user!.id).maybeSingle()).data as { share_contact_card?: boolean } | null,
  });
  const met = useQuery({ ...connectionsQuery, enabled: !!user && !!q.data?.status?.is_self });
  async function toggleShare(on: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("set_contact_card_share", { _on: on });
    if (error) { toast.error(error.message); return; }
    navigator.vibrate?.(15);
    qc.invalidateQueries({ queryKey: ["my_card_share"] });
  }

  async function vcard(p: Profile) {
    let c: Parameters<typeof toVCard>[0] = p;
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase.rpc as any)("contact_card", { _code: code });
      if (r.data) c = r.data;
    }
    const blob = new Blob([toVCard(c)], { type: "text/vcard" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.full_name.replace(/\s+/g, "-")}.vcf`;
    a.click();
  }

  const p = q.data?.profile;
  const st = q.data?.status;

  if (done)
    return (
      <AppShell eyebrow="Connected" title="You've met">
        <MeetMoment open={moment} me="You" them={done.full_name} title="Handshake!" sub="Cards swapped. You're in each other's people met." onClose={() => setMoment(false)} />
        <div className="pass rise px-5 py-6 text-center">
          <StateWeave mode="reveal" size={12} className="mb-4 justify-center" />
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-6" /></span>
          <h2 className="text-display mt-3 text-2xl">{done.full_name}</h2>
          {done.organization && <p className="text-sm text-muted-foreground">{done.organization}</p>}
          <p className="mt-2 text-sm">You're now in each other's “People I've met”.</p>
          {(done.shared_keywords.length > 0 || done.shared_tracks.length > 0) && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {[...done.shared_tracks, ...done.shared_keywords].map((k) => <span key={k} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{k}</span>)}
            </div>
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Quick note, what did you talk about?" className="mt-5 w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm" />
          <div className="mt-3 flex gap-2">
            <button onClick={saveNote} className="tap flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold">Save note</button>
            <Link to="/me" className="tap flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">People I've met</Link>
          </div>
        </div>
      </AppShell>
    );

  return (
    <AppShell eyebrow="Delegate card" title={p?.full_name ?? "Connect"}>
      <MeetMoment open={moment && !done} me="You" them={saved ?? ""} title="Handshake!" sub="Cards swapped. You're in each other's people met." onClose={() => setMoment(false)} />
      {q.isLoading || loading ? (
        <LoomLoader label="Opening card" className="py-12" />
      ) : !p ? (
        <div className="pass rise px-5 py-6 text-center">
          <span className="card-float mx-auto flex size-14 items-center justify-center rounded-lg bg-secondary"><Nfc className="size-7 text-primary" /></span>
          <h2 className="text-display mt-3 text-xl">This card isn't linked to anyone</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">No delegate has the code <b className="tabular-nums">{code}</b>. It may be a blank card, or the code was written with a typo.</p>
          <div className="mt-5 grid gap-2">
            <Link to="/card/setup" search={{ code }} className="tap btn-sheen rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Set up this card</Link>
            <a href="https://wa.me/916909023581?text=Hi%2C%20a%20WMC%20card%20isn%27t%20working" target="_blank" rel="noreferrer" className="tap inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-semibold"><HelpCircle className="size-4" /> Ask the Help Desk</a>
          </div>
        </div>
      ) : st?.is_self ? (
        <div className="pass rise px-5 py-6 text-center">
          <StateWeave mode="reveal" size={12} className="mb-3 justify-center" />
          <span className="pop-in mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Sparkles className="size-6" /></span>
          <h2 className="text-display mt-3 text-2xl">That's your card!</h2>
          <p className="mt-1 text-sm text-muted-foreground">It works. Others tap it to swap contacts with you.</p>
          <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${st.active ? "bg-primary/10 text-primary" : "bg-accent"}`}>
            <span className={`size-2 rounded-full ${st.active ? "bg-primary" : "animate-pulse bg-foreground/50"}`} />{st.active ? "Checked in, card live" : "Not checked in yet, show your pass QR at the desk"}
          </span>
          <div className="mt-5 grid grid-cols-3 gap-2 text-left">
            <Link to="/" className="tap rounded-lg bg-secondary px-3 py-3 text-xs font-semibold"><UserRound className="mb-1 size-4 text-primary" />My pass</Link>
            <Link to="/me" className="tap rounded-lg bg-secondary px-3 py-3 text-xs font-semibold"><Users className="mb-1 size-4 text-primary" /><span className="tabular-nums">{(met.data as Connection[] | undefined)?.length ?? 0}</span> met</Link>
            <Link to="/onboarding" className="tap rounded-lg bg-secondary px-3 py-3 text-xs font-semibold"><Sparkles className="mb-1 size-4 text-primary" />Edit profile</Link>
          </div>
          <button type="button" onClick={() => toggleShare(!mine.data?.share_contact_card)} className="tap mt-3 flex w-full items-center justify-between gap-3 rounded-lg bg-secondary px-4 py-3 text-left">
            <span><span className="block text-sm font-semibold">Let people save my contact</span><span className="block text-xs text-muted-foreground">Signed-in delegates who tap your card get your email and phone as a contact file.</span></span>
            <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${mine.data?.share_contact_card ? "bg-primary" : "bg-border"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all ${mine.data?.share_contact_card ? "left-[1.15rem]" : "left-0.5"}`} /></span>
          </button>
        </div>
      ) : (
        <div className="pass px-5 py-5">
          <p className="text-xs text-muted-foreground">{p.code}</p>
          <h2 className="text-display mt-1 text-2xl">{p.full_name}</h2>
          {p.opted_in && p.organization && <p className="text-sm text-muted-foreground">{p.organization}</p>}
          {st && !st.active && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold"><span className="size-1.5 animate-pulse rounded-full bg-foreground/60" /> Not checked in yet</span>}
          {p.opted_in && (
            <span className="mt-3 inline-block -rotate-2 rounded-sm border-2 border-primary px-2.5 py-1 text-xs font-bold text-primary">{ribbon(p.roles ?? []).main}</span>
          )}
          {p.opted_in && p.papers?.length ? (
            <ul className="mt-4 space-y-1.5">
              {p.papers.map((x) => <li key={x.code} className="slip px-3 py-2 text-sm"><span className="text-xs text-muted-foreground">#{x.code}{x.track ? `, ${x.track}` : ""}</span><span className="block">{x.title ?? "Paper title awaited"}</span></li>)}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => vcard(p)} className="tap inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-semibold"><Contact className="h-3.5 w-3.5" /> Save to phone</button>
          {p.opted_in && (
            <>
              {p.email && <a href={`mailto:${p.email}`} className="tap inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-semibold"><Mail className="h-3.5 w-3.5" /> Email</a>}
              {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-semibold"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a>}
            </>
          )}
          </div>

          <div className="mt-5">
            {saved ? (
              <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">Saved to your network, you're in theirs too.</p>
            ) : !user ? (
              <Link to="/auth" onClick={signIn} className="tap inline-flex w-full justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
                Sign in to connect
              </Link>
            ) : !st?.active ? (
              <div className="space-y-2">
                <p className="rounded-lg bg-muted px-4 py-3 text-sm">{p.full_name.split(" ")[0]} hasn't checked in at the desk yet, so a two-way handshake isn't possible. Save them now and they'll see you once they arrive.</p>
                <button onClick={async () => { try { await addConnection(code, "code"); toast.success("Added to your network"); } catch (e) { toast.error((e as Error).message); } }} className="tap w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
                  Add to my network
                </button>
              </div>
            ) : (
              <button disabled={busy} onClick={connect} className="tap inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                <Handshake className="h-4 w-4" /> Met {p.full_name.split(" ")[0]}? Connect
              </button>
            )}
          </div>
        </div>
      )}
      {saved && !ok && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="pass rise w-full max-w-sm px-6 py-6 text-center">
            <StateWeave mode="reveal" size={12} className="mb-4 justify-center" />
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-6" /></span>
            <p className="text-display mt-3 text-xl">{saved} saved to your network!</p>
            <p className="mt-1 text-sm text-muted-foreground">{mutual ? "You're in their network too." : "They'll see you once their card is activated at the desk."}</p>
            <button onClick={() => setOk(true)} className="tap mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">OK</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
