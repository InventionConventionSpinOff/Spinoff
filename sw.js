// Service worker for the Spin Off web app: keeps the app and its chart
// library available offline so kicks can be tracked at a field without
// internet. AMIR still needs internet; its requests are never touched here.
// Bump CACHE when the list below changes.
const CACHE = 'spinoff-v1';
const CHART_JS = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
const LOCAL = ['NATIONSPIT.html', 'manifest.webmanifest', 'amir/tips.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const PRECACHE = LOCAL.map(p => new URL(p, self.registration.scope).href).concat(CHART_JS);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    // One missing file must not stop the rest from being cached.
    Promise.all(PRECACHE.map(url => fetch(url, { mode: 'cors' })
      .then(r => r.ok ? cache.put(url, r) : null).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('spinoff-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Stale-while-revalidate, only for GET requests to the files above.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  url.search = '';
  const key = url.href;
  if (!PRECACHE.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(key);
    const fresh = fetch(key, { mode: 'cors' })
      .then(r => { if (r.ok) cache.put(key, r.clone()); return r; })
      .catch(() => null);
    if (cached) { event.waitUntil(fresh); return cached; }
    return (await fresh) || Response.error();
  }));
});
