// Khmer Calendar PWA Service Worker (Offline Cache)
// The production build injects a content version and the complete file list.
const APP_URL = self.registration.scope;
const APP_PATH = new URL(APP_URL).pathname;
// GitHub Pages projects share an origin, so only manage this installation's caches.
const CACHE_PREFIX = `khmer-cal:${APP_URL}:`;
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_VERSION__`;
const ASSETS_TO_CACHE = /* __PRECACHE_ASSETS__ */ [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Revalidate stable URLs such as index.html instead of copying stale HTTP cache entries.
      // Country assets are offline by first use. Small batches avoid hundreds of
      // simultaneous requests on mobile browsers during a first install.
      for (let offset = 0; offset < ASSETS_TO_CACHE.length; offset += 16) {
        const batch = ASSETS_TO_CACHE.slice(offset, offset + 16)
          .map(asset => new Request(new URL(asset, APP_URL).href, { cache: 'reload' }));
        await cache.addAll(batch);
      }
    })
  );
  // Updates wait for existing tabs to close, or a user-initiated update check.
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SKIP_WAITING' || !event.source?.url) return;
  const source = new URL(event.source.url);
  if (source.origin === self.location.origin && source.pathname.startsWith(APP_PATH)) {
    event.waitUntil(self.skipWaiting());
  }
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
