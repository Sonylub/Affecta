"""
Маршруты (роуты) для приложения Стабил
"""

from flask import render_template, redirect, url_for, flash, request, jsonify, session
from flask_login import login_required, current_user, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime, timedelta
from app import app, db, bcrypt
from models import *
import json
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import warnings
warnings.filterwarnings('ignore')

# ========== АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ==========

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Регистрация нового пользователя"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Валидация
        if not all([username, email, password, confirm_password]):
            flash('Все поля обязательны для заполнения', 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Пароли не совпадают', 'error')
            return render_template('register.html')
        
        if User.query.filter_by(username=username).first():
            flash('Пользователь с таким именем уже существует', 'error')
            return render_template('register.html')
        
        if User.query.filter_by(email=email).first():
            flash('Пользователь с таким email уже существует', 'error')
            return render_template('register.html')
        
        # Создание пользователя
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        user = User(username=username, email=email, password_hash=password_hash)
        
        try:
            db.session.add(user)
            db.session.commit()
            flash('Регистрация успешна! Теперь вы можете войти.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            db.session.rollback()
            flash('Ошибка регистрации. Попробуйте позже.', 'error')
            return render_template('register.html')
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Вход в систему"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = bool(request.form.get('remember'))
        
        if not all([username, password]):
            flash('Пожалуйста, заполните все поля', 'error')
            return render_template('login.html')
        
        user = User.query.filter_by(username=username).first()
        
        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user, remember=remember)
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            # Проверка, прошел ли пользователь онбординг
            if not UserDisorder.query.filter_by(user_id=user.id).first():
                return redirect(url_for('onboarding'))
            
            return redirect(url_for('dashboard'))
        else:
            flash('Неверное имя пользователя или пароль', 'error')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    """Выход из системы"""
    logout_user()
    flash('Вы успешно вышли из системы', 'success')
    return redirect(url_for('index'))

# ========== ОНБОРДИНГ ==========

@app.route('/onboarding', methods=['GET', 'POST'])
@login_required
def onboarding():
    """Первичная настройка пользователя"""
    if UserDisorder.query.filter_by(user_id=current_user.id).first():
        flash('Вы уже прошли онбординг', 'info')
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        selected_disorders = request.form.getlist('disorders')
        
        if not selected_disorders and request.form.get('action') != 'skip':
            flash('Пожалуйста, выберите хотя бы одно расстройство или нажмите "Не знаю"', 'error')
            return render_template('onboarding.html', disorders=Disorder.query.all())
        
        # Сохранение выбранных расстройств
        for disorder_code in selected_disorders:
            disorder = Disorder.query.filter_by(code=disorder_code).first()
            if disorder:
                user_disorder = UserDisorder(
                    user_id=current_user.id,
                    disorder_id=disorder.id,
                    diagnosed=request.form.get(f'diagnosed_{disorder_code}') == 'yes'
                )
                db.session.add(user_disorder)
        
        try:
            db.session.commit()
            flash('Онбординг завершен! Добро пожаловать в Стабил.', 'success')
            return redirect(url_for('dashboard'))
        except Exception as e:
            db.session.rollback()
            flash('Ошибка сохранения данных. Попробуйте позже.', 'error')
    
    disorders = Disorder.query.all()
    return render_template('onboarding.html', disorders=disorders)

# ========== ГЛАВНЫЙ ДАШБОРД ==========

@app.route('/dashboard')
@login_required
def dashboard():
    """Главный дашборд"""
    # Получение последних записей
    recent_entries = DailyEntry.query.filter_by(user_id=current_user.id)\
                                   .order_by(DailyEntry.date.desc())\
                                   .limit(7).all()
    
    # Проверка на пропущенные дни
    user_disorders = UserDisorder.query.filter_by(user_id=current_user.id).all()
    
    # Получение предупреждений
    alerts = Alert.query.filter_by(user_id=current_user.id, is_read=False)\
                       .order_by(Alert.priority.desc(), Alert.created_at.desc())\
                       .limit(5).all()
    
    # Анализ трендов
    trend_data = get_trend_data(current_user.id)
    
    return render_template('dashboard.html', 
                         recent_entries=recent_entries,
                         user_disorders=user_disorders,
                         alerts=alerts,
                         trend_data=trend_data)

@app.route('/daily-entry', methods=['GET', 'POST'])
@login_required
def daily_entry():
    """Ежедневная запись"""
    today = datetime.now().date()
    
    # Поиск существующей записи за сегодня
    existing_entry = DailyEntry.query.filter_by(
        user_id=current_user.id,
        date=today
    ).first()
    
    if request.method == 'POST':
        # Получение данных из формы
        mood = request.form.get('mood', type=int)
        irritability = request.form.get('irritability', type=int)
        anxiety = request.form.get('anxiety', type=int)
        energy = request.form.get('energy', type=int)
        sleep_hours = request.form.get('sleep_hours', type=float)
        sleep_quality = request.form.get('sleep_quality', type=int)
        day_type = request.form.get('day_type')
        notes = request.form.get('notes', '')
        medications_taken = bool(request.form.get('medications_taken'))
        
        # Сбор пользовательских трекеров
        custom_trackers = CustomTracker.query.filter_by(user_id=current_user.id, is_active=True).all()
        custom_values = {}
        for tracker in custom_trackers:
            value = request.form.get(f'custom_{tracker.id}')
            if value:
                custom_values[tracker.id] = value
        
        try:
            if existing_entry:
                # Обновление существующей записи
                existing_entry.mood = mood
                existing_entry.irritability = irritability
                existing_entry.anxiety = anxiety
                existing_entry.energy = energy
                existing_entry.sleep_hours = sleep_hours
                existing_entry.sleep_quality = sleep_quality
                existing_entry.day_type = day_type
                existing_entry.notes = notes
                existing_entry.medications_taken = medications_taken
                existing_entry.custom_values = custom_values
                existing_entry.updated_at = datetime.utcnow()
            else:
                # Создание новой записи
                entry = DailyEntry(
                    user_id=current_user.id,
                    date=today,
                    mood=mood,
                    irritability=irritability,
                    anxiety=anxiety,
                    energy=energy,
                    sleep_hours=sleep_hours,
                    sleep_quality=sleep_quality,
                    day_type=day_type,
                    notes=notes,
                    medications_taken=medications_taken,
                    custom_values=custom_values
                )
                db.session.add(entry)
            
            db.session.commit()
            
            # Проверка предупреждений
            check_alerts(current_user.id)
            
            flash('Запись сохранена успешно!', 'success')
            return redirect(url_for('dashboard'))
            
        except Exception as e:
            db.session.rollback()
            flash('Ошибка сохранения записи. Попробуйте позже.', 'error')
    
    # Получение пользовательских трекеров
    custom_trackers = CustomTracker.query.filter_by(user_id=current_user.id, is_active=True).all()
    
    # Получение медикаментов
    medications = Medication.query.filter_by(user_id=current_user.id, is_active=True).all()
    
    return render_template('daily_entry.html',
                         entry=existing_entry,
                         custom_trackers=custom_trackers,
                         medications=medications,
                         today=today)

# ========== ВИЗУАЛИЗАЦИЯ ==========

@app.route('/analytics')
@login_required
def analytics():
    """Аналитика и графики"""
    period = request.args.get('period', '30')  # days
    
    # Получение данных
    entries = DailyEntry.query.filter_by(user_id=current_user.id)\
                             .filter(DailyEntry.date >= datetime.now().date() - timedelta(days=int(period)))\
                             .order_by(DailyEntry.date.asc()).all()
    
    # Подготовка данных для графиков
    chart_data = prepare_chart_data(entries)
    
    # Статистика
    stats = calculate_statistics(entries)
    
    return render_template('analytics.html',
                         chart_data=chart_data,
                         stats=stats,
                         period=period)

@app.route('/export-data')
@login_required
def export_data():
    """Экспорт данных"""
    format = request.args.get('format', 'csv')
    period = request.args.get('period', 'all')
    
    # Получение данных
    query = DailyEntry.query.filter_by(user_id=current_user.id)
    if period != 'all':
        days = int(period)
        query = query.filter(DailyEntry.date >= datetime.now().date() - timedelta(days=days))
    
    entries = query.order_by(DailyEntry.date.asc()).all()
    
    if format == 'csv':
        return export_csv(entries)
    elif format == 'json':
        return export_json(entries)
    elif format == 'pdf':
        return export_pdf(entries)
    
    flash('Неверный формат экспорта', 'error')
    return redirect(url_for('analytics'))

# ========== ПСИХООБРАЗОВАНИЕ ==========

@app.route('/psychoeducation')
@login_required
def psychoeducation():
    """Раздел психообразования"""
    category = request.args.get('category', 'all')
    
    # Материалы по психообразованию
    materials = get_psychoeducation_materials(category)
    
    return render_template('psychoeducation.html', materials=materials)

@app.route('/therapy-tools')
@login_required
def therapy_tools():
    """Инструменты психотерапии"""
    tool_type = request.args.get('type', 'cbt')
    
    return render_template('therapy_tools.html', tool_type=tool_type)

@app.route('/journal', methods=['GET', 'POST'])
@login_required
def journal():
    """Дневник мыслей"""
    if request.method == 'POST':
        note_type = request.form.get('note_type', 'thought')
        title = request.form.get('title', '')
        content = request.form.get('content', '')
        
        # Специфические поля для разных типов
        if note_type == 'cbt':
            situation = request.form.get('situation', '')
            automatic_thoughts = request.form.get('automatic_thoughts', '')
            emotions = request.form.get('emotions', '')
            cognitive_distortions = request.form.get('cognitive_distortions', '')
            rational_response = request.form.get('rational_response', '')
        else:
            situation = automatic_thoughts = emotions = cognitive_distortions = rational_response = None
        
        note = TherapyNote(
            user_id=current_user.id,
            note_type=note_type,
            title=title,
            content=content,
            situation=situation,
            automatic_thoughts=automatic_thoughts,
            emotions=emotions,
            cognitive_distortions=cognitive_distortions,
            rational_response=rational_response,
            date_created=datetime.now().date()
        )
        
        try:
            db.session.add(note)
            db.session.commit()
            flash('Запись сохранена!', 'success')
            return redirect(url_for('journal'))
        except Exception as e:
            db.session.rollback()
            flash('Ошибка сохранения записи', 'error')
    
    # Получение существующих записей
    notes = TherapyNote.query.filter_by(user_id=current_user.id)\
                            .order_by(TherapyNote.created_at.desc()).all()
    
    return render_template('journal.html', notes=notes)

# ========== СКРИНИНГИ ==========

@app.route('/screening')
@login_required
def screening():
    """Скрининговые тесты"""
    return render_template('screening.html')

@app.route('/screening/<test_type>', methods=['GET', 'POST'])
@login_required
def screening_test(test_type):
    """Прохождение скринингового теста"""
    if test_type not in ['bdi_ii', 'bss']:
        flash('Неверный тип теста', 'error')
        return redirect(url_for('screening'))
    
    if request.method == 'POST':
        # Обработка результатов теста
        responses = {}
        total_score = 0
        
        if test_type == 'bdi_ii':
            # BDI-II: 21 вопрос
            for i in range(1, 22):
                response = request.form.get(f'q{i}', type=int)
                if response is not None:
                    responses[f'q{i}'] = response
                    total_score += response
        
        elif test_type == 'bss':
            # BSS: 19 вопросов
            for i in range(1, 20):
                response = request.form.get(f'q{i}', type=int)
                if response is not None:
                    responses[f'q{i}'] = response
                    total_score += response
        
        # Определение тяжести
        severity = get_severity_level(test_type, total_score)
        interpretation = get_test_interpretation(test_type, total_score, severity)
        recommendations = get_recommendations(test_type, severity)
        
        # Сохранение результата
        result = ScreeningResult(
            user_id=current_user.id,
            test_type=test_type,
            total_score=total_score,
            responses=responses,
            severity=severity,
            interpretation=interpretation,
            recommendations=recommendations
        )
        
        try:
            db.session.add(result)
            db.session.commit()
            
            flash(f'Тест завершен! Ваш балл: {total_score}', 'success')
            return redirect(url_for('screening_results', result_id=result.id))
            
        except Exception as e:
            db.session.rollback()
            flash('Ошибка сохранения результатов', 'error')
    
    # Получение вопросов теста
    questions = get_test_questions(test_type)
    
    return render_template('screening_test.html',
                         test_type=test_type,
                         questions=questions)

@app.route('/screening/results/<int:result_id>')
@login_required
def screening_results(result_id):
    """Просмотр результатов скрининга"""
    result = ScreeningResult.query.filter_by(id=result_id, user_id=current_user.id).first_or_404()
    return render_template('screening_results.html', result=result)

# ========== НАСТРОЙКИ ==========

@app.route('/settings')
@login_required
def settings():
    """Настройки пользователя"""
    return render_template('settings.html')

@app.route('/settings/custom-trackers', methods=['GET', 'POST'])
@login_required
def custom_trackers():
    """Управление пользовательскими трекерами"""
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'add':
            # Добавление нового трекера
            name = request.form.get('name')
            description = request.form.get('description')
            tracker_type = request.form.get('type')
            
            tracker = CustomTracker(
                user_id=current_user.id,
                name=name,
                description=description,
                type=tracker_type
            )
            
            # Дополнительные настройки для слайдера
            if tracker_type == 'slider':
                tracker.min_value = request.form.get('min_value', 0, type=int)
                tracker.max_value = request.form.get('max_value', 10, type=int)
            
            try:
                db.session.add(tracker)
                db.session.commit()
                flash('Трекер добавлен!', 'success')
            except Exception as e:
                db.session.rollback()
                flash('Ошибка добавления трекера', 'error')
        
        elif action == 'delete':
            # Удаление трекера
            tracker_id = request.form.get('tracker_id', type=int)
            tracker = CustomTracker.query.filter_by(id=tracker_id, user_id=current_user.id).first()
            
            if tracker:
                tracker.is_active = False
                db.session.commit()
                flash('Трекер удален', 'success')
    
    # Получение трекеров пользователя
    trackers = CustomTracker.query.filter_by(user_id=current_user.id, is_active=True).all()
    
    return render_template('custom_trackers.html', trackers=trackers)

@app.route('/settings/medications', methods=['GET', 'POST'])
@login_required
def medications():
    """Управление медикаментами"""
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'add':
            name = request.form.get('name')
            dosage = request.form.get('dosage')
            frequency = request.form.get('frequency')
            
            medication = Medication(
                user_id=current_user.id,
                name=name,
                dosage=dosage,
                frequency=frequency,
                morning=bool(request.form.get('morning')),
                afternoon=bool(request.form.get('afternoon')),
                evening=bool(request.form.get('evening')),
                night=bool(request.form.get('night'))
            )
            
            try:
                db.session.add(medication)
                db.session.commit()
                flash('Медикамент добавлен!', 'success')
            except Exception as e:
                db.session.rollback()
                flash('Ошибка добавления медикамента', 'error')
        
        elif action == 'delete':
            med_id = request.form.get('med_id', type=int)
            medication = Medication.query.filter_by(id=med_id, user_id=current_user.id).first()
            
            if medication:
                medication.is_active = False
                db.session.commit()
                flash('Медикамент удален', 'success')
    
    medications = Medication.query.filter_by(user_id=current_user.id, is_active=True).all()
    return render_template('medications.html', medications=medications)

# ========== API ==========

@app.route('/api/daily-entry/<date>')
@login_required
def api_get_daily_entry(date):
    """Получение записи за конкретную дату"""
    try:
        entry_date = datetime.strptime(date, '%Y-%m-%d').date()
        entry = DailyEntry.query.filter_by(user_id=current_user.id, date=entry_date).first()
        
        if entry:
            return jsonify({
                'success': True,
                'entry': {
                    'id': entry.id,
                    'date': entry.date.isoformat(),
                    'mood': entry.mood,
                    'irritability': entry.irritability,
                    'anxiety': entry.anxiety,
                    'energy': entry.energy,
                    'sleep_hours': entry.sleep_hours,
                    'sleep_quality': entry.sleep_quality,
                    'day_type': entry.day_type,
                    'notes': entry.notes,
                    'medications_taken': entry.medications_taken,
                    'custom_values': entry.custom_values
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Запись не найдена'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/alerts/mark-read/<int:alert_id>', methods=['POST'])
@login_required
def api_mark_alert_read(alert_id):
    """Отметить предупреждение как прочитанное"""
    alert = Alert.query.filter_by(id=alert_id, user_id=current_user.id).first()
    
    if alert:
        alert.is_read = True
        db.session.commit()
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'message': 'Предупреждение не найдено'})

# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

def get_trend_data(user_id):
    """Получение данных трендов для дашборда"""
    entries = DailyEntry.query.filter_by(user_id=user_id)\
                            .filter(DailyEntry.date >= datetime.now().date() - timedelta(days=14))\
                            .order_by(DailyEntry.date.asc()).all()
    
    if not entries:
        return {}
    
    # Расчет трендов
    mood_trend = calculate_trend([e.mood for e in entries if e.mood is not None])
    anxiety_trend = calculate_trend([e.anxiety for e in entries if e.anxiety is not None])
    energy_trend = calculate_trend([e.energy for e in entries if e.energy is not None])
    
    return {
        'mood': {'trend': mood_trend, 'current': entries[-1].mood},
        'anxiety': {'trend': anxiety_trend, 'current': entries[-1].anxiety},
        'energy': {'trend': energy_trend, 'current': entries[-1].energy}
    }

def calculate_trend(values):
    """Расчет тренда (рост/падение/стабильность)"""
    if len(values) < 2:
        return 'stable'
    
    first_half = values[:len(values)//2]
    second_half = values[len(values)//2:]
    
    avg_first = sum(first_half) / len(first_half)
    avg_second = sum(second_half) / len(second_half)
    
    diff = avg_second - avg_first
    
    if diff > 1:
        return 'increasing'
    elif diff < -1:
        return 'decreasing'
    else:
        return 'stable'

def check_alerts(user_id):
    """Проверка и создание предупреждений"""
    # Получение последних записей
    recent_entries = DailyEntry.query.filter_by(user_id=user_id)\
                                   .order_by(DailyEntry.date.desc())\
                                   .limit(7).all()
    
    if not recent_entries:
        return
    
    # Правило 1: Продолжительная депрессия
    depressive_days = sum(1 for entry in recent_entries if entry.mood and entry.mood <= 3)
    if depressive_days >= 5:
        create_alert(user_id, 'mood', 'Продолжительная депрессия', 
                    'Ваше настроение остается низким более 5 дней. Рассмотрите консультацию со специалистом.')
    
    # Правило 2: Высокая тревога
    high_anxiety_days = sum(1 for entry in recent_entries if entry.anxiety and entry.anxiety >= 8)
    if high_anxiety_days >= 3:
        create_alert(user_id, 'anxiety', 'Высокий уровень тревоги', 
                    'Уровень тревоги остается высоким. Попробуйте техники релаксации.')
    
    # Правило 3: Нарушения сна
    poor_sleep_days = sum(1 for entry in recent_entries 
                         if entry.sleep_quality and entry.sleep_quality <= 3)
    if poor_sleep_days >= 4:
        create_alert(user_id, 'sleep', 'Проблемы со сном', 
                    'Качество сна снижено. Важность гигиены сна возрастает.')

def create_alert(user_id, alert_type, title, message, priority='medium'):
    """Создание предупреждения"""
    # Проверка на существующее непрочитанное предупреждение
    existing = Alert.query.filter_by(
        user_id=user_id,
        alert_type=alert_type,
        is_read=False,
        title=title
    ).first()
    
    if not existing:
        alert = Alert(
            user_id=user_id,
            alert_type=alert_type,
            title=title,
            message=message,
            priority=priority
        )
        db.session.add(alert)
        db.session.commit()

def prepare_chart_data(entries):
    """Подготовка данных для графиков"""
    if not entries:
        return {}
    
    dates = [entry.date.strftime('%Y-%m-%d') for entry in entries]
    
    return {
        'dates': dates,
        'mood': [entry.mood for entry in entries],
        'anxiety': [entry.anxiety for entry in entries],
        'energy': [entry.energy for entry in entries],
        'irritability': [entry.irritability for entry in entries],
        'sleep_quality': [entry.sleep_quality for entry in entries],
        'sleep_hours': [entry.sleep_hours for entry in entries]
    }

def calculate_statistics(entries):
    """Расчет статистики"""
    if not entries:
        return {}
    
    import numpy as np
    
    stats = {}
    for metric in ['mood', 'anxiety', 'energy', 'irritability', 'sleep_quality']:
        values = [getattr(entry, metric) for entry in entries if getattr(entry, metric) is not None]
        if values:
            stats[metric] = {
                'mean': round(np.mean(values), 2),
                'std': round(np.std(values), 2),
                'min': min(values),
                'max': max(values)
            }
    
    return stats

def export_csv(entries):
    """Экспорт в CSV"""
    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Заголовки
    writer.writerow(['Дата', 'Настроение', 'Тревога', 'Энергия', 'Раздражительность', 
                    'Часы сна', 'Качество сна', 'Тип дня', 'Примечания'])
    
    # Данные
    for entry in entries:
        writer.writerow([
            entry.date.strftime('%Y-%m-%d'),
            entry.mood,
            entry.anxiety,
            entry.energy,
            entry.irritability,
            entry.sleep_hours,
            entry.sleep_quality,
            entry.day_type,
            entry.notes
        ])
    
    from flask import Response
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=stabil_data.csv'}
    )

def export_json(entries):
    """Экспорт в JSON"""
    data = []
    for entry in entries:
        data.append({
            'date': entry.date.isoformat(),
            'mood': entry.mood,
            'anxiety': entry.anxiety,
            'energy': entry.energy,
            'irritability': entry.irritability,
            'sleep_hours': entry.sleep_hours,
            'sleep_quality': entry.sleep_quality,
            'day_type': entry.day_type,
            'notes': entry.notes,
            'custom_values': entry.custom_values
        })
    
    from flask import Response
    return Response(
        json.dumps(data, ensure_ascii=False, indent=2),
        mimetype='application/json',
        headers={'Content-Disposition': 'attachment; filename=stabil_data.json'}
    )

def get_test_questions(test_type):
    """Получение вопросов для скрининговых тестов"""
    if test_type == 'bdi_ii':
        return [
            {"id": i, "text": f"Вопрос {i} BDI-II", "options": [
                {"value": 0, "text": "Ни разу"},
                {"value": 1, "text": "Немного"},
                {"value": 2, "text": "Умеренно"},
                {"value": 3, "text": "Сильно"}
            ]} for i in range(1, 22)
        ]
    elif test_type == 'bss':
        return [
            {"id": i, "text": f"Вопрос {i} BSS", "options": [
                {"value": 0, "text": "Нет"},
                {"value": 1, "text": "Да, но не в последний год"},
                {"value": 2, "text": "Да, в последний год"}
            ]} for i in range(1, 20)
        ]
    return []

def get_severity_level(test_type, score):
    """Определение уровня тяжести по результатам теста"""
    if test_type == 'bdi_ii':
        if score <= 13:
            return 'minimal'
        elif score <= 19:
            return 'mild'
        elif score <= 28:
            return 'moderate'
        else:
            return 'severe'
    elif test_type == 'bss':
        if score <= 2:
            return 'low'
        elif score <= 5:
            return 'moderate'
        else:
            return 'high'
    return 'unknown'

def get_test_interpretation(test_type, score, severity):
    """Получение интерпретации результатов теста"""
    interpretations = {
        'bdi_ii': {
            'minimal': 'Минимальные проявления депрессии',
            'mild': 'Легкая депрессия',
            'moderate': 'Умеренная депрессия',
            'severe': 'Тяжелая депрессия'
        },
        'bss': {
            'low': 'Низкий риск суицидального поведения',
            'moderate': 'Средний риск суицидального поведения',
            'high': 'Высокий риск суицидального поведения'
        }
    }
    return interpretations.get(test_type, {}).get(severity, 'Интерпретация недоступна')

def get_recommendations(test_type, severity):
    """Получение рекомендаций на основе результатов"""
    recommendations = {
        'minimal': 'Продолжайте следить за своим состоянием и поддерживать здоровый образ жизни.',
        'mild': 'Рассмотрите возможность использования техник самопомощи и обратите внимание на факторы, влияющие на ваше настроение.',
        'moderate': 'Рекомендуется консультация с психологом или психотерапевтом для разработки стратегий преодоления симптомов.',
        'severe': 'Необходима срочная консультация с психиатром или обращение в кризисный центр.'
    }
    return recommendations.get(severity, 'Обратитесь к специалисту для получения персональных рекомендаций.')

def get_psychoeducation_materials(category):
    """Получение материалов психообразования"""
    # Заглушка - в реальном приложении это будет из базы данных
    materials = [
        {
            'title': 'Понимание биполярного расстройства',
            'category': 'bipolar',
            'description': 'Основы БАР, симптомы и стратегии управления',
            'content': '...'
        },
        {
            'title': 'Техники управления тревожностью',
            'category': 'anxiety',
            'description': 'Практические методы снижения тревоги',
            'content': '...'
        }
    ]
    
    if category != 'all':
        materials = [m for m in materials if m['category'] == category]
    
    return materials