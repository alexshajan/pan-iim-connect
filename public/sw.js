// Minimal worker: makes the app installable and lets alerts show as phone notifications.
// No page caching, so guests always get the latest schedule.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Pan-IIM WMC", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Pan-IIM WMC", { body: d.body || "", icon: "/icon-192.png", tag: d.tag, data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
