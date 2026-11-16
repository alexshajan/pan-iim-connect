import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProfileLinks } from "@/components/me/ProfileLinks";
import type { ProfileLink } from "@/lib/profile-links";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { AppShell, EmptyNote } from "@/components/AppShell";
import { DelegatePass } from "@/components/me/DelegatePass";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { myPersonQuery } from "@/lib/registry-data";
import { passKind } from "@/lib/onboarding";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your pass, Pan-IIM 2026" },
      { name: "description", content: "Confirm your delegate pass, add your research profile and choose your consents." },
      { property: "og:title", content: "Set up your pass, Pan-IIM 2026" },
      { property: "og:description", content: "Three quick steps to your Pan-IIM digital delegate pass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Your pass", "Profile", "Consents"];
const CLAIM_ROLES = [["presenter", "Presenter"], ["track_chair", "Track chair"], ["reviewer", "Reviewer"], ["keynote", "Speaker"], ["other", "Other"]] as const;

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(0);
  const reg = useQuery({ ...myPersonQuery(user?.id ?? null), retry: false });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const p = reg.data?.person;
  const roles = [...(p?.person_roles ?? []).map((r) => r.role), ...(reg.data?.subs ?? []).map((s) => s.role)];
  const refresh = () => qc.invalidateQueries({ queryKey: ["registry", "me"] });

  return (
    <AppShell eyebrow={`Step ${step + 1} of 3, ${STEPS[step]}`} title="Set up your pass">
      <div className="mb-5 flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: i <= step ? "100%" : "0%" }} />
          </div>
        ))}
      </div>
      <div key={step} className="rise">
        {reg.isLoading || loading ? (
          <EmptyNote>Looking you up…</EmptyNote>
        ) : step === 0 ? (
          p ? (
            <PassStep person={p} roles={roles} onNext={() => setStep(1)} />
          ) : (
            <VisitorStart defaultName={(user?.user_metadata?.["full_name"] as string) ?? ""} onDone={refresh} />
          )
        ) : step === 1 ? (
          <ProfileStep name={p?.full_name ?? ""} links={((p as { profile_links?: ProfileLink[] } | undefined)?.profile_links) ?? []} keywords={(p as { keywords?: string[] } | undefined)?.keywords ?? []} bio={(p as { bio?: string | null } | undefined)?.bio ?? ""} onBack={() => setStep(0)} onNext={() => setStep(2)} />
        ) : (
          <ConsentStep phone={p?.phone ?? ""} onBack={() => setStep(1)} onDone={async () => { await refresh(); const back = sessionStorage.getItem("after_auth"); sessionStorage.removeItem("after_auth"); if (back && back.startsWith("/") && !back.startsWith("//")) navigate({ href: back, replace: true }); else navigate({ to: "/me", replace: true }); }} />
        )}
      </div>
    </AppShell>
  );
}


function PassStep({ person, roles, onNext }: { person: { full_name: string; organization: string | null; delegate_code: string; is_placeholder: boolean }; roles: string[]; onNext: () => void }) {
  const visitor = passKind(roles) === "visitor";
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {visitor ? "You're on a visitor pass, the schedule, maps, guide and network are all yours." : `Welcome, ${person.full_name.split(" ")[0]}. We found your registration.`}
      </p>
      <DelegatePass name={person.full_name} organization={person.organization} code={person.delegate_code} roles={roles} test={person.is_placeholder} />
      {visitor ? <ClaimRole /> : null}
      <button onClick={onNext} className="tap mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
        Looks right, continue
      </button>
    </>
  );
}

function VisitorStart({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const [name, setName] = useState(defaultName);
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("start_visitor_pass", { _name: name, _org: org });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onDone();
  }
  return (
    <form onSubmit={go} className="card-surface space-y-2.5 px-5 py-5">
      <h2 className="text-display text-lg">Your email isn't on the delegate list</h2>
      <p className="text-sm text-muted-foreground">
        That's fine, we'll make you a visitor pass. If you're presenting or chairing, you can tell us on the next screen and the organizers will upgrade it.
      </p>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm" />
      <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Institution (optional)" className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm" />
      <button disabled={busy} className="tap w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "Making your pass…" : "Get my visitor pass"}
      </button>
    </form>
  );
}

export function ClaimRole() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const claims = useQuery({
    queryKey: ["role_claims", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("role_claims").select("status, created_at").order("created_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("presenter");
  const [sub, setSub] = useState("");
  const [note, setNote] = useState("");
  const last = claims.data?.[0];

  if (last?.status === "open")
    return <p className="mt-3 rounded-2xl bg-surface-muted px-4 py-3 text-sm">⏳ Your role request is with the organizers. Your pass updates once they approve it.</p>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("role_claims").insert({ role, submission_code: sub.trim() || null, note: note.trim() || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Sent to the organizers.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["role_claims"] });
  }

  return open ? (
    <form onSubmit={send} className="card-surface rise mt-3 space-y-2.5 px-4 py-4">
      <p className="text-sm font-semibold">I'm actually a…</p>
      <div className="flex flex-wrap gap-2">
        {CLAIM_ROLES.map(([k, l]) => (
          <button type="button" key={k} onClick={() => setRole(k)}
            className={`tap rounded-full border px-3 py-1.5 text-xs transition-colors ${role === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {l}
          </button>
        ))}
      </div>
      <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Submission ID (if any)" className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything that helps us find you (e.g. registered with another email)" className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm" />
      <button className="tap w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Send to organizers</button>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm underline">
      {last?.status === "rejected" ? "Request wasn't approved, ask again" : "I'm a presenter, chair or reviewer →"}
    </button>
  );
}

function ProfileStep({ name, links, keywords, bio, onBack, onNext }: { name: string; links: ProfileLink[]; keywords: string[]; bio: string; onBack: () => void; onNext: () => void }) {
  const [kw, setKw] = useState(keywords.join(", "));
  const [b, setB] = useState(bio);
  const [listed, setListed] = useState(false);
  async function save() {
    const words = kw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
    const a = await supabase.rpc("set_my_profile", { _keywords: words, _bio: b });
    const c = await supabase.rpc("set_my_directory", { _on: listed });
    if (a.error || c.error) { toast.error((a.error ?? c.error)!.message); return; }
    onNext();
  }
  const field = "w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm";
  return (
    <div className="card-surface space-y-2.5 px-5 py-5">
      <p className="text-sm text-muted-foreground">Help the right people find you. All optional.</p>
      <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Research keywords, comma separated (up to 8)" className={field} />
      <input value={b} maxLength={160} onChange={(e) => setB(e.target.value)} placeholder="One-line bio" className={field} />
      <ProfileLinks initial={links} name={name} />
      <Toggle on={listed} set={setListed} label="List me in Network" hint="Other signed-in delegates can see your name, institution and keywords." />
      <Nav onBack={onBack} onNext={save} />
    </div>
  );
}

function ConsentStep({ phone, onBack, onDone }: { phone: string; onBack: () => void; onDone: () => void }) {
  const [ph, setPh] = useState(phone);
  const [c, setC] = useState({ photo: false, whatsapp: false, calls: false, networking: false, card: false });
  const set = (k: keyof typeof c) => (v: boolean) => setC((s) => ({ ...s, [k]: v }));
  async function finish() {
    const { error } = await supabase.rpc("complete_onboarding", { _phone: ph, _photo: c.photo, _whatsapp: c.whatsapp, _calls: c.calls, _networking: c.networking });
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("set_contact_card_share", { _on: c.card });
    toast.success("You're all set.");
    onDone();
  }
  return (
    <div className="card-surface space-y-2.5 px-5 py-5">
      <input value={ph} inputMode="tel" onChange={(e) => setPh(e.target.value)} placeholder="Phone (optional, for help-desk callbacks)" className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm" />
      <Toggle on={c.networking} set={set("networking")} label="Show my email to delegates" hint="Only if you're listed in Network." />
      <Toggle on={c.card} set={set("card")} label="Let people who tap my card save my contact" hint="Signed-in delegates get your name, email and phone as a phone contact." />
      <Toggle on={c.whatsapp} set={set("whatsapp")} label="WhatsApp updates" hint="Room changes and reminders." />
      <Toggle on={c.calls} set={set("calls")} label="Calls from the organizing team" />
      <Toggle on={c.photo} set={set("photo")} label="Conference photos of me may be shared" />
      <p className="text-xs text-muted-foreground">You can change any of these later in <Link to="/me" className="underline">My conference</Link>.</p>
      <Nav onBack={onBack} onNext={finish} last />
    </div>
  );
}

function Toggle({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => set(!on)} className="tap flex w-full items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-left">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 grid size-5 place-items-center rounded-full bg-card shadow transition-all duration-300 ${on ? "left-[1.15rem]" : "left-0.5"}`}>
          {on ? <Check className="size-3 text-primary" /> : null}
        </span>
      </span>
    </button>
  );
}

function Nav({ onBack, onNext, last }: { onBack: () => void; onNext: () => void; last?: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onBack} className="tap rounded-full border border-border px-5 py-3 text-sm">Back</button>
      <button type="button" onClick={onNext} className="tap flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
        {last ? "Finish" : "Continue"}
      </button>
    </div>
  );
}
