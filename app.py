"""
Биполярный трекер "Affecta"
Проект для защиты - студент 20 лет

Основной файл приложения Flask
- Инициализация приложения
- Настройка Flask-Login для аутентификации
- Регистрация маршрутов через Blueprint
"""

import os
from flask import Flask, redirect, url_for
from flask_login import LoginManager, login_required
from dotenv import load_dotenv

# Загрузка переменных окружения из .env
load_dotenv('.env')

from models import Database
from routes import bp as main_bp

def create_app():
    """Создание приложения Flask"""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'main.login'
    
    app.register_blueprint(main_bp)
    
    @login_manager.user_loader
    def load_user(user_id):
        db = Database()
        return db.get_user_by_id(user_id)
    
    @app.route('/dashboard')
    @login_required
    def dashboard():
        return redirect(url_for('main.dashboard'))
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)