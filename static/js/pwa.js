/**
 * PWA инициализация и управление для Affecta
 */

(function() {
    'use strict';

    // Проверка поддержки Service Worker
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker не поддерживается');
        return;
    }

    // Регистрация Service Worker
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(registration => {
                console.log('Service Worker зарегистрирован:', registration.scope);

                // Проверка обновлений каждые 60 секунд
                setInterval(() => {
                    registration.update();
                }, 60000);

                // Обработка обновлений
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Найдено обновление Service Worker');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Показываем уведомление о доступном обновлении
                            showUpdateNotification(newWorker);
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Ошибка регистрации Service Worker:', error);
            });

        // Обработка изменений в контроллере
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Service Worker обновлён, перезагрузка страницы');
            window.location.reload();
        });

        // Обработка сообщений от Service Worker
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log('Service Worker обновлён до версии', event.data.version);
                // Перезагружаем страницу через небольшую задержку, чтобы пользователь увидел сообщение
                setTimeout(() => {
                    window.location.reload(true); // Принудительная перезагрузка с очисткой кеша
                }, 1000);
            }
        });
    });

    // Показ уведомления об обновлении
    function showUpdateNotification(worker) {
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-indigo-600 text-white rounded-lg shadow-lg p-4 z-50 transition-all duration-300';
        notification.innerHTML = `
            <div class="flex items-start gap-3">
                <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <div class="flex-1">
                    <h4 class="font-semibold mb-1">Доступно обновление</h4>
                    <p class="text-sm text-indigo-100 mb-3">Новая версия Affecta готова к установке</p>
                    <div class="flex gap-2">
                        <button id="update-btn" class="bg-white text-indigo-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-50 transition">
                            Обновить
                        </button>
                        <button id="dismiss-btn" class="bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-800 transition">
                            Позже
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Обработчик кнопки обновления
        document.getElementById('update-btn').addEventListener('click', () => {
            worker.postMessage({ type: 'SKIP_WAITING' });
            notification.remove();
        });

        // Обработчик кнопки "Позже"
        document.getElementById('dismiss-btn').addEventListener('click', () => {
            notification.remove();
        });
    }

    // Обработка установки PWA
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('Событие beforeinstallprompt');
        e.preventDefault();
        deferredPrompt = e;
        showInstallPromotion();
    });

    // Показ предложения установить приложение
    function showInstallPromotion() {
        // Проверяем, не отклонял ли пользователь установку ранее
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedDate = new Date(dismissed);
            const now = new Date();
            const daysSinceDismissed = (now - dismissedDate) / (1000 * 60 * 60 * 24);
            
            // Показываем снова через 7 дней
            if (daysSinceDismissed < 7) {
                return;
            }
        }

        // Показываем баннер установки через 30 секунд после загрузки
        setTimeout(() => {
            const banner = document.createElement('div');
            banner.className = 'fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 border border-gray-200 dark:border-gray-700 transition-all duration-300';
            banner.innerHTML = `
                <div class="flex items-start gap-3">
                    <img src="/static/images/favicon.svg" alt="Affecta" class="w-12 h-12 rounded-lg">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">Установить Affecta</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Установите приложение для быстрого доступа и работы офлайн
                        </p>
                        <div class="flex gap-2">
                            <button id="install-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition">
                                Установить
                            </button>
                            <button id="dismiss-install-btn" class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                                Не сейчас
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(banner);

            // Обработчик кнопки установки
            document.getElementById('install-btn').addEventListener('click', async () => {
                banner.remove();
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log('Результат установки:', outcome);
                    deferredPrompt = null;
                }
            });

            // Обработчик кнопки "Не сейчас"
            document.getElementById('dismiss-install-btn').addEventListener('click', () => {
                banner.remove();
                localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
            });
        }, 30000);
    }

    // Отслеживание успешной установки
    window.addEventListener('appinstalled', () => {
        console.log('PWA успешно установлено');
        deferredPrompt = null;
        
        // Показываем уведомление об успешной установке
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-green-600 text-white rounded-lg shadow-lg p-4 z-50';
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="font-medium">Affecta успешно установлен!</span>
            </div>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    });

    // Определение режима отображения
    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    // Добавляем класс для PWA режима
    if (isStandalone()) {
        document.documentElement.classList.add('pwa-standalone');
        console.log('Приложение запущено в режиме PWA');
    }

    // Экспорт функций
    window.PWA = {
        isStandalone,
        showInstallPrompt: () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
            }
        }
    };

})();

