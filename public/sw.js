// Rituel — service worker : notifications push + cache runtime.
//
// Stratégie de cache pensée pour la sécurité (jamais de logique périmée servie) :
//  - /assets/*  : fichiers versionnés par HASH de contenu (Vite) → IMMUABLES → cache-first
//                 (un nouveau déploiement = nouveau hash = nouvelle URL, donc zéro risque de
//                 périmé ; les gros JS/CSS se chargent instantanément aux visites suivantes).
//  - images/icônes : stale-while-revalidate (affichage immédiat depuis le cache, mise à jour
//                    en arrière-plan).
//  - le reste (index.html, /app.legacy.js NON hashé, manifest) : network-first avec repli cache
//                    → l'utilisateur en ligne a TOUJOURS la dernière version ; hors-ligne, repli.
//  - autre origine (Supabase, fonts) et /api/* : laissés au navigateur (jamais mis en cache ici).

const CACHE = 'rituel-v2';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    (async function () {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', function (e) {
  var d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'Rituel', {
      body: d.body || 'Petit rappel tout doux 🌸',
      data: { url: d.url || '/' },
      tag: d.tag || 'rituel',
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      return self.clients.openWindow((e.notification.data && e.notification.data.url) || '/');
    })
  );
});

// ----- Cache runtime -----
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Autre origine (Supabase, Google Fonts…) et API : on ne touche pas, le navigateur gère.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Assets hashés → immuables → cache-first.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(cacheFirst(req));
    return;
  }
  // Images / icônes → stale-while-revalidate.
  if (/\.(webp|png|jpe?g|svg|ico|gif)$/.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // HTML, app.legacy.js, manifest… → réseau d'abord, cache en secours (offline).
  e.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const network = fetch(req)
    .then(function (res) {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(function () {
      return hit;
    });
  return hit || network;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}
