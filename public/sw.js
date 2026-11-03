/*
 * Fönstershowen fungerar utan internet efter första kvällen med internet.
 * Sidor hämtas från nätet först och från minnet om nätet saknas. Filer med versionsnummer i namnet,
 * figurer, WebAssembly och kroppsmodellen sparas och läses från minnet.
 */
const CACHE = 'fonstershowen-v1';
const MAX_ASSETS = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', './stage.html', './favicon.svg']))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, trim) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    if (trim) await trimAssets(cache);
  }
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const response = await refresh;
  if (response) return response;
  return Response.error();
}

/** Gamla byggfiler tas bort när de blir många. De äldsta ligger först. */
async function trimAssets(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.includes('/assets/'));
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(old);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Kroppsmodellen ändras aldrig under samma adress.
  if (url.pathname.endsWith('.task')) {
    event.respondWith(cacheFirst(request, false));
    return;
  }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (request.mode === 'navigate' || path.endsWith('.html') || path.endsWith('/') || path.endsWith('manifest.json')) {
    event.respondWith(networkFirst(request));
  } else if (path.includes('/assets/')) {
    event.respondWith(cacheFirst(request, true));
  } else if (path.includes('/themes/') || path.includes('/mediapipe/') || path.endsWith('.svg')) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});
