/* Phase 6 PWA: static-asset caching + offline fallback page.
 * Never caches the API (/api) or Socket.IO traffic — those always hit the network.
 */
const CACHE = 'pm-static-v1';
const PRECACHE = ['/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // Pages/documents: network-first, fall back to cache then the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  const copy = res.clone();
  caches.open(CACHE).then((cache) => cache.put(req, copy));
  return res;
}

async function networkFirstPage(req) {
  try {
    return await fetch(req);
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match(req)) ?? (await cache.match('/offline.html'));
  }
}
