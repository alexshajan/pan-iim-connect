import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, HandHelping, Lock, MessageCircle, Nfc, RefreshCw, Smartphone, Sparkles, UserRound, Wifi, Linkedin, Contact } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { myPersonQuery } from "@/lib/registry-data";
import { cardUrl } from "@/lib/card-qr";
import { normalizeCode } from "@/lib/phase";

export const Route = createFileRoute("/card/setup")({
  head: () => ({
    meta: [
      { title: "Set up your card, 11th Pan-IIM WMC" },
      { name: "description", content: "This card isn't set up yet. Link it to your delegate code in a minute with your phone." },
      { property: "og:title", content: "Set up your Pan-IIM WMC card" },
      { property: "og:description", content: "Write your delegate link to this NFC card with your phone, or ask a volunteer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { code?: string } => (typeof s["code"] === "string" ? { code: s["code"] } : {}),
  component: SetupPage,
});

const STORE = {
  android: "https://play.google.com/store/apps/details?id=com.wakdev.wdnfc",
  iphone: "https://apps.apple.com/app/nfc-tools/id1252962749",
};
type WriteState = "idle" | "waiting" | "done" | "error";

const HELP = "https://wa.me/916909023581?text=" + encodeURIComponent("Hi, I need help setting up my WMC card");

function TapHero() {
  return (
    <div className="relative mx-auto flex h-56 w-full max-w-xs items-center justify-center">
      <div className="card-float relative h-44 w-28 rounded-lg bg-primary shadow-xl">
        <div className="absolute inset-x-0 top-3 mx-auto h-2 w-8 rounded-full bg-background/40" />
        <div className="absolute inset-x-3 bottom-4 space-y-1.5">
          <div className="h-2 w-3/4 rounded-sm bg-primary-foreground/70" />
          <div className="h-1.5 w-1/2 rounded-sm bg-primary-foreground/40" />
        </div>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-foreground"><Nfc className="size-7" /></span>
        {[0, 1, 2].map((i) => <span key={i} className="nfc-ring absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary" style={{ animationDelay: `${i * 0.6}s` }} />)}
      </div>
      <div className="phone-tap absolute right-4 top-6 flex h-32 w-16 items-center justify-center rounded-xl border-4 border-foreground bg-background shadow-lg">
        <Smartphone className="size-5 text-muted-foreground" />
      </div>
    </div>
  );
}

const STEPS = {
  android: [
    { t: "Install NFC Tools", d: "Free on Play Store, by wakdev.", href: "https://play.google.com/store/apps/details?id=com.wakdev.wdnfc" },
    { t: "Write → Add a record → URL", d: "Paste your link from above." },
    { t: "Tap Write, hold card to phone back", d: "Centre of the phone, 2 seconds." },
  ],
  iphone: [
    { t: "Install NFC Tools", d: "Free on the App Store, by wakdev.", href: "https://apps.apple.com/app/nfc-tools/id1252962749" },
    { t: "Write → Add a record → URL", d: "Paste your link from above." },
    { t: "Tap Write, hold card at the top", d: "Near the camera, until it buzzes." },
  ],
};

function SetupPage() {
  const { user } = useAuth();
  const me = useQuery({ ...myPersonQuery(user?.id ?? null), enabled: !!user, retry: false });
  const myCode = (me.data as { delegate_code?: string } | null | undefined)?.delegate_code ?? null;
  const pre = Route.useSearch().code;
  const [typed, setTyped] = useState(pre ?? "");
  const code = myCode ?? (typed.trim().length >= 3 ? normalizeCode(typed) : null);
  const url = code ? cardUrl(code, "nfc") : null;
  const [os, setOs] = useState<"android" | "iphone">("android");
  const [webNfc, setWebNfc] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ws, setWs] = useState<WriteState>("idle");
  const [err, setErr] = useState("");
  const written = ws === "done";
  const [step, setStep] = useState(0);

  useEffect(() => {
    setWebNfc("NDEFReader" in window);
    if (/iPhone|iPad/i.test(navigator.userAgent)) setOs("iphone");
  }, []);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    navigator.vibrate?.(20);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function writeNow() {
    if (!url) return;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 30000);
    try {
      setWs("waiting"); setErr("");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = new (window as any).NDEFReader();
      await w.write({ records: [{ recordType: "url", data: url }] }, { overwrite: true, signal: ctl.signal });
      navigator.vibrate?.([40, 50, 40]);
      setWs("done");
      toast.success("Card written. Tap it to test.");
    } catch (e) {
      const n = (e as Error).name;
      setWs("error");
      setErr(n === "NotAllowedError" ? "NFC permission was blocked. Allow NFC for this site in Chrome settings, then try again."
        : n === "NotSupportedError" ? "NFC is off or this phone can't write. Turn on NFC in phone settings, or use NFC Tools below."
        : n === "AbortError" ? "No card found in 30 seconds. Hold it flat on the back of the phone and try again."
        : n === "NetworkError" ? "The card moved away too soon. Hold it still for 2 seconds."
        : (e as Error).message || "Couldn't write. Try NFC Tools below.");
    } finally { clearTimeout(t); }
  }

  return (
    <AppShell eyebrow="Card" title="This card isn't set up yet">
      <div className="space-y-5">
        <section className="pass rise overflow-hidden px-5 py-5 text-center">
          <TapHero />
          <p className="text-display text-xl">A blank card, waiting for you</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Write your delegate link on it once. After that, every tap opens your profile and swaps contacts.</p>
        </section>

        <section className="pass px-5 py-5">
          <Num n={1} t="Your link" />
          {myCode ? (
            <p className="mt-2 text-sm">Signed in as <b className="tabular-nums">{myCode}</b></p>
          ) : (
            <div className="mt-2 space-y-2">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your WMC code, e.g. WMC-AB3K" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm uppercase tabular-nums" />
              {!user && <Link to="/auth" onClick={() => sessionStorage.setItem("after_auth", "/card/setup")} className="tap inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><UserRound className="size-3.5" /> Don't know it? Sign in and we'll fill it</Link>}
            </div>
          )}
          {url && (
            <button onClick={copy} className="tap pop-in mt-3 flex w-full items-center gap-2 rounded-lg bg-secondary px-3 py-3 text-left text-xs">
              <span className="min-w-0 flex-1 truncate tabular-nums">{url}</span>
              <span className="flex shrink-0 items-center gap-1 font-semibold text-primary">{copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}</span>
            </button>
          )}
          {url && webNfc && (
            <div className="mt-3">
              {ws === "waiting" ? (
                <div className="pop-in relative overflow-hidden rounded-lg bg-primary/10 px-4 py-6 text-center">
                  {[0, 1].map((i) => <span key={i} className="nfc-radar absolute left-1/2 top-1/2 size-20 rounded-full border-2 border-primary" style={{ animationDelay: `${i * 0.8}s` }} />)}
                  <Nfc className="relative mx-auto size-8 text-primary" />
                  <p className="relative mt-2 text-sm font-semibold">Hold the card flat on the back of your phone</p>
                  <p className="relative text-xs text-muted-foreground">Keep it still until it buzzes</p>
                </div>
              ) : (
                <button onClick={writeNow} className="tap btn-sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
                  {written ? <><Check className="size-4" /> Written! Write again</> : <><Nfc className="size-4" /> Write it now from this phone</>}
                </button>
              )}
              {ws === "error" && <p className="pop-in mt-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{err}</p>}
              {written && <a href={url} className="tap mt-2 block text-center text-xs font-semibold text-primary">Now tap the card to test it</a>}
            </div>
          )}
          {url && !webNfc && (
            <div className="mt-3 rounded-lg bg-accent/40 px-3 py-3 text-xs">
              <p className="font-semibold">This browser can't write cards directly.</p>
              <p className="mt-0.5 text-muted-foreground">{os === "iphone" ? "iPhones need a free app to write NFC cards." : "Open this page in Chrome on Android to write in one tap, or use the free app."}</p>
              <a href={STORE[os]} target="_blank" rel="noreferrer" className="tap mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 font-semibold text-background">
                <Smartphone className="size-3.5" /> Get NFC Tools on {os === "iphone" ? "App Store" : "Google Play"}
              </a>
            </div>
          )}
        </section>

        <section className="pass px-5 py-5">
          <Num n={2} t="Write it with your phone" />
          <div className="mt-3 inline-flex rounded-full bg-secondary p-1 text-xs font-semibold">
            {(["android", "iphone"] as const).map((k) => (
              <button key={k} onClick={() => { setOs(k); setStep(0); }} className={`tap rounded-full px-4 py-1.5 transition-colors ${os === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{k === "android" ? "Android" : "iPhone"}</button>
            ))}
          </div>
          <ol className="mt-4 space-y-2">
            {STEPS[os].map((s, i) => (
              <li key={s.t + os}>
                <button onClick={() => setStep(i)} className={`tap flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${step === i ? "bg-primary/10 translate-x-1" : ""}`}>
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors ${step > i ? "bg-primary text-primary-foreground" : step === i ? "border-2 border-primary text-primary" : "bg-muted text-muted-foreground"}`}>{step > i ? <Check className="size-3.5" /> : i + 1}</span>
                  <span><span className="block text-sm font-semibold">{s.t}</span><span className="block text-xs text-muted-foreground">{s.d}</span>{"href" in s && s.href ? <a href={s.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 inline-block text-xs font-semibold text-primary underline">Download</a> : null}</span>
                </button>
              </li>
            ))}
          </ol>
          <button onClick={() => setStep((s) => Math.min(s + 1, 3))} className="tap mt-3 w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold">
            {step >= 3 ? "Done. Tap your card to test" : step === 2 ? "Finished writing" : "Next step"}
          </button>
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-accent/40 px-3 py-2.5 text-xs"><Lock className="mt-0.5 size-3.5 shrink-0" /> Don't use “Lock” or “Make read-only”. It's permanent, and you couldn't reuse the card later.</p>
        </section>

        <section className="pass px-5 py-5">
          <Num n={3} t="What your card does here" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Perk icon={HandHelping} t="Swap contacts" d="Tap someone's card, you're both saved." />
            <Perk icon={UserRound} t="Show your profile" d="Papers, institution, links." />
            <Perk icon={Sparkles} t="People I've met" d="With notes, after every tap." />
            <Perk icon={Contact} t="Save to phone" d="One-tap contact card." />
          </div>
        </section>

        <section className="pass px-5 py-5">
          <Num n={4} t="Keep it after 29 Nov" />
          <p className="mt-2 text-sm text-muted-foreground">It's a real NFC card. Rewrite it any time with any link:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[{ i: Linkedin, t: "LinkedIn" }, { i: Contact, t: "Your contact" }, { i: Wifi, t: "Home Wi‑Fi" }, { i: RefreshCw, t: "Any website" }].map(({ i: I, t }, k) => (
              <span key={t} className="pop-in inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold" style={{ animationDelay: `${k * 80}ms` }}><I className="size-3.5" /> {t}</span>
            ))}
          </div>
        </section>

        <section className="pass flex items-center gap-3 px-5 py-4">
          <HandHelping className="size-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Stuck, or don't know your code?</p>
            <p className="text-xs text-muted-foreground">Hand it to any volunteer in a blue lanyard, or the Help Desk.</p>
          </div>
          <a href={HELP} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"><MessageCircle className="size-3.5" /> Chat</a>
        </section>
      </div>
    </AppShell>
  );
}

function Num({ n, t }: { n: number; t: string }) {
  return <h2 className="flex items-center gap-2 text-sm font-bold"><span className="flex size-6 items-center justify-center rounded-sm bg-foreground text-xs text-background tabular-nums">{n}</span>{t}</h2>;
}

function Perk({ icon: I, t, d }: { icon: typeof Nfc; t: string; d: string }) {
  return (
    <div className="tap group rounded-lg bg-secondary px-3 py-3 transition-transform active:scale-95">
      <I className="size-5 text-primary transition-transform group-hover:-rotate-6 group-hover:scale-110" />
      <p className="mt-1.5 text-sm font-semibold">{t}</p>
      <p className="text-xs leading-snug text-muted-foreground">{d}</p>
    </div>
  );
}
