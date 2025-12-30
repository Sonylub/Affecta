# Генерация иконок PWA для Affecta

## Проблема с Cairo на Windows

На Windows библиотека `cairosvg` требует системную библиотеку Cairo, которую сложно установить. Это нормально и ожидаемо.

## Решение: Используйте упрощенный скрипт

### Вариант 1: Простой Python скрипт (рекомендуется для Windows)

```bash
# Убедитесь, что Pillow установлен
pip install pillow

# Перейдите в папку с изображениями
cd static/images

# Запустите упрощенный скрипт
python generate_icons_simple.py
```

Этот скрипт создаст упрощенные, но красивые иконки в стиле Affecta.

### Вариант 2: Онлайн-генератор (самый простой)

1. Откройте https://realfavicongenerator.net/
2. Загрузите файл `static/images/favicon.svg`
3. Настройте параметры:
   - iOS: оставьте как есть
   - Android: выберите "Use a solid color" → #4F46E5
   - Windows: оставьте как есть
4. Нажмите "Generate your Favicons and HTML code"
5. Скачайте архив
6. Из архива возьмите файлы:
   - android-chrome-72x72.png → переименуйте в icon-72x72.png
   - android-chrome-96x96.png → переименуйте в icon-96x96.png
   - android-chrome-144x144.png → переименуйте в icon-144x144.png
   - android-chrome-192x192.png → переименуйте в icon-192x192.png
   - android-chrome-512x512.png → переименуйте в icon-512x512.png
7. Для остальных размеров (128, 152, 384) используйте любой редактор изображений для изменения размера

### Вариант 3: Графический редактор

1. Откройте `favicon.svg` в:
   - Inkscape (бесплатно): https://inkscape.org/
   - Adobe Illustrator
   - Figma (онлайн)
   - GIMP (бесплатно)

2. Экспортируйте в PNG для каждого размера:
   - 72x72, 96x96, 128x128, 144x144
   - 152x152, 192x192, 384x384, 512x512

3. Сохраните как `icon-{size}x{size}.png` в папку `static/images/`

## Проверка

После создания иконок запустите:

```bash
cd ../..
python generate_pwa_icons.py
```

Скрипт покажет, какие иконки созданы, а какие отсутствуют.

## Для разработки

Для тестирования PWA иконки не критичны - браузер будет использовать favicon.svg. Но для production они обязательны!

## Быстрое решение для тестирования

Если нужно быстро протестировать PWA без иконок, можно временно изменить manifest.json, чтобы использовать только SVG:

```json
"icons": [
  {
    "src": "/static/images/favicon.svg",
    "sizes": "any",
    "type": "image/svg+xml"
  }
]
```

Но это не рекомендуется для production!

