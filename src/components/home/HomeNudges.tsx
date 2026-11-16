import { useEffect, useState } from "react";
import { Bell, Share, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { NOTIFY_KEY, notifySupported } from "@/hooks/useAlertNotifier";
import { useInstall } from "@/lib/install";
import { supabase } from "@/integrations/supabase/client";
import { SwipeDeck } from "./SwipeDeck";

const DISMISS = "paniim.nudge.dismissed";
const readDismissed = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(DISMISS) ?? "{}"); } catch { return {}; } };

/** Dismissible Home cards that help a guest set the app up like a phone app. Each comes back after 3 days if dismissed. */
export function HomeNudges({ userId, lead = [] }: { userId: string | null; lead?: React.ReactNode[] }) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const { mode, install } = useInstall();
  useEffect(() => {
    setDismissed(readDismissed());
    setPerm(notifySupported() ? Notification.permission : "unsupported");
    setReady(true);
  }, []);
  if (!ready) return lead.length ? <SwipeDeck label="Updates">{lead}</SwipeDeck> : null;
  const hide = (k: string) => {
    const next = { ...dismissed, [k]: Date.now() };
    setDismissed(next);
    localStorage.setItem(DISMISS, JSON.stringify(next));
  };
  const gone = (k: string) => (dismissed[k] ?? 0) > Date.now() - 3 * 864e5;

  async function enable() {
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") { toast.error("Notifications are blocked", { description: "Turn them on for this site in your browser settings." }); return; }
    localStorage.setItem(NOTIFY_KEY, JSON.stringify({ on: true, schedule: true, general: true }));
    if (userId) await (supabase as any).from("notification_prefs").upsert({ user_id: userId, push_enabled: true });
    toast.success("Notifications on", { description: "We'll tell you about room changes and organizer updates." });
  }

  const cards: React.ReactNode[] = [...lead];
  if (perm === "default" && !gone("notify")) {
    cards.push(
      <Nudge key="notify" icon={<Bell className="h-4 w-4" />} title="Get room changes as they happen" body="Allow notifications so a moved session never catches you out." onClose={() => hide("notify")}>
        <button onClick={enable} className="press rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Turn on</button>
      </Nudge>,
    );
  }
  if (mode === "prompt" && !gone("install")) {
    cards.push(
      <Nudge key="install" icon={<Smartphone className="h-4 w-4" />} title="Add the app to your phone" body="Opens full screen from your home screen, like any other app." onClose={() => hide("install")}>
        <button onClick={() => install()} className="press rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Install</button>
      </Nudge>,
    );
  }
  if (mode === "ios" && !gone("install")) {
    cards.push(
      <Nudge key="install" icon={<Smartphone className="h-4 w-4" />} title="Add the app to your Home Screen" onClose={() => hide("install")}
        body={<>Tap <Share className="inline h-3.5 w-3.5 -translate-y-px" aria-label="Share" /> in Safari, then <b>Add to Home Screen</b>. Notifications on iPhone work once it's added.</>} />,
    );
  }
  if (!cards.length) return null;
  return <SwipeDeck label="Set up the app">{cards}</SwipeDeck>;
}

function Nudge({ icon, title, body, children, onClose }: { icon: React.ReactNode; title: string; body: React.ReactNode; children?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="card-surface rise relative flex h-full items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">{icon}</span>
      <div className="min-w-0 flex-1 pr-6">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
        {children ? <div className="mt-2.5">{children}</div> : null}
      </div>
      <button onClick={onClose} aria-label="Dismiss" className="press absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
