/* PWA Service Worker – cache-first app shell + SWR per asset
   NOTE icone: NON vengono precache per evitare 404 se non presenti.
*/
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `rt-${CACHE_VERSION}`;

const APP_SHELL = [
  '/', '/index.html',
  '/manifest.webmanifest',
  '/styles/styles.css',
  '/src/main.js',
  '/src/game/engine.js',
  '/src/game/board.js',
  '/src/game/tetrominoes.js',
  '/src/game/input.js',
  '/src/game/audio.js',
  '/src/game/ui.js',
  '/src/game/storage.js',
  '/src/game/utils.js'
  // ATTENZIONE: niente /assets/icons/*
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => (k.startsWith('shell-') || k.startsWith('rt-')) && k !== SHELL_CACHE && k !== RUNTIME_CACHE ? caches.delete(k) : null)
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Non gestire richieste di navigazione verso origin diverso
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Cache-first per l'app shell
  if (APP_SHELL.includes(url.pathname)) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Evita di gestire le icone se mancano (nessun precache); lasciale pass-through con SWR resiliente
  const isIcon = url.pathname.startsWith('/assets/icons/');
  const isMedia = url.pathname.startsWith('/assets/audio/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg');

  if (isIcon || isMedia) {
    // Stale-While-Revalidate
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetchPromise || new Response('', { status: 404 });
    })());
    return;
  }

  // Default: network-first con fallback cache
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
