import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { isCode, nextRoute, PASSWORD_MIN } from "@/lib/onboarding";
import { Lozenge } from "@/components/brand/Loom";
import { mailDelay } from "@/lib/mail-delay";
import aerialAsset from "@/assets/campus-drone.png.asset.json";
const aerial = aerialAsset.url;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "Sign in with an email code, Google or Microsoft." },
      { property: "og:title", content: "Sign in, 11th Pan-IIM WMC" },
      { property: "og:description", content: "Your pass, papers and plan for the 11th Pan-IIM WMC at IIM Shillong." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "code" | "password" | "signup" | "forgot";
type Stage = { verify: "email" | "signup" | "recovery" } | null;

async function landing() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/me";
  const { data: prof } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
  const next: string = nextRoute(prof?.onboarded_at);
  const back = sessionStorage.getItem("after_auth");
  if (back && back.startsWith("/") && !back.startsWith("//") && next !== "/onboarding") {
    sessionStorage.removeItem("after_auth");
    return back;
  }
  return next;
}

function friendly(message: string, status?: number) {
  const m = message.toLowerCase();
  if (m === "network" || m.includes("fetch")) return "Couldn't reach us. Check your connection and try again.";
  if (status === 429 || m.includes("rate") || m.includes("security purposes")) return "Too many requests for this email. Wait a minute, then use the code from your latest email.";
  if (m.includes("invalid login")) return "Email or password doesn't match. Try an email code instead.";
  if (m.includes("expired") || m.includes("invalid")) return "That code no longer works. Use the newest email, or send a new code.";
  return message;
}

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);
const MsLogo = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
);

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("code");
  const [stage, setStage] = useState<Stage>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (user && !stage) landing().then((href) => navigate({ href, replace: true }));
  }, [user, stage, navigate]);

  const [sends, setSends] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ error: { message: string; status?: number | undefined } | null } | void>) => {
    setBusy(true);
    let r: Awaited<ReturnType<typeof fn>>;
    try { r = await fn(); } catch { r = { error: { message: "network" } }; }
    setBusy(false);
    if (r && r.error) { toast.error(friendly(r.error.message, r.error.status)); return false; }
    return true;
  };
  const em = () => email.trim().toLowerCase();
  const RESEND = 60;
  const sentKey = (e: string) => `otp_sent:${e}`;

  async function sendCode(isResend: boolean) {
    const e = em();
    // A code already went out to this inbox recently: show the box instead of cancelling it with a new one.
    const last = Number(localStorage.getItem(sentKey(e)) || 0);
    const age = (Date.now() - last) / 1000;
    if (!isResend && last && age < 3000) {
      setStage({ verify: "email" });
      setCooldown(Math.max(0, Math.ceil(RESEND - age)));
      toast.message("We already sent you a code. Use the one in that email.");
      return;
    }
    const ok = await run(() => supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth` } }));
    if (!ok) return;
    localStorage.setItem(sentKey(e), String(Date.now()));
    setSends((n) => n + 1);
    setCode(""); setCodeError(null);
    setStage({ verify: "email" });
    setCooldown(RESEND);
    if (isResend) toast.success("New code sent. Earlier codes no longer work.");
  }

  async function sso(provider: "google" | "microsoft") {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    setBusy(false);
    if (r.error) toast.error("Couldn't sign in. Try again or use an email code.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "code") {
      // One path for new and returning people: the code signs you in or creates the account.
      await sendCode(false);
    } else if (mode === "password") {
      await run(() => supabase.auth.signInWithPassword({ email: em(), password }));
    } else if (mode === "signup") {
      if (password.length < PASSWORD_MIN) { toast.error(`Use at least ${PASSWORD_MIN} characters.`); return; }
      if (await run(() => supabase.auth.signUp({ email: em(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/onboarding` } }))) {
        setStage({ verify: "signup" });
      }
    } else if (await run(() => supabase.auth.resetPasswordForEmail(em(), { redirectTo: `${window.location.origin}/auth` }))) {
      setStage({ verify: "recovery" });
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (!stage || !isCode(code)) { toast.error("Enter the code from the email."); return; }
    if (stage.verify === "recovery" && newPass.length < PASSWORD_MIN) { toast.error(`New password needs ${PASSWORD_MIN}+ characters.`); return; }
    setBusy(true);
    let res: { error: { message: string; status?: number | undefined } | null };
    try { res = await supabase.auth.verifyOtp({ email: em(), token: code.trim(), type: stage.verify }); }
    catch { res = { error: { message: "network" } }; }
    setBusy(false);
    if (res.error) {
      const m = res.error.message.toLowerCase();
      setCodeError(
        m.includes("expired") || m.includes("invalid")
          ? sends > 1
            ? "That code was replaced by a newer one. Open the most recent email from 11th Pan-IIM WMC and type that code, or tap its Log in button."
            : "That code didn't match. Check the digits, or tap the Log in button in the email."
          : friendly(res.error.message, res.error.status),
      );
      setCode("");
      setShake((n) => n + 1);
      return;
    }
    localStorage.removeItem(sentKey(em()));
    if (stage.verify === "recovery") {
      if (!(await run(() => supabase.auth.updateUser({ password: newPass })))) return;
      toast.success("Password updated.");
    }
    navigate({ href: await landing(), replace: true });
  }

  const input = "auth-field";
  const primary = "auth-key";
  const ssoBtn = "auth-sso";
  const link = "auth-link";
  const delay = mailDelay(email);
  const [confirmResend, setConfirmResend] = useState(false);
  const [shake, setShake] = useState(0);

  const title = stage ? "Check your email" : mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : "Sign in";

  return (
    <AppShell wide>
      <div className="mx-auto grid w-full max-w-md gap-6 md:max-w-none md:grid-cols-[minmax(0,1fr)_26rem] md:items-center md:gap-12 md:pt-6">
        <AuthIntro />
        <div>
        <h1 className="text-display mb-3 text-[1.6rem] leading-tight">{title}</h1>
        <div className="auth-card px-5 py-6">
          {stage ? (
            <form onSubmit={verify} className="space-y-3 rise">
              <div className="auth-envelope" aria-hidden><span className="auth-envelope-flap" /><span className="auth-envelope-card"><Lozenge /></span></div>
              <p className="text-center text-base">Sent to <strong className="break-all">{em()}</strong></p>
              <p className="text-center text-sm text-muted-foreground">Tap the button in the email to sign in straight away, or type its code here. It works for an hour.</p>
              {delay && stage.verify === "email" ? <DelayNote minutes={delay.minutes} kind={delay.kind} /> : null}
              {sends > 1 ? (
                <p className="auth-chip">You've asked for {sends} codes. Only the newest email works.</p>
              ) : null}
              {codeError ? (
                <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{codeError}</p>
              ) : null}
              <label className="block text-sm font-medium" htmlFor="otp">6-digit code</label>
              <div className="relative">
                <input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} autoFocus required value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setCode(v);
                    if (v) setCodeError(null);
                    if (v.length === 6 && stage.verify !== "recovery") setTimeout(() => document.getElementById("otp-go")?.click(), 60);
                  }}
                  className="absolute inset-0 z-10 w-full cursor-text opacity-0" />
                <div aria-hidden key={shake} className={`${shake ? "auth-shake" : ""} grid gap-2 ${code.length > 6 ? "grid-cols-8" : "grid-cols-6"}`}>
                  {Array.from({ length: code.length > 6 ? 8 : 6 }, (_, i) => (
                    <span key={i} className={`otp-box ${code[i] ? "is-filled" : ""} ${i === code.length ? "is-caret" : ""}`}>{code[i] ?? ""}</span>
                  ))}
                </div>
              </div>
              {stage.verify === "recovery" ? (
                <>
                  <label className="block text-sm font-medium" htmlFor="np">New password</label>
                  <input id="np" type="password" autoComplete="new-password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} className={input} />
                </>
              ) : null}
              <button id="otp-go" type="submit" disabled={busy} className={primary}>{busy ? "Checking…" : "Continue"}</button>
              {confirmResend ? (
                <div className="auth-confirm rise" role="alertdialog" aria-label="Send a new code?">
                  <p className="text-sm">A new code cancels the one already on its way. Still send?</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="auth-key is-small" onClick={() => { setConfirmResend(false); sendCode(true); }}>Send new code</button>
                    <button type="button" className="auth-link" onClick={() => setConfirmResend(false)}>Keep waiting</button>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-between">
                <button type="button" onClick={() => { setStage(null); setCode(""); setConfirmResend(false); }} className={link}>Change email</button>
                <button type="button" disabled={busy || cooldown > 0}
                  onClick={() => {
                    if (stage.verify !== "email") { submit({ preventDefault() {} } as React.FormEvent); return; }
                    setConfirmResend(true);
                  }}
                  className={`${link} disabled:no-underline disabled:opacity-50`}>
                  {cooldown > 0 ? <span className="auth-timer" style={{ ["--p" as string]: cooldown / RESEND }}>New code in {cooldown}s</span> : "Didn't get it? Send a new code"}
                </button>
              </div>
              {stage.verify === "email" ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
                  <span>Still waiting?</span>
                  <button type="button" disabled={busy} onClick={() => sso("google")} className={link}>Use Google</button>
                  <button type="button" disabled={busy} onClick={() => sso("microsoft")} className={link}>Use Microsoft</button>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="rise">
              {mode === "code" || mode === "password" ? (
                <>
                  <div className="space-y-2.5">
                    <button type="button" disabled={busy} onClick={() => sso("google")} className={ssoBtn}><GoogleG />Continue with Google</button>
                    <button type="button" disabled={busy} onClick={() => sso("microsoft")} className={ssoBtn}><MsLogo />Continue with Microsoft</button>
                  </div>
                  <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />or use your email<span className="h-px flex-1 bg-border" />
                  </div>
                </>
              ) : null}
              <form key={mode} onSubmit={submit} className="space-y-3">
                {mode === "signup" ? (
                  <>
                    <label className="block text-sm font-medium" htmlFor="nm">Full name</label>
                    <input id="nm" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
                  </>
                ) : null}
                <label className="block text-sm font-medium" htmlFor="em">Email</label>
                <input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" className={input} />
                {mode === "code" && delay ? <DelayNote minutes={delay.minutes} kind={delay.kind} /> : null}
                {mode === "password" || mode === "signup" ? (
                  <>
                    <label className="block text-sm font-medium" htmlFor="pw">Password</label>
                    <input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"} className={input} />
                  </>
                ) : null}
                <button type="submit" disabled={busy} className={primary}>
                  {busy ? "Please wait…" : mode === "code" ? "Email me a code" : mode === "password" ? "Sign in" : mode === "signup" ? "Create account" : "Email me a reset code"}
                </button>
              </form>
              <div className="mt-3 flex flex-wrap justify-between gap-x-4">
                {mode === "code" ? (
                  <button onClick={() => setMode("password")} className={link}>Use a password instead</button>
                ) : mode === "password" ? (
                  <>
                    <button onClick={() => setMode("code")} className={link}>Use an email code</button>
                    <button onClick={() => setMode("forgot")} className={link}>Forgot password?</button>
                    <button onClick={() => setMode("signup")} className={link}>Create account with password</button>
                  </>
                ) : (
                  <button onClick={() => setMode("code")} className={link}>Back to sign in</button>
                )}
              </div>
            </div>
          )}
        </div>
        <ul className="auth-tips mt-4">
          <li><b>Use your registered email.</b> That's how we find your slot and pass.</li>
          <li><b>Not on the list?</b> You get a visitor pass. The desk can link your registration.</li>
          <li><b>Another email?</b> Write to the desk and we'll add it to your profile.</li>
        </ul>
        </div>
      </div>
    </AppShell>
  );
}

function DelayNote({ minutes, kind }: { minutes: string; kind: string }) {
  const who = kind === "government" ? "Government mail" : kind === "institute" ? "University mail" : "This inbox";
  return (
    <div className="auth-note rise" role="note">
      <span className="auth-note-pin" aria-hidden />
      <p><b>{who} can take {minutes} min.</b> Wait for the first email. Asking again cancels it. Google or Microsoft sign-in skips the wait.</p>
    </div>
  );
}

function AuthIntro() {
  return (
    <section className="rise mx-auto w-full max-w-md md:max-w-lg" aria-label="11th Pan-IIM WMC, IIM Shillong, 27 to 29 November 2026">
      <div className="postcard">
        <div className="postcard-photo">
          <img src={aerial} alt="IIM Shillong campus from the air" width={1600} height={1200} fetchPriority="high" />
        </div>
        <div className="stamp" aria-hidden><div className="stamp-in"><b>IIM</b><small>SHILLONG</small></div></div>
        <div className="postcard-foot">
          <div className="min-w-0">
            <p className="text-display text-[1.15rem] leading-tight">11th Pan-IIM WMC</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Lozenge />Umsawli, Shillong</p>
          </div>
          <div className="tickets" aria-hidden>
            <span className="postmark"><span><b>27-29</b><small>NOV 2026</small></span></span>
          </div>
        </div>
      </div>
    </section>
  );
}
