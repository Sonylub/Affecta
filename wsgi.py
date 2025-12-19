import sys
import os

# Добавляем путь к проекту
sys.path.insert(0, '/www/wwwroot/Affecta')

from app import app as application

if __name__ == "__main__":
    application.run()