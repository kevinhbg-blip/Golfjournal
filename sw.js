// Offline-Cache: App-Seite immer zuerst aus dem Netz (damit Updates sofort ankommen),
// Bilder und Icons aus dem Cache.
const C = 'golf-v3';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest']))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate' || r.url.endsWith('.html')) {
    e.respondWith(fetch(r).then(res => { caches.open(C).then(c => c.put(r, res.clone())); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./'))));
  } else {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) caches.open(C).then(c => c.put(r, res.clone())); return res; })));
  }
});
