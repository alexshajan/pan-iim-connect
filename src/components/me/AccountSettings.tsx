import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NOTIFY_KEY, notifySupported } from "@/hooks/useAlertNotifier";

const db = supabase as any;

/** Change password (and set one if the person only ever used email codes). */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = pw2.length > 0 && pw !== pw2;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8 || pw !== pw2) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error("Couldn't change your password", { description: /weak|pwned|leak/i.test(error.message) ? "Pick a less common password." : error.message });
      return;
    }
    setPw(""); setPw2(""); setOpen(false);
    toast.success("Password changed", { description: "Use it next time you sign in." });
  }

  return (
    <div className="card-surface px-5 py-4">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <KeyRound className="h-4 w-4 text-primary" strokeWidth={1.9} />
        <span className="flex-1">
          <span className="block text-sm font-semibold">Password</span>
          <span className="block text-xs text-muted-foreground">Change it, or set one if you sign in with email codes.</span>
        </span>
        <span className="text-xs font-semibold text-primary">{open ? "Close" : "Change"}</span>
      </button>
      {open ? (
        <form onSubmit={save} className="mt-3 space-y-2">
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base" />
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type it again" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base" />
          {tooShort || mismatch ? <p className="text-xs text-destructive">{tooShort ? "Use at least 8 characters." : "The two passwords don't match."}</p> : null}
          <button type="submit" disabled={busy || pw.length < 8 || pw !== pw2} className="tap w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

type Prefs = { push_enabled: boolean; schedule_changes: boolean; session_reminders: boolean; general_updates: boolean; email_updates: boolean };
const DEFAULTS: Prefs = { push_enabled: false, schedule_changes: true, session_reminders: true, general_updates: true, email_updates: true };

export function NotificationSettings({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notify-prefs", userId],
    queryFn: async (): Promise<Prefs> => {
      const { data } = await db.from("notification_prefs").select("push_enabled, schedule_changes, session_reminders, general_updates, email_updates").eq("user_id", userId).maybeSingle();
      return data ?? DEFAULTS;
    },
  });
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setPerm(notifySupported() ? Notification.permission : "unsupported"), []);
  const prefs = q.data ?? DEFAULTS;

  async function save(next: Prefs) {
    qc.setQueryData(["notify-prefs", userId], next);
    localStorage.setItem(NOTIFY_KEY, JSON.stringify({ on: next.push_enabled && perm === "granted", schedule: next.schedule_changes, general: next.general_updates }));
    const { error } = await db.from("notification_prefs").upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
    if (error) toast.error("Couldn't save that setting", { description: error.message });
  }

  async function enable() {
    if (!notifySupported()) return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      localStorage.setItem(NOTIFY_KEY, JSON.stringify({ on: true, schedule: prefs.schedule_changes, general: prefs.general_updates }));
      await save({ ...prefs, push_enabled: true });
      new Notification("Notifications are on", { body: "We'll tell you about room changes and your sessions.", icon: "/favicon.png" });
    } else {
      toast.error("Notifications are blocked", { description: "Allow them for this site in your browser settings." });
    }
  }

  const on = prefs.push_enabled && perm === "granted";
  const Row = ({ k, label, hint }: { k: keyof Prefs; label: string; hint: string }) => (
    <label className="flex items-center justify-between gap-3 py-2.5">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input type="checkbox" checked={prefs[k]} onChange={(e) => save({ ...prefs, [k]: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)]" />
    </label>
  );

  return (
    <div className="card-surface px-5 py-4">
      <div className="flex items-center gap-3">
        {on ? <Bell className="h-4 w-4 text-primary" strokeWidth={1.9} /> : <BellOff className="h-4 w-4 text-muted-foreground" strokeWidth={1.9} />}
        <span className="flex-1">
          <span className="block text-sm font-semibold">Notifications</span>
          <span className="block text-xs text-muted-foreground">
            {perm === "unsupported" ? "This browser can't show alerts. On iPhone, add the app to your Home Screen first." : on ? "On for this device." : perm === "denied" ? "Blocked in your browser settings." : "Room changes and reminders, as they happen."}
          </span>
        </span>
        {perm !== "unsupported" ? (
          on ? (
            <button type="button" onClick={() => save({ ...prefs, push_enabled: false })} className="tap rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Turn off</button>
          ) : (
            <button type="button" onClick={enable} disabled={perm === "denied"} className="tap rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Turn on</button>
          )
        ) : null}
      </div>
      <div className="mt-2 divide-y divide-border border-t border-border">
        <Row k="schedule_changes" label="Schedule changes" hint="Room moves, delays, cancellations" />
        <Row k="session_reminders" label="Session reminders" hint="15 minutes before your sessions" />
        <Row k="general_updates" label="General updates" hint="Announcements from the organizers" />
        <label className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              <span className="block text-sm">Also by email</span>
              <span className="block text-xs text-muted-foreground">Important changes reach your inbox too</span>
            </span>
          </span>
          <input type="checkbox" checked={prefs.email_updates} onChange={(e) => save({ ...prefs, email_updates: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)]" />
        </label>
      </div>
    </div>
  );
}
