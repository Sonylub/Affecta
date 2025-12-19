"""
Маршруты для биполярного трекера "Affecta"
Проект для защиты - студент 20 лет

Основные маршруты:
- / - главная страница
- /register, /login, /logout - аутентификация
- /entry - страница ввода/редактирования записи
- /dashboard - дашборд с графиками
- /analytics - страница аналитики
- /report_settings, /generate_report - генерация PDF отчётов

API endpoints:
- /save_entry - сохранение записи
- /get_entry/<date> - получение записи за дату
- /add_medication, /add_tracker, /add_custom_state - добавление элементов
- /get_dashboard_data, /get_analytics_data - получение данных для графиков
"""

from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, Response
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime, date, timedelta

from models import Database, User

bp = Blueprint('main', __name__, url_prefix='')

def get_db():
    return Database()

EXPLANATION_TEXT = {'none': 'Нет', 'mild': 'Лёгкое', 'moderate': 'Умеренное', 'severe': 'Тяжёлое'}

def determine_phase_with_statistics(current_entry, recent_entries):
    """
    Определение фазы биполярного расстройства на основе статистики
    
    Алгоритм для защиты проекта:
    1. Анализ последних 7 дней записей
    2. Оценка состояний (none/mild/moderate/severe) с весами 0/3/6/9
    3. Определение смешанной фазы при быстрых переключениях (>=2 за период)
    4. Определение смешанной фазы при одновременных симптомах депрессии и гипомании
    5. Определение устойчивой фазы при >=50% дней с симптомами
    6. Учёт сна: <3ч усиливает гипоманию, >12ч усиливает депрессию
    """
    def state_score(value):
        return {'none': 0, 'mild': 3, 'moderate': 6, 'severe': 9}.get(value or 'none', 0)
    
    def check_episode(score, sleep_hours):
        return score >= 6 or (score >= 3 and (sleep_hours <= 3 or sleep_hours >= 12))
    
    # Добавляем текущую запись в список для анализа
    all_entries = list(recent_entries)
    if current_entry:
        all_entries.append({
            'depressive_state': current_entry.get('depressive_state', 'none'),
            'manic_state': current_entry.get('manic_state', 'none'),
            'sleep_hours': current_entry.get('sleep_hours', 0),
            'entry_date': current_entry.get('entry_date')
        })
    
    if not all_entries:
        return 'normal', ["Нет данных для анализа"]
    
    # Анализ каждой записи
    phase_scores = {
        'depressive': 0,
        'hypomanic': 0,
        'mixed': 0,
        'normal': 0
    }
    
    phase_history = []
    explanation_parts = []
    
    for entry in all_entries:
        sleep_hours = float(entry.get('sleep_hours', 0) or 0)
        dep_episode = check_episode(state_score(entry.get('depressive_state', 'none')), sleep_hours)
        man_episode = check_episode(state_score(entry.get('manic_state', 'none')), sleep_hours)
        
        if dep_episode and man_episode:
            day_phase = 'mixed'
        elif dep_episode:
            day_phase = 'depressive'
        elif man_episode:
            day_phase = 'hypomanic'
        else:
            day_phase = 'normal'
        
        phase_history.append(day_phase)
        phase_scores[day_phase] += 1
    
    rapid_switches = sum(1 for i in range(len(phase_history) - 1)
                        if {phase_history[i], phase_history[i+1]} == {'depressive', 'hypomanic'})
    
    # Если есть 2+ быстрых переключения за период - это смешанная фаза
    if rapid_switches >= 2:
        explanation_parts.append(f"Смешанная фаза определена на основе анализа паттернов за последние {len(all_entries)} дней")
        explanation_parts.append(f"Обнаружены быстрые переключения между депрессией и гипоманией: {rapid_switches} переключений за период")
        explanation_parts.append("Быстрая смена фаз указывает на смешанное состояние")
        return 'mixed', explanation_parts
    
    current_sleep = float(current_entry.get('sleep_hours', 0) or 0)
    current_dep_episode = check_episode(state_score(current_entry.get('depressive_state', 'none')), current_sleep)
    current_man_episode = check_episode(state_score(current_entry.get('manic_state', 'none')), current_sleep)
    
    if current_dep_episode and current_man_episode:
        explanation_parts.append("Смешанная фаза определена на основе текущей записи")
        dep_state = current_entry.get('depressive_state', 'none')
        man_state = current_entry.get('manic_state', 'none')
        explanation_parts.append(f"Одновременно присутствуют симптомы: депрессивное состояние ({EXPLANATION_TEXT.get(dep_state, dep_state)}) и маниакальное состояние ({EXPLANATION_TEXT.get(man_state, man_state)})")
        if current_sleep >= 12:
            explanation_parts.append(f"Дополнительно: очень много сна ({current_sleep} ч) усилило депрессивные симптомы")
        if current_sleep <= 3:
            explanation_parts.append(f"Дополнительно: очень мало сна ({current_sleep} ч) усилило маниакальные симптомы")
        return 'mixed', explanation_parts
    
    # Определение фазы по статистике (устойчивость >= 50%)
    total_days = len(all_entries)
    threshold = max(1, total_days * 0.5)  # Минимум 50% дней
    
    # Исключаем 'normal' из статистики, если есть другие фазы
    non_normal_scores = {k: v for k, v in phase_scores.items() if k != 'normal'}
    
    if non_normal_scores:
        max_phase = max(non_normal_scores.items(), key=lambda x: x[1])
        if max_phase[1] >= threshold:
            phase_name = {'depressive': 'Депрессивная', 'hypomanic': 'Гипоманиакальная', 'mixed': 'Смешанная'}[max_phase[0]]
            explanation_parts.append(f"{phase_name} фаза определена на основе статистики за последние {total_days} дней")
            explanation_parts.append(f"Фаза устойчива: {max_phase[1]} из {total_days} дней ({int(max_phase[1]/total_days*100)}%)")
            if max_phase[0] in ['depressive', 'hypomanic']:
                state = current_entry.get(f"{max_phase[0].replace('hypomanic', 'manic')}_state", 'none')
                explanation_parts.append(f"Текущее состояние: {EXPLANATION_TEXT.get(state, state)}")
            return max_phase[0], explanation_parts
    
    if current_dep_episode:
        explanation_parts.append("Депрессивная фаза определена на основе текущей записи")
        if total_days > 1:
            explanation_parts.append(f"За последние {total_days} дней фаза не была устойчивой (менее 50% дней)")
        state = current_entry.get('depressive_state', 'none')
        explanation_parts.append(f"Текущее депрессивное состояние: {EXPLANATION_TEXT.get(state, state)}")
        return 'depressive', explanation_parts
    elif current_man_episode:
        explanation_parts.append("Гипоманиакальная фаза определена на основе текущей записи")
        if total_days > 1:
            explanation_parts.append(f"За последние {total_days} дней фаза не была устойчивой (менее 50% дней)")
        state = current_entry.get('manic_state', 'none')
        explanation_parts.append(f"Текущее маниакальное состояние: {EXPLANATION_TEXT.get(state, state)}")
        return 'hypomanic', explanation_parts
    
    explanation_parts.append("Нормальная фаза определена на основе анализа")
    if total_days > 1:
        explanation_parts.append(f"За последние {total_days} дней не было устойчивых симптомов")
    return 'normal', explanation_parts

@bp.route('/')
def index():
    """Главная страница"""
    if current_user.is_authenticated:
        return redirect(url_for('main.entry'))
    return render_template('index.html')

@bp.route('/register', methods=['GET', 'POST'])
def register():
    """Регистрация нового пользователя"""
    if current_user.is_authenticated:
        return redirect(url_for('main.entry'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Валидация
        if not username or not password:
            flash('Пожалуйста, заполните все поля', 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Пароли не совпадают', 'error')
            return render_template('register.html')
        
        if len(password) < 6:
            flash('Пароль должен содержать минимум 6 символов', 'error')
            return render_template('register.html')
        
        db = get_db()
        
        # Проверка существования пользователя
        existing_user = db.get_user_by_username(username)
        if existing_user:
            flash('Пользователь с таким именем уже существует', 'error')
            return render_template('register.html')
        
        try:
            user_id = db.create_user(username, password)
            user = db.get_user_by_id(user_id)
            if user:
                login_user(user, remember=True)
                flash('Регистрация успешна!', 'success')
                return redirect(url_for('main.entry'))
        except Exception as e:
            flash(f'Ошибка: {str(e)}', 'error')
    
    return render_template('register.html')

@bp.route('/login', methods=['GET', 'POST'])
def login():
    """Авторизация пользователя"""
    if current_user.is_authenticated:
        return redirect(url_for('main.entry'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        if not username or not password:
            flash('Пожалуйста, заполните все поля', 'error')
            return render_template('login.html')
        
        db = get_db()
        
        if db.check_password(username, password):
            user_data = db.get_user_by_username(username)
            user = User(user_data['id'], user_data['username'], user_data['password_hash'])
            login_user(user, remember=True)
            return redirect(request.args.get('next') or url_for('main.entry'))
        flash('Неверное имя пользователя или пароль', 'error')
    
    return render_template('login.html')

@bp.route('/logout')
@login_required
def logout():
    """Выход из системы"""
    logout_user()
    flash('Вы успешно вышли из системы', 'success')
    return redirect(url_for('main.login'))

@bp.route('/dashboard')
@login_required
def dashboard():
    """Экран обзора и аналитики"""
    db = get_db()
    today = date.today()

    # Получение данных за последние 7 дней для графиков
    week_ago = today - timedelta(days=6)
    week_entries = db.get_entries_period(current_user.id, week_ago, today)
    
    # Получение текущей фазы на основе статистики
    current_phase = 'normal'
    current_phase_explanation = []
    if week_entries:
        last_entry = week_entries[-1]
        # Используем функцию определения фазы с учетом статистики
        current_phase, current_phase_explanation = determine_phase_with_statistics(
            current_entry={
                'depressive_state': last_entry.get('depressive_state', 'none'),
                'manic_state': last_entry.get('manic_state', 'none'),
                'sleep_hours': float(last_entry.get('sleep_hours', 0) or 0),
                'entry_date': last_entry.get('entry_date')
            },
            recent_entries=week_entries[:-1]  # Все записи кроме последней
        )
    
    return render_template('dashboard.html', 
                         week_entries=week_entries,
                         today=today,
                         current_phase=current_phase,
                         current_phase_explanation=current_phase_explanation)

@bp.route('/get_dashboard_data')
@login_required
def get_dashboard_data():
    """Получение данных для дашборда"""
    try:
        db = get_db()
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            return jsonify({'success': False, 'message': 'Не указаны даты'})
        
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        entries = db.get_entries_period(current_user.id, start_date, end_date)
        
        # Определение текущей фазы на основе статистики
        current_phase = 'normal'
        current_phase_explanation = []
        if entries:
            last_entry = entries[-1]
            # Используем функцию определения фазы с учетом статистики
            current_phase, current_phase_explanation = determine_phase_with_statistics(
                current_entry={
                    'depressive_state': last_entry.get('depressive_state', 'none'),
                    'manic_state': last_entry.get('manic_state', 'none'),
                    'sleep_hours': float(last_entry.get('sleep_hours', 0) or 0),
                    'entry_date': last_entry.get('entry_date')
                },
                recent_entries=entries[:-1]  # Все записи кроме последней
            )
        
        phase_chart_data = [{'date': e['entry_date'].strftime('%Y-%m-%d'), 'phase': e.get('day_type', 'normal')} for e in entries]
        
        chart_data = {
            'dates': [e['entry_date'].strftime('%Y-%m-%d') for e in entries],
            'mood': [e.get('mood', 5) for e in entries],
            'irritability': [e.get('irritability', 0) for e in entries],
            'anxiety': [e.get('anxiety', 0) for e in entries],
            'energy': [e.get('energy', 5) for e in entries],
            'sleep_hours': [float(e.get('sleep_hours', 0)) for e in entries]
        }
        
        recent_entries = [{
            'date': e['entry_date'].strftime('%Y-%m-%d'),
            'phase': e.get('day_type', 'normal'),
            'mood': e.get('mood', 5),
            'energy': e.get('energy', 5),
            'sleep_hours': float(e.get('sleep_hours', 0)),
            'notes': e.get('notes', '')
        } for e in entries]
        
        user_medications = db.get_user_medications(current_user.id)
        medications_data = {med['id']: {
            'name': med['name'],
            'dosage_mg': med.get('dosage_mg'),
            'time_of_day': med.get('time_of_day'),
            'frequency': med.get('frequency', 'daily'),
            'intakes': []
        } for med in user_medications}
        
        for entry in entries:
            entry_date = entry['entry_date'].strftime('%Y-%m-%d')
            med_intakes = {mi['med_id']: mi for mi in db.get_medication_intakes(entry['id'])}
            for med_id in medications_data:
                medications_data[med_id]['intakes'].append({
                    'date': entry_date,
                    'taken': med_intakes.get(med_id, {}).get('taken') != 'none'
                })
        
        sleep_data = {
            'dates': [e['entry_date'].strftime('%Y-%m-%d') for e in entries],
            'hours': [float(e.get('sleep_hours', 0)) for e in entries],
            'quality': [e.get('sleep_quality') or 'average' for e in entries]
        }
        
        return jsonify({
            'success': True,
            'current_phase': current_phase,
            'phase_chart_data': phase_chart_data,
            'chart_data': chart_data,
            'recent_entries': recent_entries,
            'medications_data': medications_data,
            'sleep_data': sleep_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@bp.route('/entry')
@login_required
def entry():
    """Страница ввода/редактирования дневной записи"""
    db = get_db()
    today = date.today()

    # Справочники для формы
    medications = db.get_user_medications(current_user.id)
    custom_trackers = db.get_user_trackers(current_user.id)
    custom_states = db.get_user_custom_states(current_user.id)

    return render_template(
        'entry.html',
        today=today,
        medications=medications,
        custom_trackers=custom_trackers,
        custom_states=custom_states,
    )

@bp.route('/psychoeducation')
@login_required
def psychoeducation():
    """Страница психообразования"""
    return render_template('psychoeducation.html')

@bp.route('/save_entry', methods=['POST'])
@login_required
def save_entry():
    """Сохранение ежедневной записи"""
    try:
        db = get_db()
        data = request.json
        entry_date = datetime.strptime(data['date'], '%Y-%m-%d').date()

        entry_id = db.create_entry(
            user_id=current_user.id,
            entry_date=entry_date,
            mood=int(data.get('mood', 5)),
            irritability=int(data.get('irritability', 0)),
            anxiety=int(data.get('anxiety', 0)),
            energy=int(data.get('energy', 5)),
            sleep_hours=float(data.get('sleep_hours', 0)),
            sleep_quality=data.get('sleep_quality', 'average'),
            notes=data.get('notes', ''),
            depressive_state=data.get('depressive_state', 'none'),
            manic_state=data.get('manic_state', 'none'),
            irritable_state=data.get('irritable_state', 'none'),
            anxious_state=data.get('anxious_state', 'none'),
            psychotic_symptoms=bool(data.get('psychotic_symptoms', False)),
            psychotherapy=bool(data.get('psychotherapy', False)),
        )
        
        if not entry_id:
            existing_entry = db.get_entry(current_user.id, entry_date)
            entry_id = existing_entry['id']

        analysis_start = entry_date - timedelta(days=6)
        recent_entries = db.get_entries_period(current_user.id, analysis_start, entry_date)
        
        day_type, explanation = determine_phase_with_statistics(
            current_entry={
                'depressive_state': data.get('depressive_state', 'none'),
                'manic_state': data.get('manic_state', 'none'),
                'sleep_hours': float(data.get('sleep_hours', 0) or 0),
                'entry_date': entry_date
            },
            recent_entries=recent_entries
        )

        db.update_day_type(entry_id, day_type)
        
        for med_id, taken in data.get('medications', {}).items():
            db.add_medication_intake(entry_id, int(med_id), 'full' if taken else 'none')
        
        for tracker_id, value in data.get('custom_values', {}).items():
            db.add_custom_value(entry_id, int(tracker_id), str(value))
        
        for state_id, value in data.get('custom_state_values', {}).items():
            db.add_custom_state_value(entry_id, int(state_id), str(value))
        
        explanation_display = []
        for exp in explanation:
            for k, v in EXPLANATION_TEXT.items():
                exp = exp.replace(k, v)
            explanation_display.append(exp)
        
        return jsonify({
            'success': True, 
            'message': 'Запись сохранена', 
            'day_type': day_type,
            'day_type_explanation': explanation_display
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/get_entry/<date>')
@login_required
def get_entry(date):
    """Получение записи за конкретную дату"""
    try:
        db = get_db()
        entry_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        entry = db.get_entry(current_user.id, entry_date)
        if not entry:
            return jsonify({'exists': False})
        
        # Получение приемов лекарств (теперь просто да/нет)
        med_intakes = db.get_medication_intakes(entry['id'])
        medications = {str(m['med_id']): m['taken'] != 'none' for m in med_intakes}
        
        # Получение кастомных значений
        custom_values_data = db.get_custom_values(entry['id'])
        custom_values = {str(cv['tracker_id']): cv['value'] for cv in custom_values_data}
        
        # Получение значений пользовательских состояний
        custom_state_values_data = db.get_custom_state_values(entry['id'])
        custom_state_values = {str(csv['state_id']): csv['value'] for csv in custom_state_values_data}
        
        return jsonify({
            'exists': True,
            'entry': {
                'mood': entry['mood'],
                'irritability': entry['irritability'],
                'anxiety': entry['anxiety'],
                'energy': entry['energy'],
                'sleep_hours': float(entry['sleep_hours']),
                'sleep_quality': entry['sleep_quality'],
                'day_type': entry['day_type'],
                'notes': entry['notes'] or '',
                'depressive_state': entry.get('depressive_state') or 'none',
                'manic_state': entry.get('manic_state') or 'none',
                'irritable_state': entry.get('irritable_state') or 'none',
                'anxious_state': entry.get('anxious_state') or 'none',
                'psychotic_symptoms': bool(entry.get('psychotic_symptoms')) if entry.get('psychotic_symptoms') is not None else False,
                'psychotherapy': bool(entry.get('psychotherapy')) if entry.get('psychotherapy') is not None else False,
            },
            'medications': medications,
            'custom_values': custom_values,
            'custom_state_values': custom_state_values
        })
    except Exception as e:
        return jsonify({'error': str(e)})

@bp.route('/add_medication', methods=['POST'])
@login_required
def add_medication():
    """Добавление нового лекарства"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': 'Введите название лекарства'})
        
        med_id = get_db().create_medication(current_user.id, name, data.get('dosage_mg'), data.get('time_of_day'), data.get('frequency', 'daily'))
        return jsonify({'success': True, 'medication': {'id': med_id, 'name': name, 'dosage_mg': data.get('dosage_mg'), 'time_of_day': data.get('time_of_day'), 'frequency': data.get('frequency', 'daily')}})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/add_tracker', methods=['POST'])
@login_required
def add_tracker():
    """Добавление кастомного трекера"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': 'Введите название трекера'})
        
        tracker_id = get_db().create_custom_tracker(current_user.id, name, data.get('type', 'slider'), int(data.get('min_value', 0)), int(data.get('max_value', 10)))
        return jsonify({'success': True, 'tracker': {'id': tracker_id, 'name': name, 'type': data.get('type', 'slider'), 'min_value': int(data.get('min_value', 0)), 'max_value': int(data.get('max_value', 10))}})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/add_custom_state', methods=['POST'])
@login_required
def add_custom_state():
    """Добавление пользовательского состояния"""
    try:
        db = get_db()
        data = request.json
        
        name = data.get('name', '').strip()
        mark_type = data.get('mark_type', 'categorical')
        options = data.get('options') or []
        
        if not name:
            return jsonify({'success': False, 'message': 'Введите название состояния'})
        
        # Создаем состояние
        state_id = db.create_custom_state(current_user.id, name, mark_type)
        
        saved_options = []
        if mark_type == 'multi_checkbox':
            for pos, raw_label in enumerate([l.strip() for l in options if l and l.strip()]):
                db.create_custom_state_option(state_id, raw_label, pos)
                saved_options.append(raw_label)
        
        return jsonify({
            'success': True,
            'state': {'id': state_id, 'name': name, 'mark_type': mark_type, 'options': saved_options if mark_type == 'multi_checkbox' else None}
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/update_custom_state', methods=['POST'])
@login_required
def update_custom_state():
    """Обновление пользовательского состояния"""
    try:
        db = get_db()
        data = request.json
        
        state_id = data.get('state_id')
        name = data.get('name', '').strip()
        mark_type = data.get('mark_type', 'categorical')
        options = data.get('options') or []
        
        if not state_id or not name:
            return jsonify({'success': False, 'message': 'Не указаны обязательные поля'})
        
        # Обновляем состояние
        db.update_custom_state(state_id, current_user.id, name, mark_type)
        
        saved_options = []
        if mark_type == 'multi_checkbox':
            db.delete_custom_state_options(state_id)
            for pos, label in enumerate([l.strip() for l in options if l and l.strip()]):
                db.create_custom_state_option(state_id, label, pos)
                saved_options.append(label)
        
        return jsonify({
            'success': True,
            'state': {'id': state_id, 'name': name, 'mark_type': mark_type, 'options': saved_options or None}
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/update_medication', methods=['POST'])
@login_required
def update_medication():
    """Обновление лекарства"""
    try:
        db = get_db()
        data = request.json
        
        med_id = data.get('med_id')
        name = data.get('name', '').strip()
        dosage_mg = data.get('dosage_mg')
        time_of_day = data.get('time_of_day')
        frequency = data.get('frequency', 'daily')
        
        if not med_id or not name:
            return jsonify({'success': False, 'message': 'Не указаны обязательные поля'})
        
        db.update_medication(med_id, current_user.id, name, dosage_mg, time_of_day, frequency)
        
        return jsonify({
            'success': True,
            'medication': {
                'id': med_id,
                'name': name,
                'dosage_mg': dosage_mg,
                'time_of_day': time_of_day,
                'frequency': frequency
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/delete_medication', methods=['POST'])
@login_required
def delete_medication():
    """Удаление лекарства пользователя"""
    try:
        db = get_db()
        data = request.json
        med_id = data.get('med_id')

        if not med_id:
            return jsonify({'success': False, 'message': 'Не указан идентификатор лекарства'})
        
        db.delete_medication(med_id, current_user.id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/analytics')
@login_required
def analytics():
    """Страница аналитики"""
    return render_template('analytics.html')

@bp.route('/get_analytics_data')
@login_required
def get_analytics_data():
    """Получение данных для аналитики"""
    try:
        db = get_db()
        period = request.args.get('period', '30')
        
        period_days = {'7': 6, '30': 29, '90': 89}.get(period, 29)
        end_date = date.today()
        start_date = end_date - timedelta(days=period_days)
        entries = db.get_entries_with_custom_data(current_user.id, start_date, end_date)
        
        chart_data = {
            'dates': [e['entry_date'].strftime('%Y-%m-%d') for e in entries],
            'mood': [e['mood'] for e in entries],
            'irritability': [e['irritability'] for e in entries],
            'anxiety': [e['anxiety'] for e in entries],
            'energy': [e['energy'] for e in entries],
            'sleep_hours': [float(e['sleep_hours']) for e in entries],
            'day_types': [e['day_type'] for e in entries],
            'medications': {},
            'custom_trackers': {}
        }
        
        for entry in entries:
            if entry.get('medications'):
                for med_data in entry['medications'].split(';'):
                    if ':' in med_data:
                        med_name, taken = med_data.split(':', 1)
                        chart_data['medications'].setdefault(med_name, []).append(taken)
            
            if entry.get('custom_values'):
                for tracker_data in entry['custom_values'].split(';'):
                    if ':' in tracker_data:
                        tracker_name, value = tracker_data.split(':', 1)
                        try:
                            value = float(value)
                        except ValueError:
                            pass
                        chart_data['custom_trackers'].setdefault(tracker_name, []).append(value)
        
        return jsonify({
            'success': True,
            'data': chart_data,
            'period': period
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/delete_custom_state', methods=['POST'])
@login_required
def delete_custom_state():
    """Удаление пользовательского состояния"""
    try:
        db = get_db()
        data = request.json
        
        state_id = data.get('state_id')
        if not state_id:
            return jsonify({'success': False, 'message': 'Не указан идентификатор состояния'})
        
        db.delete_custom_state(state_id, current_user.id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/report_settings')
@login_required
def report_settings():
    """Страница настройки отчёта"""
    db = get_db()
    last_entry_date = db.get_last_entry_date(current_user.id)
    return render_template('report_settings.html', last_entry_date=last_entry_date)

@bp.route('/generate_report')
@login_required
def generate_report():
    """Генерация PDF отчёта"""
    try:
        from report_generator import ReportGenerator
        
        db = get_db()
        
        # Получение параметров
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            return jsonify({'success': False, 'message': 'Не указаны даты'}), 400
        
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        
        # Проверка дат - используем дату последней записи вместо сегодняшней даты
        last_entry_date = db.get_last_entry_date(current_user.id)
        if not last_entry_date:
            return jsonify({'success': False, 'message': 'Нет записей для генерации отчёта'}), 400
        
        if start_date > last_entry_date or end_date > last_entry_date:
            return jsonify({'success': False, 'message': f'Нельзя выбирать даты позже последней записи ({last_entry_date.strftime("%d.%m.%Y")})'}), 400
        
        if start_date > end_date:
            return jsonify({'success': False, 'message': 'Начальная дата должна быть раньше конечной'}), 400
        
        sections_list = request.args.getlist('sections')
        sections = {section: True for section in sections_list} if sections_list else {
            'phase_history': True,
            'sleep_stats': True,
            'states_chart': True,
            'notes': True
        }
        
        generator = ReportGenerator(db, current_user.id, current_user.username)
        pdf_bytes = generator.generate_report(
            start_date=start_date,
            end_date=end_date,
            sections=sections,
            comment=request.args.get('comment', '').strip() or None
        )
        
        filename = f'affecta_report_{start_date_str}_{end_date_str}.pdf'
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@bp.route('/export_pdf')
@login_required
def export_pdf():
    """Экспорт отчета в PDF (старый маршрут, перенаправляет на настройку)"""
    return redirect(url_for('main.report_settings'))