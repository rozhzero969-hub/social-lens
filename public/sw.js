/* Public app shell only. Never cache authentication responses or private data. */
const VERSION = 'social-lens-v2';
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const SHELL = BASE + '/';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        cache.addAll([SHELL, BASE + '/icons/icon-192.png', BASE + '/icons/icon-512.png']),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('social-lens-') && key !== VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(SHELL, copy));
          }
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }
  if (url.pathname.startsWith(BASE + '/_next/static/') || url.pathname.startsWith(BASE + '/icons/'))
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(SHELL, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const app = windows.find((client) => client.url.startsWith(target));
      return app ? app.focus() : self.clients.openWindow(target);
    }),
  );
});
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification('Social Lens', {
      body: String(payload.body || 'You have a new update.'),
      icon: BASE + '/icons/icon-192.png',
      badge: BASE + '/icons/badge-96.png',
      tag: payload.id || 'social-lens-update',
      data: { url: SHELL },
    }),
  );
});
