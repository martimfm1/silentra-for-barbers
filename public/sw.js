'use strict';

const CACHE_PREFIX = 'silentra-static-';
const CACHE_NAME = 'silentra-static-v1';
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
