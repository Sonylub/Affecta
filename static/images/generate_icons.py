#!/usr/bin/env python3
"""
Скрипт для генерации иконок PWA из favicon.svg
Требует установки: pip install cairosvg pillow
"""

try:
    from cairosvg import svg2png
    from PIL import Image
    import io
except ImportError:
    print("Установите необходимые библиотеки:")
    print("pip install cairosvg pillow")
    exit(1)

# Размеры иконок для PWA
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

def generate_icons():
    """Генерирует PNG иконки из SVG файла"""
    svg_file = 'favicon.svg'
    
    with open(svg_file, 'rb') as f:
        svg_data = f.read()
    
    for size in SIZES:
        # Конвертируем SVG в PNG
        png_data = svg2png(
            bytestring=svg_data,
            output_width=size,
            output_height=size
        )
        
        # Открываем как PIL Image для дополнительной обработки
        img = Image.open(io.BytesIO(png_data))
        
        # Добавляем белый фон для лучшей видимости
        if img.mode == 'RGBA':
            background = Image.new('RGBA', img.size, (255, 255, 255, 255))
            background.paste(img, (0, 0), img)
            img = background.convert('RGB')
        
        # Сохраняем
        filename = f'icon-{size}x{size}.png'
        img.save(filename, 'PNG', optimize=True)
        print(f'Создана иконка: {filename}')

if __name__ == '__main__':
    generate_icons()
    print('\nВсе иконки успешно созданы!')
    print('Запустите этот скрипт из папки static/images/')

