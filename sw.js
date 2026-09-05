// Service worker for offline/PWA use on tablets.
// IMPORTANT: this file only manages the Cache Storage API. It never touches
// localStorage or IndexedDB, so save data / collection / decks (which live
// in localStorage via window.storage, see CLAUDE.md) are completely
// unaffected by anything here, including cache eviction on activate.
//
// CACHE_VERSION is bumped automatically by the GitHub Actions deploy
// workflow (each deploy injects the short commit SHA), so every new deploy
// gets a fresh cache namespace and old ones are purged on activate -
// tablets always end up on the latest code after their next reload.
const CACHE_VERSION = '__CACHE_VERSION__';
const SHELL_CACHE = `digimon-tcg-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `digimon-tcg-static-${CACHE_VERSION}`;
const CDN_CACHE = 'digimon-tcg-cdn-art'; // content-hashed filenames -> safe to keep across versions

const SHELL_FILES = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((n) => n.startsWith('digimon-tcg-') && n !== SHELL_CACHE && n !== STATIC_CACHE && n !== CDN_CACHE)
        .map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

function isCdnArtRequest(url) {
  return url.hostname === 'cdn.jsdelivr.net';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Immutable, content-hashed card art from the asset CDN: cache-first.
  if (isCdnArtRequest(url)) {
    event.respondWith(
      caches.open(CDN_CACHE).then((cache) =>
        cache.match(req).then((cached) => cached || fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // let everything else (e.g. other CDNs) pass through untouched

  // Navigations / the HTML shell: network-first so a new deploy is picked
  // up immediately when online; fall back to cache when offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then((res) => {
        caches.open(SHELL_CACHE).then((cache) => cache.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // Other same-origin static assets (image/, music/, SE/, decklist/, back_ground/):
  // stale-while-revalidate so tablets get new files without waiting on network.
  event.respondWith(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
