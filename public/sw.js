// Khmer Calendar PWA Service Worker (Offline Cache + Web Push)
// The production build injects a content version and the complete file list.
const APP_URL = self.registration.scope;
const APP_PATH = new URL(APP_URL).pathname;
// GitHub Pages projects share an origin, so only manage this installation's caches.
const CACHE_PREFIX = `khmer-cal:${APP_URL}:`;
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_VERSION__`;
const ASSETS_TO_CACHE = /* __PRECACHE_ASSETS__ */ [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE.map(asset => new URL(asset, APP_URL).href));
    })
  );
  // Updates wait for existing tabs to close so HTML and assets stay together.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // These versioned, bundled files are identical for every request. A host's
      // Vary: Origin header must not hide precached JS from module-script requests.
      const cachedResponse = await cache.match(event.request, { ignoreVary: true });
      if (cachedResponse) return cachedResponse;
      if (event.request.mode === 'navigate') {
        const shell = await cache.match(new URL('index.html', APP_URL).href);
        if (shell) return shell;
      }
      // Missing assets must fail normally, never receive HTML as a fallback.
      return fetch(event.request);
    })
  );
});

// iOS 16.4+ Web Push notification listener
function notificationTarget(value) {
  if (typeof value !== 'string') return APP_URL;
  try {
    const url = new URL(value, APP_URL);
    if (url.origin === self.location.origin && url.pathname.startsWith(APP_PATH) && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    // Malformed targets fall back to this installation's home screen.
  }
  return APP_URL;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Khmer Calendar', body: event.data ? event.data.text() : 'Upcoming calendar event' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};

  const title = data.title || 'Khmer Calendar';
  const options = {
    body: data.body || 'Holy Day / Holiday Reminder',
    icon: new URL('icons/app-logo.png', APP_URL).href,
    badge: new URL('icons/apple-touch-icon.png', APP_URL).href,
    data: notificationTarget(data.url),
    tag: data.tag || 'khmer-cal-alert',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = notificationTarget(event.notification.data);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
