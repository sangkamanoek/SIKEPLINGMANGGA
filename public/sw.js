/**
 * PWA Service Worker for SI-MANGGA
 * Complies with Google Chrome offline requirements by listening to 'fetch'.
 */

const CACHE_NAME = 'si-mangga-cache-v7';
const ASSETS = [
  '/',
  '/?utm_source=pwa',
  '/index.html',
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
  // Only handle GET requests and exclude Firestore/API/external calls from heavy caching
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, clone and cache it
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback strategy when network fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For SPA navigation requests (e.g. sub-routes or initial load), fall back to /index.html
          if (
            event.request.mode === 'navigate' ||
            (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))
          ) {
            return caches.match('/index.html');
          }
          return undefined;
        });
      })
  );
});
