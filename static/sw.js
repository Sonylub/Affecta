// Service Worker для Стабил
const CACHE_NAME = 'stabil-v1.0.0';
const urlsToCache = [
  '/',
  '/static/manifest.json',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/login',
  '/register',
  '/dashboard',
  '/daily-entry',
  '/analytics'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Перехват сетевых запросов
self.addEventListener('fetch', event => {
  // Пропускаем запросы к API и POST запросы
  if (event.request.url.includes('/api/') || event.request.method === 'POST') {
    return;
  }
  
  // Пропускаем Chrome Extension запросы
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем кэшированный ответ или делаем сетевой запрос
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }
        
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Кэшируем успешные ответы
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed', error);
            
            // Возвращаем fallback для офлайн режима
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// Синхронизация фоновых задач
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'sync-daily-entry') {
    event.waitUntil(syncDailyEntry());
  }
});

// Push уведомления
self.addEventListener('push', event => {
  console.log('Service Worker: Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'Напоминание от Стабил',
    icon: '/static/icons/icon-192.png',
    badge: '/static/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open-app',
        title: 'Открыть приложение',
        icon: '/static/icons/shortcut-add.png'
      },
      {
        action: 'close',
        title: 'Закрыть',
        icon: '/static/icons/close.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Стабил', options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification click received');
  
  event.notification.close();
  
  if (event.action === 'open-app') {
    event.waitUntil(
      clients.openWindow('/daily-entry')
    );
  } else if (event.action === 'close') {
    // Просто закрыть уведомление
  } else {
    // Открыть приложение по умолчанию
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Фоновая синхронизация записей
async function syncDailyEntry() {
  try {
    console.log('Service Worker: Syncing daily entry');
    
    // Здесь будет логика синхронизации с сервером
    // Пока просто логируем
    
    return Promise.resolve();
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
    throw error;
  }
}

// Обработка сообщений от клиента
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Обработка ошибок
self.addEventListener('error', event => {
  console.error('Service Worker: Error', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker: Unhandled rejection', event.reason);
});