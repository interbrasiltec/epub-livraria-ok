const CACHE_NAME = 'ebookpedia-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ebookpedia-neon-192.png',
  '/ebookpedia-neon-512.png'
];

// Determine if the Service Worker is running on a development sandbox or localhost
const isDevelopment = 
  self.location.hostname === 'localhost' || 
  self.location.hostname === '127.0.0.1' || 
  self.location.hostname.includes('ais-dev') || 
  self.location.hostname.includes('.run.app') || 
  self.location.hostname.includes('gitpod') || 
  self.location.hostname.includes('idx-dev');

if (isDevelopment) {
  console.log('[Service Worker] Executando em modo de desenvolvimento. Caching desativado para evitar assets obsoletos.');

  self.addEventListener('install', (event) => {
    // Force immediate activation
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[Service Worker] Limpando cache antigo em desenvolvimento:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', (event) => {
    // Pass-through: Do not intercept or cache any request in development
    return;
  });
} else {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Caching app shell assets');
        return cache.addAll(ASSETS_TO_CACHE);
      }).then(() => self.skipWaiting())
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Removing old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', (event) => {
    // Let the browser handle external APIs or /api requests without service worker intervention
    if (event.request.url.includes('/api/')) {
      return;
    }
    
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          // Cache new successful GET requests of static assets if reasonable
          if (
            event.request.method === 'GET' && 
            response && 
            response.status === 200 && 
            (response.type === 'basic' || response.type === 'cors')
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch((err) => {
          console.log('[Service Worker] Fetch failed, returning offline fallback if HTML', err);
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
    );
  });
}
