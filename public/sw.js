const CACHE_NAME = 'gestao-livinha-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isNavigation = request.mode === 'navigate' || request.destination === 'document';

  if (isNavigation) {
    // Network-first para navegações (o HTML/shell da página): garante que,
    // após um deploy, o usuário sempre recebe o app novo quando está online.
    // O cache só entra como fallback quando a rede falha (uso offline).
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Cache-first para assets estáticos (JS/CSS/imagens): seguro porque o
  // Next.js já inclui hash no nome de cada arquivo — um arquivo com hash
  // antigo em cache nunca é referenciado pelo HTML novo.
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});
