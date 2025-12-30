#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для генерации иконок PWA из favicon.svg
Использует только стандартную библиотеку Python и создает простые иконки
"""

import os
import sys

def create_placeholder_icons():
    """Создает заглушки для иконок PWA"""
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    images_dir = 'static/images'
    
    # Проверяем наличие favicon.svg
    favicon_path = os.path.join(images_dir, 'favicon.svg')
    if not os.path.exists(favicon_path):
        print(f"Error: {favicon_path} not found")
        return
    
    print("To create PNG icons install libraries:")
    print("pip install cairosvg pillow")
    print("\nThen run:")
    print("cd static/images")
    print("python generate_icons.py")
    print("\n" + "="*50)
    print("INFO: PWA icons need to be generated")
    print("="*50 + "\n")
    
    # Проверяем существование иконок
    missing_icons = []
    for size in sizes:
        icon_name = f'icon-{size}x{size}.png'
        icon_path = os.path.join(images_dir, icon_name)
        
        if os.path.exists(icon_path):
            print(f"[OK] {icon_name} exists")
        else:
            print(f"[MISSING] {icon_name}")
            missing_icons.append(icon_name)
    
    if missing_icons:
        print("\n" + "="*50)
        print("IMPORTANT: Create PNG icons for production!")
        print("="*50)
        print("\nMissing icons:")
        for icon in missing_icons:
            print(f"  - {icon}")

if __name__ == '__main__':
    create_placeholder_icons()

