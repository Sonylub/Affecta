/**
 * Service Worker для Affecta PWA
 * Обеспечивает офлайн-работу и кэширование ресурсов
 */

const CACHE_NAME = 'affecta-v1.0.0';
const RUNTIME_CACHE = 'affecta-runtime';

// Ресурсы для кэширования при установке
const PRECACHE_URLS = [
    '/',
    '/static/css/style.css',
    '/static/js/main.js',
    '/static/js/theme.js',
    '/static/images/favicon.svg',
    '/static/images/affecta-logo.svg',
    '/static/images/affecta-logo-dark.svg',
    '/static/manifest.json'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Установка Service Worker');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Кэширование ресурсов');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('[SW] Активация Service Worker');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('[SW] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Обработка запросов
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Пропускаем запросы к внешним ресурсам (CDN)
    if (!url.origin.includes(self.location.origin)) {
        return;
    }

    // Пропускаем POST, PUT, DELETE запросы
    if (request.method !== 'GET') {
        return;
    }

    // Стратегия: Network First для HTML страниц
    if (request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Клонируем ответ для кэширования
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Если сеть недоступна, пытаемся взять из кэша
                    return caches.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Возвращаем офлайн-страницу
                            return caches.match('/');
                        });
                })
        );
        return;
    }

    // Стратегия: Cache First для статических ресурсов
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request).then(response => {
                    // Кэшируем только успешные ответы
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }

                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(request, responseClone);
                    });

                    return response;
                });
            })
    );
});

// Обработка сообщений от клиента
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Синхронизация в фоне (для будущего использования)
self.addEventListener('sync', event => {
    console.log('[SW] Фоновая синхронизация:', event.tag);
    if (event.tag === 'sync-entries') {
        event.waitUntil(syncEntries());
    }
});

// Функция синхронизации записей (заглушка для будущего)
async function syncEntries() {
    console.log('[SW] Синхронизация записей');
    // Здесь будет логика синхронизации локальных записей с сервером
}

// Push уведомления (для будущего использования)
self.addEventListener('push', event => {
    console.log('[SW] Push уведомление получено');
    const options = {
        body: event.data ? event.data.text() : 'Новое уведомление от Affecta',
        icon: '/static/images/icon-192x192.png',
        badge: '/static/images/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('Affecta', options)
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
    console.log('[SW] Клик по уведомлению');
    event.notification.close();

    event.waitUntil(
        clients.openWindow('/')
    );
});

