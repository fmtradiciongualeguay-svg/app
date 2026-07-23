// FIX: versión del cache — cambiá este número en cada deploy para forzar actualización
const CACHE_NAME = 'fm-tradicion-v4';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.json'
];

// Instalación: cachear activos del shell de la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activación: eliminar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando cache viejo:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // FIX: excluir dominios externos — nunca cachear streams, APIs ni GitHub raw
  if (
    url.includes('script.google.com') ||
    url.includes('googleapis.com') ||
    url.includes('raw.githubusercontent.com') ||
    url.includes('zeno.fm') ||
    url.includes('youtube.com') ||
    url.includes('youtu.be')
  ) {
    return; // dejar que la red lo maneje directamente
  }

  // Solo procesar requests GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Network First: si hay red, actualizar cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin red: servir desde cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Si no hay cache, devolver una respuesta de error legible
          return new Response('<h1>Sin conexión</h1><p>Revisá tu internet e intentá nuevamente.</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      })
  );
});
