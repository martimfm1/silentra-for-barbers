'use strict';

const CACHE_PREFIX = 'silentra-static-';
const CACHE_NAME = 'silentra-static-v2';
const PRECACHE_URLS = [
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { body: event.data ? event.data.text() : '' }; }
  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.slice(0, 100) : 'Silentra for Barbers';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 240) : '';
  const target = typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//')
    ? payload.url : '/dashboard';
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icon-192.png', badge: '/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 120) : 'silentra-notification',
    data: { url: target }, renotify: false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requested = event.notification.data && typeof event.notification.data.url === 'string'
    ? event.notification.data.url : '/dashboard';
  const target = new URL(requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only fingerprinted Next.js assets and public app icons are cacheable.
  // HTML documents, authenticated data, cookies, and all /api requests stay network-only.
  const isStaticAsset = url.pathname.startsWith('/_next/static/');
  const isPwaAsset = [
    '/icon-192.png',
    '/icon-512.png',
    '/apple-touch-icon.png',
    '/site.webmanifest',
  ].includes(url.pathname);
  if (!isStaticAsset && !isPwaAsset) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
