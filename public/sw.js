/**
 * Atlas Fitness service worker — static shell + hashed assets only.
 *
 * Precache list MUST match `PRECACHE_URLS` in lib/pwa/sw-policy.ts.
 * Do NOT cache `/api/*` (auth cookies + workouts stay on the network).
 * Do NOT implement Background Sync or offline workout queues.
 */
const CACHE_NAME = 'atlas-shell-v1';
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
];

function shouldBypass(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return true;
  }
  return url.pathname.startsWith('/api/');
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (shouldBypass(event.request, url)) {
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
  }
});
