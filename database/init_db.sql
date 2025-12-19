--
-- Инициализация базы данных для биполярного трекера "Affecta"
-- База данных: Treker
--

-- Создание базы данных, если она не существует
CREATE DATABASE IF NOT EXISTS Treker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Использование базы данных
USE Treker;

-- Таблица пользователей (авторизация)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) COMMENT = 'Таблица пользователей системы';

-- Таблица ежедневных записей (основные шкалы как в eMoods)
CREATE TABLE IF NOT EXISTS entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entry_date DATE NOT NULL,
    mood INT DEFAULT 5 COMMENT 'DEPRECATED: числовая шкала настроения 0-10, используйте depressive_state/manic_state',
    irritability INT DEFAULT 0 COMMENT 'DEPRECATED: числовая шкала раздражительности 0-10, используйте irritable_state',
    anxiety INT DEFAULT 0 COMMENT 'DEPRECATED: числовая шкала тревоги 0-10, используйте anxious_state',
    energy INT DEFAULT 5 COMMENT 'DEPRECATED: числовая шкала энергии 0-10, используйте manic_state',
    depressive_state ENUM('none', 'mild', 'moderate', 'severe') DEFAULT 'none',
    manic_state ENUM('none', 'mild', 'moderate', 'severe') DEFAULT 'none',
    irritable_state ENUM('none', 'mild', 'moderate', 'severe') DEFAULT 'none',
    anxious_state ENUM('none', 'mild', 'moderate', 'severe') DEFAULT 'none',
    psychotic_symptoms TINYINT(1) DEFAULT 0,
    psychotherapy TINYINT(1) DEFAULT 0,
    sleep_hours DECIMAL(4,2) DEFAULT 0.00,
    sleep_quality ENUM('poor', 'average', 'good') DEFAULT 'average',
    day_type ENUM('depressive', 'normal', 'hypomanic', 'mixed') DEFAULT 'normal',
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_entry (user_id, entry_date),
    CHECK (sleep_hours BETWEEN 0 AND 16)
) COMMENT = 'Ежедневные записи состояния пользователя';

-- Таблица лекарств (динамический список для пользователя)
CREATE TABLE IF NOT EXISTS medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    dosage_mg INT DEFAULT NULL COMMENT 'Дозировка в миллиграммах',
    time_of_day ENUM('morning', 'afternoon', 'evening', 'night') DEFAULT NULL COMMENT 'Время приёма в течение дня',
    frequency ENUM('daily', 'as_needed') DEFAULT 'daily' COMMENT 'Частота приёма: ежедневно или по необходимости',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT = 'Список лекарств пользователя';

-- Таблица приёма лекарств (для каждой записи)
CREATE TABLE IF NOT EXISTS med_intakes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    med_id INT NOT NULL,
    taken ENUM('full', 'half', 'none') DEFAULT 'full',
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    FOREIGN KEY (med_id) REFERENCES medications(id) ON DELETE CASCADE,
    UNIQUE KEY unique_med_intake (entry_id, med_id)
) COMMENT = 'Информация о приеме лекарств для каждой записи';

-- Таблица кастомных трекеров (пользовательские метрики)
CREATE TABLE IF NOT EXISTS custom_trackers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('slider', 'checkbox', 'number') DEFAULT 'slider',
    min_value INT DEFAULT 0,
    max_value INT DEFAULT 10,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT = 'Пользовательские трекеры для отслеживания дополнительных параметров';

-- Таблица значений кастомных трекеров (для каждой записи)
CREATE TABLE IF NOT EXISTS custom_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    tracker_id INT NOT NULL,
    value VARCHAR(255) NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    FOREIGN KEY (tracker_id) REFERENCES custom_trackers(id) ON DELETE CASCADE
) COMMENT = 'Значения пользовательских трекеров для каждой записи';

-- Таблица пользовательских состояний
CREATE TABLE IF NOT EXISTS custom_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL COMMENT 'Название состояния',
    mark_type ENUM('binary', 'categorical', 'numeric', 'multi_checkbox') NOT NULL DEFAULT 'categorical' COMMENT 'Тип отметки: да/нет, категориальный, числовая шкала, множественный выбор',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT = 'Пользовательские состояния для ежедневного заполнения';

-- Таблица значений пользовательских состояний (для каждой записи)
CREATE TABLE IF NOT EXISTS custom_state_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    state_id INT NOT NULL,
    value VARCHAR(255) NOT NULL COMMENT 'Значение состояния: yes/no, none/mild/moderate/severe, число 0-10, или список значений для множественного выбора',
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    FOREIGN KEY (state_id) REFERENCES custom_states(id) ON DELETE CASCADE,
    UNIQUE KEY unique_state_entry (entry_id, state_id)
) COMMENT = 'Значения пользовательских состояний для каждой дневной записи';

-- Таблица вариантов (опций) для пользовательских состояний с типом multi_checkbox
CREATE TABLE IF NOT EXISTS custom_state_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    state_id INT NOT NULL,
    label VARCHAR(255) NOT NULL COMMENT 'Подпись варианта чекбокса',
    position INT NOT NULL DEFAULT 0 COMMENT 'Порядок сортировки варианта внутри состояния',
    FOREIGN KEY (state_id) REFERENCES custom_states(id) ON DELETE CASCADE
) COMMENT = 'Варианты чекбоксов для пользовательских состояний';

-- Индексы для оптимизации запросов
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date);
CREATE INDEX idx_med_intakes_entry ON med_intakes(entry_id);
CREATE INDEX idx_custom_values_entry ON custom_values(entry_id);
CREATE INDEX idx_medications_user ON medications(user_id);
CREATE INDEX idx_custom_trackers_user ON custom_trackers(user_id);
CREATE INDEX idx_custom_states_user ON custom_states(user_id);
CREATE INDEX idx_custom_state_values_entry ON custom_state_values(entry_id);
CREATE INDEX idx_custom_state_options_state ON custom_state_options(state_id);

-- Примеры данных для тестирования (опционально)
-- Создание тестового пользователя (username: test, password: test123)
-- INSERT INTO users (username, password_hash) VALUES 
-- ('test', '$2b$12$KIXxPft7r3uCJlU5xQ4XcO6P8fZj9bN7qLzQ8w3y4v5m6n7p8q9r0s');

-- Примеры записей (для тестового пользователя с ID=1)
-- INSERT INTO entries (user_id, entry_date, mood, irritability, anxiety, energy, sleep_hours, sleep_quality, day_type, notes) VALUES
-- (1, '2024-01-01', 7, 2, 1, 6, 8.0, 'good', 'normal', 'Хорошее начало года'),
-- (1, '2024-01-02', 5, 4, 3, 4, 6.5, 'average', 'normal', 'Немного тревожно'),
-- (1, '2024-01-03', 3, 6, 5, 2, 5.0, 'poor', 'depressive', 'Тяжелый день');

-- Примеры лекарств
-- INSERT INTO medications (user_id, name, dosage_mg, time_of_day, frequency) VALUES 
-- (1, 'Ламотриджин', 100, 'morning', 'daily'),
-- (1, 'Кветиапин', 25, 'evening', 'daily'),
-- (1, 'Венлафаксин', 75, 'morning', 'daily');

-- Примеры кастомных трекеров
-- INSERT INTO custom_trackers (user_id, name, type, min_value, max_value) VALUES 
-- (1, 'Физическая активность', 'slider', 0, 10),
-- (1, 'Социальные взаимодействия', 'number', 0, 50),
-- (1, 'Прием алкоголя', 'checkbox', 0, 1);

-- Вывод информации о созданных таблицах
SHOW TABLES;

-- Вывод структуры таблиц
DESCRIBE users;
DESCRIBE entries;
DESCRIBE medications;
DESCRIBE med_intakes;
DESCRIBE custom_trackers;
DESCRIBE custom_values;
DESCRIBE custom_states;
DESCRIBE custom_state_values;
DESCRIBE custom_state_options;
