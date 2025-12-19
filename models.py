"""
Модели базы данных для биполярного трекера "Affecta"
Проект для защиты - студент 20 лет

Класс Database:
- Подключение к MySQL через PyMySQL
- Методы для работы с пользователями, записями, лекарствами
- Методы для работы с кастомными трекерами и состояниями

Класс User:
- Модель пользователя для Flask-Login
- Реализация интерфейса UserMixin
"""

import os
import pymysql
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv('.env')

def get_db_config():
    """Получение конфигурации БД"""
    db_host = os.environ.get('DB_HOST', 'localhost')
    db_user = os.environ.get('DB_USER', 'root')
    db_pass = os.environ.get('DB_PASS', '')
    db_name = os.environ.get('DB_NAME', 'treker')
    db_port = os.environ.get('DB_PORT', '3306')
    
    config = {
        'host': db_host,
        'user': db_user,
        'database': db_name,
        'charset': 'utf8mb4',
        'cursorclass': pymysql.cursors.DictCursor
    }
    
    if db_port:
        try:
            config['port'] = int(db_port)
        except ValueError:
            pass
    
    if db_pass:
        config['password'] = db_pass.strip()
    
    return config

class Database:
    """Класс для работы с базой данных"""
    
    def __init__(self):
        """Инициализация подключения к БД"""
        self.connection = None
        self.connect()
    
    def connect(self):
        """Установка соединения с БД"""
        try:
            db_config = get_db_config()
            db_config['connect_timeout'] = 10
            db_config['read_timeout'] = 10
            db_config['write_timeout'] = 10
            self.connection = pymysql.connect(**db_config)
        except pymysql.Error as e:
            print(f"Ошибка подключения к БД: {e}")
            raise
    
    def close(self):
        """Закрытие соединения с БД"""
        if self.connection:
            self.connection.close()
    
    def execute_query(self, query, params=None, fetch=True):
        """Выполнение SQL запроса"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(query, params or ())
                self.connection.commit()
                return cursor.fetchall() if fetch else cursor.lastrowid
        except pymysql.Error:
            self.connection.rollback()
            raise
    
    # Методы для работы с пользователями
    def create_user(self, username, password):
        """Создание нового пользователя"""
        password_hash = generate_password_hash(password)
        query = """
            INSERT INTO users (username, password_hash)
            VALUES (%s, %s)
        """
        user_id = self.execute_query(query, (username, password_hash), fetch=False)
        return user_id
    
    def get_user_by_username(self, username):
        """Получение пользователя по имени"""
        query = "SELECT * FROM users WHERE username = %s"
        result = self.execute_query(query, (username,))
        return result[0] if result else None
    
    def get_user_by_id(self, user_id):
        """Получение пользователя по ID"""
        query = "SELECT * FROM users WHERE id = %s"
        result = self.execute_query(query, (user_id,))
        if result:
            user_data = result[0]
            return User(user_data['id'], user_data['username'], user_data['password_hash'])
        return None
    
    def check_password(self, username, password):
        """Проверка пароля пользователя"""
        user_data = self.get_user_by_username(username)
        if user_data:
            return check_password_hash(user_data['password_hash'], password)
        return False
    
    # Методы для работы с записями
    def create_entry(
        self,
        user_id,
        entry_date,
        mood,
        irritability,
        anxiety,
        energy,
        sleep_hours,
        sleep_quality,
        notes=None,
        depressive_state='none',
        manic_state='none',
        irritable_state='none',
        anxious_state='none',
        psychotic_symptoms=False,
        psychotherapy=False,
    ):
        """Создание новой записи.

        Числовые поля mood/irritability/anxiety/energy считаются устаревшими и
        могут заполняться как производные от категориальных состояний для
        обратной совместимости и аналитики.
        """
        query = """
            INSERT INTO entries (
                user_id,
                entry_date,
                mood,
                irritability,
                anxiety,
                energy,
                sleep_hours,
                sleep_quality,
                notes,
                depressive_state,
                manic_state,
                irritable_state,
                anxious_state,
                psychotic_symptoms,
                psychotherapy
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                mood = VALUES(mood),
                irritability = VALUES(irritability),
                anxiety = VALUES(anxiety),
                energy = VALUES(energy),
                sleep_hours = VALUES(sleep_hours),
                sleep_quality = VALUES(sleep_quality),
                notes = VALUES(notes),
                depressive_state = VALUES(depressive_state),
                manic_state = VALUES(manic_state),
                irritable_state = VALUES(irritable_state),
                anxious_state = VALUES(anxious_state),
                psychotic_symptoms = VALUES(psychotic_symptoms),
                psychotherapy = VALUES(psychotherapy)
        """
        return self.execute_query(
            query,
            (
                user_id,
                entry_date,
                mood,
                irritability,
                anxiety,
                energy,
                sleep_hours,
                sleep_quality,
                notes,
                depressive_state,
                manic_state,
                irritable_state,
                anxious_state,
                int(bool(psychotic_symptoms)),
                int(bool(psychotherapy)),
            ),
            fetch=False,
        )

    def update_day_type(self, entry_id, day_type):
        """Обновление типа дня для уже сохранённой записи"""
        query = """
            UPDATE entries
            SET day_type = %s
            WHERE id = %s
        """
        self.execute_query(query, (day_type, entry_id), fetch=False)
    
    def get_entry(self, user_id, entry_date):
        """Получение записи за конкретную дату"""
        query = """
            SELECT * FROM entries 
            WHERE user_id = %s AND entry_date = %s
        """
        result = self.execute_query(query, (user_id, entry_date))
        return result[0] if result else None
    
    def get_entries_period(self, user_id, start_date, end_date):
        """Получение записей за период"""
        query = """
            SELECT * FROM entries 
            WHERE user_id = %s AND entry_date BETWEEN %s AND %s
            ORDER BY entry_date ASC
        """
        return self.execute_query(query, (user_id, start_date, end_date))
    
    def get_last_entry_date(self, user_id):
        """Получение даты последней записи пользователя"""
        query = """
            SELECT MAX(entry_date) as last_date
            FROM entries 
            WHERE user_id = %s
        """
        result = self.execute_query(query, (user_id,))
        if result and result[0] and result[0]['last_date']:
            return result[0]['last_date']
        return None
    
    # Методы для работы с лекарствами
    def create_medication(self, user_id, name, dosage_mg=None, time_of_day=None, frequency='daily'):
        """Создание нового лекарства"""
        query = """
            INSERT INTO medications (user_id, name, dosage_mg, time_of_day, frequency)
            VALUES (%s, %s, %s, %s, %s)
        """
        return self.execute_query(query, (user_id, name, dosage_mg, time_of_day, frequency), fetch=False)
    
    def get_user_medications(self, user_id):
        """Получение списка лекарств пользователя"""
        query = """
            SELECT * FROM medications 
            WHERE user_id = %s 
            ORDER BY name ASC
        """
        return self.execute_query(query, (user_id,))
    
    def add_medication_intake(self, entry_id, med_id, taken='full'):
        """Добавление информации о приеме лекарства"""
        query = """
            INSERT INTO med_intakes (entry_id, med_id, taken)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE taken = VALUES(taken)
        """
        self.execute_query(query, (entry_id, med_id, taken), fetch=False)
    
    def get_medication_intakes(self, entry_id):
        """Получение информации о приемах лекарств для записи"""
        query = """
            SELECT m.name, mi.taken, m.id as med_id, m.dosage_mg, m.time_of_day, m.frequency
            FROM med_intakes mi
            JOIN medications m ON mi.med_id = m.id
            WHERE mi.entry_id = %s
        """
        return self.execute_query(query, (entry_id,))
    
    # Методы для работы с кастомными трекерами
    def create_custom_tracker(self, user_id, name, tracker_type, min_value=0, max_value=10):
        """Создание кастомного трекера"""
        query = """
            INSERT INTO custom_trackers (user_id, name, type, min_value, max_value)
            VALUES (%s, %s, %s, %s, %s)
        """
        return self.execute_query(query, (user_id, name, tracker_type, min_value, max_value), fetch=False)
    
    def get_user_trackers(self, user_id):
        """Получение списка кастомных трекеров пользователя"""
        query = """
            SELECT * FROM custom_trackers 
            WHERE user_id = %s 
            ORDER BY name ASC
        """
        return self.execute_query(query, (user_id,))
    
    def add_custom_value(self, entry_id, tracker_id, value):
        """Добавление значения кастомного трекера"""
        query = """
            INSERT INTO custom_values (entry_id, tracker_id, value)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE value = VALUES(value)
        """
        self.execute_query(query, (entry_id, tracker_id, value), fetch=False)
    
    def get_custom_values(self, entry_id):
        """Получение значений кастомных трекеров для записи"""
        query = """
            SELECT ct.name, ct.type, cv.value, ct.min_value, ct.max_value, ct.id as tracker_id
            FROM custom_values cv
            JOIN custom_trackers ct ON cv.tracker_id = ct.id
            WHERE cv.entry_id = %s
        """
        return self.execute_query(query, (entry_id,))
    
    def get_entries_with_custom_data(self, user_id, start_date, end_date):
        """Получение записей с кастомными данными за период"""
        query = """
            SELECT e.*, 
                   GROUP_CONCAT(DISTINCT CONCAT(m.name, ':', mi.taken) SEPARATOR ';') as medications,
                   GROUP_CONCAT(DISTINCT CONCAT(ct.name, ':', cv.value) SEPARATOR ';') as custom_values
            FROM entries e
            LEFT JOIN med_intakes mi ON e.id = mi.entry_id
            LEFT JOIN medications m ON mi.med_id = m.id
            LEFT JOIN custom_values cv ON e.id = cv.entry_id
            LEFT JOIN custom_trackers ct ON cv.tracker_id = ct.id
            WHERE e.user_id = %s AND e.entry_date BETWEEN %s AND %s
            GROUP BY e.id
            ORDER BY e.entry_date ASC
        """
        return self.execute_query(query, (user_id, start_date, end_date))
    
    # Методы для работы с пользовательскими состояниями
    def create_custom_state(self, user_id, name, mark_type='categorical'):
        """Создание пользовательского состояния"""
        query = """
            INSERT INTO custom_states (user_id, name, mark_type)
            VALUES (%s, %s, %s)
        """
        return self.execute_query(query, (user_id, name, mark_type), fetch=False)
    
    def create_custom_state_option(self, state_id, label, position=0):
        """Создание варианта (опции) для пользовательского состояния типа multi_checkbox"""
        query = """
            INSERT INTO custom_state_options (state_id, label, position)
            VALUES (%s, %s, %s)
        """
        return self.execute_query(query, (state_id, label, position), fetch=False)
    
    def get_user_custom_states(self, user_id):
        """Получение списка пользовательских состояний пользователя"""
        query = """
            SELECT 
                cs.*,
                GROUP_CONCAT(so.label ORDER BY so.position SEPARATOR '||') AS options
            FROM custom_states cs
            LEFT JOIN custom_state_options so ON so.state_id = cs.id
            WHERE cs.user_id = %s
            GROUP BY cs.id
            ORDER BY cs.name ASC
        """
        return self.execute_query(query, (user_id,))
    
    def add_custom_state_value(self, entry_id, state_id, value):
        """Добавление значения пользовательского состояния"""
        query = """
            INSERT INTO custom_state_values (entry_id, state_id, value)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE value = VALUES(value)
        """
        self.execute_query(query, (entry_id, state_id, value), fetch=False)
    
    def get_custom_state_values(self, entry_id):
        """Получение значений пользовательских состояний для записи"""
        query = """
            SELECT cs.name, cs.mark_type, csv.value, cs.id as state_id
            FROM custom_state_values csv
            JOIN custom_states cs ON csv.state_id = cs.id
            WHERE csv.entry_id = %s
        """
        return self.execute_query(query, (entry_id,))
    
    def update_custom_state(self, state_id, user_id, name, mark_type):
        """Обновление пользовательского состояния"""
        query = """
            UPDATE custom_states 
            SET name = %s, mark_type = %s 
            WHERE id = %s AND user_id = %s
        """
        self.execute_query(query, (name, mark_type, state_id, user_id), fetch=False)
    
    def delete_custom_state_options(self, state_id):
        """Удаление всех опций пользовательского состояния"""
        query = "DELETE FROM custom_state_options WHERE state_id = %s"
        self.execute_query(query, (state_id,), fetch=False)
    
    def get_custom_state_options(self, state_id):
        """Получение опций пользовательского состояния"""
        query = """
            SELECT id, label, position 
            FROM custom_state_options 
            WHERE state_id = %s 
            ORDER BY position ASC
        """
        return self.execute_query(query, (state_id,))
    
    def delete_custom_state(self, state_id, user_id):
        """Удаление пользовательского состояния вместе с его значениями и опциями"""
        # Удаляем значения этого состояния в записях пользователя
        query_values = """
            DELETE csv FROM custom_state_values csv
            JOIN entries e ON csv.entry_id = e.id
            WHERE csv.state_id = %s AND e.user_id = %s
        """
        self.execute_query(query_values, (state_id, user_id), fetch=False)

        # Удаляем опции состояния
        query_options = "DELETE FROM custom_state_options WHERE state_id = %s"
        self.execute_query(query_options, (state_id,), fetch=False)

        # Удаляем само состояние
        query_state = "DELETE FROM custom_states WHERE id = %s AND user_id = %s"
        self.execute_query(query_state, (state_id, user_id), fetch=False)
    
    def delete_medication(self, med_id, user_id):
        """Удаление лекарства вместе со всеми приёмами у этого пользователя"""
        # Сначала удаляем приёмы, связанные с записями этого пользователя
        query_intakes = """
            DELETE mi FROM med_intakes mi
            JOIN entries e ON mi.entry_id = e.id
            WHERE mi.med_id = %s AND e.user_id = %s
        """
        self.execute_query(query_intakes, (med_id, user_id), fetch=False)

        # Затем удаляем само лекарство
        query_med = "DELETE FROM medications WHERE id = %s AND user_id = %s"
        self.execute_query(query_med, (med_id, user_id), fetch=False)
    
    def update_medication(self, med_id, user_id, name, dosage_mg=None, time_of_day=None, frequency='daily'):
        """Обновление лекарства"""
        query = """
            UPDATE medications 
            SET name = %s, dosage_mg = %s, time_of_day = %s, frequency = %s 
            WHERE id = %s AND user_id = %s
        """
        self.execute_query(query, (name, dosage_mg, time_of_day, frequency, med_id, user_id), fetch=False)

class User(UserMixin):
    """Класс пользователя для Flask-Login"""
    
    def __init__(self, user_id, username, password_hash):
        self.id = user_id
        self.username = username
        self.password_hash = password_hash
    
    def get_id(self):
        """Возвращает ID пользователя"""
        return str(self.id)
    
    def is_authenticated(self):
        """Проверка аутентификации"""
        return True
    
    def is_active(self):
        """Проверка активности"""
        return True
    
    def is_anonymous(self):
        """Проверка анонимности"""
        return False