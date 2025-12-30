/**
 * Service Worker для Affecta PWA
 * Обеспечивает офлайн-работу и кэширование ресурсов
 */

// Версия кэша - ОБЯЗАТЕЛЬНО обновлять при изменениях в JS/CSS файлах!
const CACHE_VERSION = '1.1.0';
const CACHE_NAME = `affecta-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `affecta-runtime-v${CACHE_VERSION}`;

// Ресурсы для кэширования при установке (только статические ресурсы, которые редко меняются)
const PRECACHE_URLS = [
    '/static/images/favicon.svg',
    '/static/images/affecta-logo.svg',
    '/static/images/affecta-logo-dark.svg',
    '/static/manifest.json'
];

// JS файлы, которые должны загружаться с сервера в первую очередь (Network First)
const NETWORK_FIRST_URLS = [
    '/static/js/entry.js',
    '/static/js/dashboard.js',
    '/static/js/analytics.js',
    '/static/js/main.js',
    '/static/js/theme.js',
    '/static/js/pwa.js',
    '/static/css/style.css'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Установка Service Worker v' + CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Кэширование статических ресурсов');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                console.log('[SW] Принудительная активация нового SW');
                return self.skipWaiting();
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('[SW] Активация Service Worker v' + CACHE_VERSION);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Удаляем все кэши, которые не соответствуют текущей версии
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('[SW] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Service Worker активирован, контроль страниц получен');
            return self.clients.claim();
        })
    );
});

// Проверка, нужна ли стратегия Network First для данного URL
function isNetworkFirstUrl(url) {
    return NETWORK_FIRST_URLS.some(path => url.pathname.includes(path) || url.pathname === path);
}

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

    // Пропускаем API запросы (не кэшируем)
    if (url.pathname.startsWith('/save_entry') || 
        url.pathname.startsWith('/get_entry') ||
        url.pathname.startsWith('/get_dashboard_data') ||
        url.pathname.startsWith('/add_') ||
        url.pathname.startsWith('/update_') ||
        url.pathname.startsWith('/delete_')) {
        return;
    }

    // Стратегия: Network First для HTML страниц
    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('text/html')) {
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

    // Стратегия: Network First для JS и CSS файлов (важные обновления)
    if (isNetworkFirstUrl(url)) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Кэшируем успешные ответы
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(RUNTIME_CACHE).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Если сеть недоступна, используем кэш
                    return caches.match(request);
                })
        );
        return;
    }

    // Стратегия: Cache First для остальных статических ресурсов (изображения, шрифты и т.д.)
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

