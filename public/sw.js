/**
 * PWA Service Worker for SI-MANGGA
 * Complies with Google Chrome offline requirements by listening to 'fetch'.
 */

const CACHE_NAME = 'si-mangga-cache-v8';
const ASSETS = [
  '/logo_192.png',
  '/logo_512.png',
  '/logo_maskable.png',
  '/logo_pemko_medan.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((asset) => {
          return cache.add(asset).catch((err) => {
            console.warn('[SW] Failed to cache:', asset, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and exclude Firestore/API/external calls from caching
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isHtmlNav =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isHtmlNav) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' })).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
