#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой генератор иконок PWA для Windows
Использует только Pillow (без Cairo)
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Установите Pillow:")
    print("pip install pillow")
    exit(1)

# Размеры иконок для PWA
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# Цвета из favicon.svg
COLORS = {
    'orange': '#FFB84D',
    'purple': '#C77DFF',
    'teal': '#22D3EE',
    'blue': '#60A5FA',
    'bg': '#FFFFFF'
}

def hex_to_rgb(hex_color):
    """Конвертирует HEX в RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_icon(size):
    """Создает упрощенную иконку в стиле Affecta"""
    # Создаем изображение с белым фоном
    img = Image.new('RGB', (size, size), hex_to_rgb(COLORS['bg']))
    draw = ImageDraw.Draw(img)
    
    # Масштабируем элементы относительно размера
    scale = size / 64
    center_x, center_y = size // 2, size // 2
    
    # Центральный круг (оранжевый)
    radius = int(12 * scale)
    draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        fill=hex_to_rgb(COLORS['orange'])
    )
    
    # Белый блик на центральном круге
    highlight_radius = int(4 * scale)
    highlight_offset = int(3 * scale)
    draw.ellipse(
        [center_x - highlight_offset - highlight_radius, 
         center_y - highlight_offset - highlight_radius,
         center_x - highlight_offset + highlight_radius, 
         center_y - highlight_offset + highlight_radius],
        fill='white'
    )
    
    # Верхний элемент (фиолетовый)
    top_y = center_y - int(16 * scale)
    top_radius = int(8 * scale)
    draw.ellipse(
        [center_x - top_radius, top_y - int(6 * scale),
         center_x + top_radius, top_y + int(6 * scale)],
        fill=hex_to_rgb(COLORS['purple'])
    )
    
    # Нижний элемент (бирюзовый)
    bottom_y = center_y + int(16 * scale)
    bottom_radius = int(8 * scale)
    draw.ellipse(
        [center_x - bottom_radius, bottom_y - int(6 * scale),
         center_x + bottom_radius, bottom_y + int(6 * scale)],
        fill=hex_to_rgb(COLORS['teal'])
    )
    
    # Левый элемент (синий)
    left_x = center_x - int(16 * scale)
    left_radius = int(6 * scale)
    draw.ellipse(
        [left_x - int(6 * scale), center_y - left_radius,
         left_x + int(6 * scale), center_y + left_radius],
        fill=hex_to_rgb(COLORS['blue'])
    )
    
    # Правый элемент (синий)
    right_x = center_x + int(16 * scale)
    right_radius = int(6 * scale)
    draw.ellipse(
        [right_x - int(6 * scale), center_y - right_radius,
         right_x + int(6 * scale), center_y + right_radius],
        fill=hex_to_rgb(COLORS['blue'])
    )
    
    return img

def generate_all_icons():
    """Генерирует все иконки"""
    print("Generating PWA icons for Affecta...")
    print("=" * 50)
    
    for size in SIZES:
        filename = f'icon-{size}x{size}.png'
        print(f"Creating {filename}...", end=' ')
        
        try:
            icon = create_icon(size)
            icon.save(filename, 'PNG', optimize=True)
            print("[OK]")
        except Exception as e:
            print(f"[ERROR] {e}")
    
    print("=" * 50)
    print("Done! All icons created.")
    print("\nCreated files:")
    for size in SIZES:
        print(f"  - icon-{size}x{size}.png")

if __name__ == '__main__':
    generate_all_icons()

