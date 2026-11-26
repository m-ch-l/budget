// Offline cache for the budget tracker.
// Serves the saved copy instantly, then quietly fetches the latest version
// in the background, so updates show up on the next open.
const CACHE = 'budget-v2';
const CORE = ['./', './index.html'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache, so we never store an outdated copy
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // the page itself is stored under one key, whatever is after the "?"
    const key = req.mode === 'navigate' ? './' : req;
    const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    // our own files: always ask GitHub if there's a newer version (a tiny check when nothing changed)
    const update = fetch(sameOrigin ? new Request(req, { cache: 'no-cache' }) : req)
      .then(res => { if ((res.ok || res.type === 'opaque') && !res.redirected) cache.put(key, res.clone()); return res; })
      .catch(() => null);
    if (hit) { e.waitUntil(update); return hit; }
    return (await update) || new Response('Offline', { status: 503 });
  })());
});
