// Service Worker für Borbarad DSA Tool
// Datei: sw.js (im Stammverzeichnis)

const CACHE_NAME = 'borbarad-dsa-v1.2.0';
const STATIC_CACHE = 'borbarad-static-v1';
const DYNAMIC_CACHE = 'borbarad-dynamic-v1';

// Dateien, die immer gecacht werden sollen
const STATIC_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/responsive.css',
  '/js/auth.js',
  '/js/calendar.js', 
  '/js/components.js',
  '/js/diary.js',
  '/js/heroes.js',
  '/js/home.js',
  '/js/nscs.js',
  '/js/objects.js',
  '/js/open.js',
  '/js/router.js',
  '/js/state.js',
  '/js/supabaseClient.js',
  '/js/tags.js',
  '/js/utils.js',
  '/js/mobile-enhancements.js',
  '/manifest.json'
];

// Netzwerk-Ressourcen, die gecacht werden können
const CACHEABLE_DOMAINS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Installation
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Installation failed:', err);
      })
  );
});

// Aktivierung
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch-Ereignisse abfangen
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Nur GET-Anfragen cachen
  if (request.method !== 'GET') {
    return;
  }
  
  // Supabase-Anfragen nicht cachen (immer live Daten)
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Fallback für Offline-Modus
          return new Response(
            JSON.stringify({ error: 'Offline - keine Verbindung zur Datenbank' }),
            { 
              headers: { 'Content-Type': 'application/json' },
              status: 503
            }
          );
        })
    );
    return;
  }
  
  // Statische Dateien - Cache First
  if (STATIC_FILES.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          return cachedResponse || fetch(request)
            .then(networkResponse => {
              return caches.open(STATIC_CACHE)
                .then(cache => {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
                });
            });
        })
        .catch(() => {
          // Offline-Fallback für HTML-Seiten
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        })
    );
    return;
  }
  
  // Externe Ressourcen (CDN) - Stale While Revalidate
  if (CACHEABLE_DOMAINS.some(domain => url.hostname.includes(domain))) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          return cache.match(request)
            .then(cachedResponse => {
              const fetchPromise = fetch(request)
                .then(networkResponse => {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
                })
                .catch(() => cachedResponse); // Fallback auf Cache bei Netzwerkfehler
              
              return cachedResponse || fetchPromise;
            });
        })
    );
    return;
  }
  
  // Bilder - Cache First mit Fallback
  if (request.headers.get('accept').includes('image/')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          return cachedResponse || fetch(request)
            .then(networkResponse => {
              // Nur erfolgreiche Antworten cachen
              if (networkResponse.status === 200) {
                caches.open(DYNAMIC_CACHE)
                  .then(cache => cache.put(request, networkResponse.clone()));
              }
              return networkResponse;
            })
            .catch(() => {
              // Fallback-Bild für fehlende Bilder
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="#333"/><text x="20" y="25" text-anchor="middle" fill="#ccc" font-size="12">?</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            });
        })
    );
    return;
  }
  
  // Alles andere - Network First
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Background Sync für Offline-Aktionen
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Push-Nachrichten (für zukünftige Features)
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');
  
  const options = {
    body: event.data ? event.data.text() : 'Neue Kampagnen-Updates verfügbar',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    tag: 'borbarad-update',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Öffnen'
      },
      {
        action: 'dismiss',
        title: 'Verwerfen'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Borbarad DSA', options)
  );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Hilfsfunktionen
async function syncOfflineData() {
  console.log('[SW] Syncing offline data...');
  
  try {
    // Hier würden offline gespeicherte Änderungen mit dem Server synchronisiert
    const offlineData = await getOfflineData();
    
    if (offlineData.length > 0) {
      // Daten an Server senden
      await sendDataToServer(offlineData);
      await clearOfflineData();
      console.log('[SW] Offline data synced successfully');
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

async function getOfflineData() {
  // IndexedDB oder localStorage für offline Daten
  return [];
}

async function sendDataToServer(data) {
  // Implementation für Server-Sync
  return Promise.resolve();
}

async function clearOfflineData() {
  // Offline-Daten nach erfolgreichem Sync löschen
  return Promise.resolve();
}

// Neue Version verfügbar - Client benachrichtigen
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker loaded');