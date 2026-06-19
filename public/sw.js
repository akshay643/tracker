/* Fiscal service worker — PWA install + notifications.
 * Kept dependency-free. Handles lifecycle, push delivery, and notification
 * clicks. There is no offline asset cache here (the app is localStorage-first);
 * add a cache in `install` if you later want full offline page loads.
 */

self.addEventListener("install", (event) => {
  // Activate this worker immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* Real Web Push (when a server sends one with a VAPID key). Payload is JSON:
 * { "title": "...", "body": "...", "tag": "..." } */
self.addEventListener("push", (event) => {
  let data = { title: "Fiscal", body: "You have a reminder.", tag: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [80, 40, 80],
      data: { url: "/" },
    })
  );
});

/* Focus an existing window (or open one) when a notification is tapped. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
