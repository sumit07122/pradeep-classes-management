// Pradeep Classes Management — Progressive Web App Service Worker
const CACHE_NAME = 'pradeep-classes-v1';

// Static Shell Assets for offline startup
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.svg',
  '/robots.txt'
];

// 1. Install Event — Pre-cache static shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL).catch((err) => {
        console.warn('[PWA SW] Pre-caching static assets failed:', err);
      });
    })
  );
});

// 2. Activate Event — Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA SW] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event — Network-first for Supabase API, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-HTTP(S) schemes (browser extensions, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // A. Supabase API Requests (/rest/v1/* or supabase.co API) -> Network-First
  if (url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cache successful GET responses for offline read fallback
          if (request.method === 'GET' && networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // When offline, attempt to serve cached API response
          if (request.method === 'GET') {
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return new Response(
                JSON.stringify({
                  error: 'Offline Mode: Unable to reach the server. Please check your internet connection.',
                  offline: true
                }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
          }
          return new Response(
            JSON.stringify({
              error: 'Offline Mode: Mutation request failed because there is no network connection.',
              offline: true
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // B. Static Assets (JS, CSS, images, icons, fonts) -> Cache-First
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    STATIC_SHELL.includes(url.pathname) ||
    /\.(?:js|css|png|jpg|jpeg|svg|webp|woff|woff2|ttf|ico)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate: Fetch fresh copy in background if network available
          fetch(request)
            .then((freshResponse) => {
              if (freshResponse && freshResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, freshResponse));
              }
            })
            .catch(() => {/* Ignore background network errors */});
          return cachedResponse;
        }

        // Not in cache, fetch from network and store
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // C. Navigation requests (SPA HTML entry) -> Network-First with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html').then((fallback) => {
            return fallback || caches.match('/');
          });
        })
    );
    return;
  }

  // D. Default strategy -> Fetch with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
