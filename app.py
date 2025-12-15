"""
Стабил - Биполярный трекер для студентов
Главный файл приложения Flask
"""

import os
from flask import Flask, render_template, redirect, url_for, flash, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import numpy as np
import pandas as pd
from dotenv import load_dotenv
import logging

# Загрузка переменных окружения
load_dotenv()

# Инициализация Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Настройка базы данных
if os.getenv('DATABASE_URL'):
    # Для NeonDB (production)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
else:
    # Для локальной разработки
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///stabil.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Инициализация расширений
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Пожалуйста, войдите для доступа к этой странице'
CORS(app)

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Импорт моделей (после инициализации db)
from models import User, DailyEntry, Disorder, CustomTracker, ScreeningResult, TherapyNote, Medication

# Импорт маршрутов
from routes import *

# Создание таблиц перед первым запросом
@app.before_first_request
def create_tables():
    """Создание таблиц базы данных"""
    try:
        db.create_all()
        logger.info("Таблицы базы данных созданы успешно")
        
        # Инициализация справочника расстройств
        init_disorders()
        
    except Exception as e:
        logger.error(f"Ошибка создания таблиц: {e}")

def init_disorders():
    """Инициализация справочника расстройств"""
    disorders = [
        {'code': 'bipolar', 'name': 'Биполярное расстройство', 'description': 'БАР I или II типа'},
        {'code': 'anxiety', 'name': 'Тревожные расстройства', 'description': 'Генерализованное тревожное расстройство, паническое расстройство'},
        {'code': 'adhd', 'name': 'СДВГ', 'description': 'Синдром дефицита внимания и гиперактивности'},
        {'code': 'bpd', 'name': 'ПРЛ', 'description': 'Пограничное расстройство личности'},
        {'code': 'depression', 'name': 'Мажорная депрессия', 'description': 'Клиническая депрессия'},
        {'code': 'addiction', 'name': 'Зависимость', 'description': 'Химическая или поведенческая зависимость'},
        {'code': 'eating', 'name': 'РПП', 'description': 'Расстройства пищевого поведения'},
    ]
    
    for disorder_data in disorders:
        if not Disorder.query.filter_by(code=disorder_data['code']).first():
            disorder = Disorder(**disorder_data)
            db.session.add(disorder)
    
    db.session.commit()
    logger.info("Справочник расстройств инициализирован")

# Загрузка пользователя для Flask-Login
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Главная страница
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

# Обработка ошибок
@app.errorhandler(404)
def not_found_error(error):
    return render_template('error.html', error_code=404, error_message='Страница не найдена'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('error.html', error_code=500, error_message='Внутренняя ошибка сервера'), 500

# Health check для Vercel
@app.route('/api/health')
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    # Локальный запуск
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=bool(os.getenv('FLASK_DEBUG', False)))