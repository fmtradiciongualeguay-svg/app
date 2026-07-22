const CACHE_NAME = 'fm-tradicion-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Excluir dominios externos de la caché para evitar errores de CORS o datos obsoletos
  if (event.request.url.includes('script.google.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('raw.githubusercontent.com')) {
    return; // Dejar que la red maneje esto directamente
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Network First: Si hay red, actualiza la caché
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback a caché si no hay red
        return caches.match(event.request);
      })
  );
});