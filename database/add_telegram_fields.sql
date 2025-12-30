--
-- Миграция: Добавление полей для авторизации через Telegram
-- База данных: Treker
-- Таблица: users
--
-- Добавляет поля:
--   - gender (пол) - ENUM('male', 'female', 'other')
--   - tg_id (Telegram ID) - BIGINT UNIQUE для будущей авторизации через Telegram
--

USE Treker;

-- Добавление поля пол (gender)
ALTER TABLE users 
ADD COLUMN gender ENUM('male', 'female', 'other') DEFAULT NULL 
COMMENT 'Пол пользователя';

-- Добавление поля Telegram ID (tg_id)
ALTER TABLE users 
ADD COLUMN tg_id BIGINT UNIQUE DEFAULT NULL 
COMMENT 'Telegram ID пользователя для авторизации через Telegram';

-- Создание индекса для быстрого поиска по Telegram ID
CREATE INDEX idx_users_tg_id ON users(tg_id);

-- Вывод структуры таблицы users для проверки
DESCRIBE users;

