import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

/** Called once from the root: registers the worker and catches the browser's install offer. */
export function initInstall() {
  if (typeof window === "undefined") return;
  const framed = window.top !== window.self;
  if (!framed && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    localStorage.setItem("paniim.installed", "1");
    listeners.forEach((l) => l());
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

export const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Install state: `prompt` = we can show the browser dialog, `ios` = show Share sheet steps, `none` = nothing to do. */
export function useInstall() {
  const [, force] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const mode: "prompt" | "ios" | "none" = !ready || isStandalone() || localStorage.getItem("paniim.installed")
    ? "none"
    : deferred ? "prompt" : isIOS() ? "ios" : "none";
  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const r = await deferred.userChoice;
    deferred = null;
    force((n) => n + 1);
    return r.outcome === "accepted";
  }
  return { mode, install };
}

/** Shows a phone notification, through the worker when available (needed on Android). */
export async function showDeviceNotification(title: string, body: string, tag?: string) {
  const opts: NotificationOptions = { body, icon: "/icon-192.png", ...(tag ? { tag } : {}) };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, opts); return; }
  } catch { /* fall through */ }
  new Notification(title, opts);
}
