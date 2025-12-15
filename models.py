"""
Модели базы данных для приложения Стабил
"""

from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from sqlalchemy import JSON

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """Модель пользователя"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Персональная информация
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    birth_date = db.Column(db.Date)
    
    # Настройки
    timezone = db.Column(db.String(50), default='UTC')
    theme = db.Column(db.String(20), default='light')  # light, dark
    language = db.Column(db.String(10), default='ru')
    
    # Метаданные
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # Связи
    disorders = db.relationship('UserDisorder', backref='user', lazy='dynamic')
    daily_entries = db.relationship('DailyEntry', backref='user', lazy='dynamic')
    custom_trackers = db.relationship('CustomTracker', backref='user', lazy='dynamic')
    screening_results = db.relationship('ScreeningResult', backref='user', lazy='dynamic')
    therapy_notes = db.relationship('TherapyNote', backref='user', lazy='dynamic')
    medications = db.relationship('Medication', backref='user', lazy='dynamic')
    
    def __repr__(self):
        return f'<User {self.username}>'

class Disorder(db.Model):
    """Справочник расстройств"""
    __tablename__ = 'disorders'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    
    def __repr__(self):
        return f'<Disorder {self.name}>'

class UserDisorder(db.Model):
    """Связь пользователя с расстройствами (онбординг)"""
    __tablename__ = 'user_disorders'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    disorder_id = db.Column(db.Integer, db.ForeignKey('disorders.id'), nullable=False)
    diagnosed = db.Column(db.Boolean, default=False)
    diagnosed_date = db.Column(db.Date)
    severity = db.Column(db.String(20))  # mild, moderate, severe
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    disorder = db.relationship('Disorder', backref='user_disorders')

class DailyEntry(db.Model):
    """Ежедневная запись трекера"""
    __tablename__ = 'daily_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    
    # Основные шкалы (0-10)
    mood = db.Column(db.Integer)  # Настроение
    irritability = db.Column(db.Integer)  # Раздражительность
    anxiety = db.Column(db.Integer)  # Тревога
    energy = db.Column(db.Integer)  # Энергия
    
    # Дополнительные параметры
    sleep_hours = db.Column(db.Float)
    sleep_quality = db.Column(db.Integer)  # 1-10
    
    # Тип дня
    day_type = db.Column(db.String(20))  # normal, manic, depressive, mixed
    
    # Медикаменты
    medications_taken = db.Column(db.Boolean, default=False)
    medications_notes = db.Column(db.Text)
    
    # Пользовательские трекеры (JSON)
    custom_values = db.Column(JSON)
    
    # Примечания
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Уникальный индекс для предотвращения дублей
    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='unique_user_date'),)
    
    def __repr__(self):
        return f'<DailyEntry {self.user_id} {self.date}>'

class CustomTracker(db.Model):
    """Пользовательские трекеры"""
    __tablename__ = 'custom_trackers'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(20), nullable=False)  # slider, checkbox, number, text
    
    # Настройки для слайдера
    min_value = db.Column(db.Integer, default=0)
    max_value = db.Column(db.Integer, default=10)
    
    # Настройки для всех типов
    default_value = db.Column(db.String(50))
    unit = db.Column(db.String(20))  # единицы измерения
    
    # Метаданные
    color = db.Column(db.String(20), default='#3B82F6')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<CustomTracker {self.name}>'

class Medication(db.Model):
    """Медикаменты пользователя"""
    __tablename__ = 'medications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    dosage = db.Column(db.String(100))
    frequency = db.Column(db.String(100))  # daily, twice_daily, etc.
    
    # Время приема
    morning = db.Column(db.Boolean, default=False)
    afternoon = db.Column(db.Boolean, default=False)
    evening = db.Column(db.Boolean, default=False)
    night = db.Column(db.Boolean, default=False)
    
    # Настройки напоминаний
    reminder_enabled = db.Column(db.Boolean, default=True)
    
    # Метаданные
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Medication {self.name}>'

class ScreeningResult(db.Model):
    """Результаты скрининговых тестов"""
    __tablename__ = 'screening_results'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    test_type = db.Column(db.String(50), nullable=False)  # bdi_ii, bss
    date_taken = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Результаты
    total_score = db.Column(db.Integer, nullable=False)
    responses = db.Column(JSON, nullable=False)  # Сохранение ответов
    
    # Интерпретация
    severity = db.Column(db.String(50))  # minimal, mild, moderate, severe
    interpretation = db.Column(db.Text)
    
    # Рекомендации
    recommendations = db.Column(db.Text)
    
    def __repr__(self):
        return f'<ScreeningResult {self.test_type} {self.total_score}>'

class TherapyNote(db.Model):
    """Заметки из психотерапии и дневник мыслей"""
    __tablename__ = 'therapy_notes'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Тип заметки
    note_type = db.Column(db.String(50), default='thought')  # thought, cbt, dbt, act, ipsrt
    
    # Содержание
    title = db.Column(db.String(200))
    content = db.Column(db.Text, nullable=False)
    
    # Для КПТ (когнитивно-поведенческая терапия)
    situation = db.Column(db.Text)
    automatic_thoughts = db.Column(db.Text)
    emotions = db.Column(db.Text)
    cognitive_distortions = db.Column(db.Text)
    rational_response = db.Column(db.Text)
    
    # Для ДБТ (диалектико-поведенческая терапия)
    skill_used = db.Column(db.String(100))
    effectiveness = db.Column(db.Integer)  # 1-10
    
    # Метаданные
    date_created = db.Column(db.Date, default=datetime.utcnow().date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<TherapyNote {self.title}>'

class Alert(db.Model):
    """Системные предупреждения и уведомления"""
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Тип и содержание
    alert_type = db.Column(db.String(50), nullable=False)  # mood, medication, screening
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    
    # Приоритет
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, critical
    
    # Статус
    is_read = db.Column(db.Boolean, default=False)
    is_dismissed = db.Column(db.Boolean, default=False)
    
    # Метаданные
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    dismissed_at = db.Column(db.DateTime)
    
    def __repr__(self):
        return f'<Alert {self.title}>'

class CorporateGroup(db.Model):
    """Корпоративные группы для анонимной аналитики"""
    __tablename__ = 'corporate_groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text)
    
    # Настройки
    is_active = db.Column(db.Boolean, default=True)
    allow_analytics = db.Column(db.Boolean, default=True)
    
    # Метаданные
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Связи
    members = db.relationship('User', secondary='group_memberships', backref='corporate_groups')
    
    def __repr__(self):
        return f'<CorporateGroup {self.name}>'

class GroupMembership(db.Model):
    """Членство в корпоративных группах"""
    __tablename__ = 'group_memberships'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('corporate_groups.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Анонимный ID для статистики
    anonymous_id = db.Column(db.String(100), unique=True)
    
    # Роль в группе
    role = db.Column(db.String(50), default='member')  # member, admin

# Таблица для связи многие-ко-многим пользователей с группами
group_memberships = db.Table('group_memberships',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('corporate_groups.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow),
    db.Column('anonymous_id', db.String(100), unique=True),
    db.Column('role', db.String(50), default='member')
)