import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { announcementsQuery } from "@/lib/conference";
import { showDeviceNotification } from "@/lib/install";

export const NOTIFY_KEY = "paniim.notify";
const SEEN_KEY = "paniim.notify.seen";

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;

/**
 * Shows a device notification for each new organizer alert while the app is
 * open or in a background tab. Respects the person's Me → Notifications choices.
 */
export function useAlertNotifier() {
  const q = useQuery({ ...announcementsQuery, refetchInterval: 60_000, refetchIntervalInBackground: true });
  useEffect(() => {
    if (!q.data || !notifySupported() || Notification.permission !== "granted") return;
    let cfg: { on?: boolean; schedule?: boolean; general?: boolean } = {};
    try { cfg = JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? "{}"); } catch { /* ignore */ }
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null") ?? []);
    const first = !localStorage.getItem(SEEN_KEY);
    for (const a of q.data) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      if (first || !cfg.on) continue; // never flood on first load
      const schedule = a.urgent || a.kind === "schedule" || a.kind === "urgent";
      if (schedule ? cfg.schedule === false : cfg.general === false) continue;
      void showDeviceNotification(a.title, a.body, a.id);
    }
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  }, [q.data]);
}
