# PWA (Progressive Web App) для Affecta

## Что добавлено

### 📱 Файлы PWA

1. **static/manifest.json** - манифест приложения с метаданными
2. **static/sw.js** - Service Worker для офлайн-работы и кэширования
3. **static/js/pwa.js** - скрипты для установки и обновления PWA
4. **static/images/generate_icons.py** - скрипт генерации иконок

### ✨ Возможности

- ✅ Установка приложения на домашний экран (iOS/Android)
- ✅ Работа в офлайн-режиме
- ✅ Кэширование статических ресурсов
- ✅ Уведомления об обновлениях
- ✅ Быстрая загрузка повторных посещений
- ✅ Нативный вид приложения

## Генерация иконок

### Способ 1: Автоматическая генерация (рекомендуется)

```bash
# Установите необходимые библиотеки
pip install cairosvg pillow

# Перейдите в папку с изображениями
cd static/images

# Запустите скрипт генерации
python generate_icons.py
```

Скрипт создаст PNG иконки всех необходимых размеров:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

### Способ 2: Ручное создание

Если автоматическая генерация не работает, создайте иконки вручную:

1. Откройте `static/images/favicon.svg` в графическом редакторе (Inkscape, Figma, Adobe Illustrator)
2. Экспортируйте в PNG для каждого размера:
   - icon-72x72.png
   - icon-96x96.png
   - icon-128x128.png
   - icon-144x144.png
   - icon-152x152.png
   - icon-192x192.png
   - icon-384x384.png
   - icon-512x512.png
3. Сохраните файлы в папку `static/images/`

### Способ 3: Онлайн-сервисы

Используйте онлайн-генераторы:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

Загрузите `favicon.svg` и скачайте готовые иконки.

## Тестирование PWA

### Chrome DevTools

1. Откройте приложение в Chrome
2. Нажмите F12 (DevTools)
3. Перейдите на вкладку **Application**
4. Проверьте:
   - **Manifest** - корректность манифеста
   - **Service Workers** - статус регистрации
   - **Cache Storage** - кэшированные ресурсы

### Lighthouse

1. Откройте DevTools (F12)
2. Перейдите на вкладку **Lighthouse**
3. Выберите категорию **Progressive Web App**
4. Нажмите **Generate report**

Целевой результат: 90+ баллов

### Установка на устройства

**Android (Chrome):**
1. Откройте приложение в Chrome
2. Нажмите меню (⋮) → "Установить приложение"
3. Подтвердите установку

**iOS (Safari):**
1. Откройте приложение в Safari
2. Нажмите кнопку "Поделиться" (□↑)
3. Выберите "На экран «Домой»"
4. Нажмите "Добавить"

**Desktop (Chrome/Edge):**
1. Откройте приложение
2. Справа в адресной строке появится иконка установки (⊕)
3. Нажмите на неё и подтвердите

## Обновление Service Worker

При изменении кода приложения:

1. Обновите версию в `static/sw.js`:
   ```javascript
   const CACHE_NAME = 'affecta-v1.0.1'; // Увеличьте версию
   ```

2. Service Worker автоматически обнаружит изменения
3. Пользователи увидят уведомление об обновлении
4. После подтверждения приложение обновится

## Офлайн-функциональность

### Что работает офлайн:

- ✅ Просмотр ранее загруженных страниц
- ✅ Просмотр кэшированных данных
- ✅ Базовая навигация

### Что требует интернета:

- ❌ Сохранение новых записей
- ❌ Загрузка новых данных
- ❌ Аутентификация

### Будущие улучшения:

- [ ] Локальное сохранение записей с последующей синхронизацией
- [ ] Background Sync API для автоматической синхронизации
- [ ] Push-уведомления о напоминаниях
- [ ] Полная офлайн-функциональность с IndexedDB

## Отладка

### Проблемы с регистрацией Service Worker

```javascript
// Проверьте консоль браузера
console.log('Service Worker поддерживается:', 'serviceWorker' in navigator);
```

### Очистка кэша

```javascript
// В консоли браузера
caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
```

### Принудительное обновление

```javascript
// В консоли браузера
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
});
```

## Production чеклист

- [ ] Созданы все PNG иконки
- [ ] Протестирована установка на Android
- [ ] Протестирована установка на iOS
- [ ] Протестирована установка на Desktop
- [ ] Lighthouse PWA score > 90
- [ ] Service Worker корректно кэширует ресурсы
- [ ] Офлайн-режим работает
- [ ] Обновления приложения работают корректно
- [ ] Манифест содержит корректные данные
- [ ] HTTPS настроен (обязательно для PWA!)

## Требования

⚠️ **ВАЖНО:** PWA требует HTTPS для работы Service Worker!

В development режиме `localhost` работает без HTTPS.
Для production обязательно настройте SSL сертификат.

## Полезные ссылки

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google: PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

