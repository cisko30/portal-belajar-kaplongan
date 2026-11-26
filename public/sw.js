/* Service Worker — Portal Belajar SMA NU Kaplongan */
const CACHE_NAME = 'pb-kaplongan-v4';
const SHELL_ASSETS = [
  '/',
  '/portal-belajar.html',
  '/auth.html',
  '/dashboard-murid.html',
  '/dashboard-guru.html',
  '/game-quiz.html',
  '/firebase-client.js',
  '/colab-client.js',
  '/migrate.js',
  '/feature-panels.js',
  '/pwa-register.js',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache dynamic API calls, Cloudflare tunnel requests, or config discovery
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/colab-config.json' ||
    url.pathname === '/firebase-config.json'
  ) {
    return;
  }
  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/portal-belajar.html')))
  );
});
