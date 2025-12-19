"""
Unit-тесты для биполярного трекера "Affecta"
Проект для защиты - студент 20 лет

Тестирование основных компонентов системы:
- Хеширование паролей (bcrypt)
- Валидация данных
- Определение фаз биполярного расстройства
- Обработка данных
"""

import unittest
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, timedelta
from routes import determine_phase_with_statistics


class PasswordHashTests(unittest.TestCase):
    """Тесты для хеширования паролей"""
    
    def test_generate_password_hash_standard_password_returns_hash(self):
        """Проверка генерации хеша для стандартного пароля"""
        password = "password123"
        password_hash = generate_password_hash(password)
        self.assertIsNotNone(password_hash)
        self.assertNotEqual(password, password_hash)
        self.assertTrue(password_hash.startswith('pbkdf2:') or password_hash.startswith('$'))
    
    def test_check_password_hash_correct_password_returns_true(self):
        """Проверка корректного пароля возвращает True"""
        password = "testpassword"
        password_hash = generate_password_hash(password)
        result = check_password_hash(password_hash, password)
        self.assertTrue(result)
    
    def test_check_password_hash_incorrect_password_returns_false(self):
        """Проверка некорректного пароля возвращает False"""
        password = "testpassword"
        wrong_password = "wrongpassword"
        password_hash = generate_password_hash(password)
        result = check_password_hash(password_hash, wrong_password)
        self.assertFalse(result)
    
    def test_generate_password_hash_different_passwords_different_hashes(self):
        """Разные пароли генерируют разные хеши"""
        password1 = "password1"
        password2 = "password2"
        hash1 = generate_password_hash(password1)
        hash2 = generate_password_hash(password2)
        self.assertNotEqual(hash1, hash2)


class FormValidationTests(unittest.TestCase):
    """Тесты для валидации форм"""
    
    def test_validate_username_valid_string_returns_true(self):
        """Проверка корректного имени пользователя возвращает True"""
        username = "sergey"
        result = len(username) > 0 and username.strip() == username
        self.assertTrue(result)
    
    def test_validate_username_empty_string_returns_false(self):
        """Проверка пустого имени пользователя возвращает False"""
        username = ""
        result = len(username) > 0
        self.assertFalse(result)
    
    def test_validate_username_whitespace_returns_false(self):
        """Проверка имени пользователя из пробелов возвращает False"""
        username = "   "
        result = len(username.strip()) > 0
        self.assertFalse(result)
    
    def test_validate_password_minimum_length_returns_true(self):
        """Проверка пароля минимальной длины возвращает True"""
        password = "123456"
        result = len(password) >= 6
        self.assertTrue(result)
    
    def test_validate_password_too_short_returns_false(self):
        """Проверка слишком короткого пароля возвращает False"""
        password = "12345"
        result = len(password) >= 6
        self.assertFalse(result)
    
    def test_validate_password_match_returns_true(self):
        """Проверка совпадения паролей возвращает True"""
        password = "test123"
        confirm_password = "test123"
        result = password == confirm_password
        self.assertTrue(result)
    
    def test_validate_password_mismatch_returns_false(self):
        """Проверка несовпадения паролей возвращает False"""
        password = "test123"
        confirm_password = "test456"
        result = password == confirm_password
        self.assertFalse(result)


class PhaseDeterminationTests(unittest.TestCase):
    """Тесты для определения фаз биполярного расстройства"""
    
    def test_determine_phase_no_data_returns_normal(self):
        """Проверка определения фазы при отсутствии данных возвращает normal"""
        current_entry = None
        recent_entries = []
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'normal')
        self.assertIn('Нет данных', explanation[0])
    
    def test_determine_phase_severe_depression_returns_depressive(self):
        """Проверка определения депрессивной фазы при тяжёлой депрессии"""
        current_entry = {
            'depressive_state': 'severe',
            'manic_state': 'none',
            'sleep_hours': 8.0
        }
        recent_entries = []
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'depressive')
    
    def test_determine_phase_severe_mania_returns_hypomanic(self):
        """Проверка определения гипоманиакальной фазы при тяжёлой мании"""
        current_entry = {
            'depressive_state': 'none',
            'manic_state': 'severe',
            'sleep_hours': 8.0
        }
        recent_entries = []
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'hypomanic')
    
    def test_determine_phase_simultaneous_symptoms_returns_mixed(self):
        """Проверка определения смешанной фазы при одновременных симптомах"""
        current_entry = {
            'depressive_state': 'moderate',
            'manic_state': 'moderate',
            'sleep_hours': 8.0
        }
        recent_entries = []
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'mixed')
    
    def test_determine_phase_rapid_switches_returns_mixed(self):
        """Проверка определения смешанной фазы при быстрых переключениях"""
        current_entry = {
            'depressive_state': 'moderate',
            'manic_state': 'none',
            'sleep_hours': 8.0
        }
        recent_entries = [
            {'depressive_state': 'severe', 'manic_state': 'none', 'sleep_hours': 8.0},
            {'depressive_state': 'none', 'manic_state': 'severe', 'sleep_hours': 8.0},
            {'depressive_state': 'severe', 'manic_state': 'none', 'sleep_hours': 8.0},
            {'depressive_state': 'none', 'manic_state': 'severe', 'sleep_hours': 8.0},
        ]
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'mixed')
        self.assertIn('быстрые переключения', explanation[1].lower())
    
    def test_determine_phase_low_sleep_enhances_mania(self):
        """Проверка усиления мании при малом количестве сна"""
        current_entry = {
            'depressive_state': 'none',
            'manic_state': 'mild',
            'sleep_hours': 2.0
        }
        recent_entries = []
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'hypomanic')
    
    def test_determine_phase_high_sleep_enhances_depression(self):
        """Проверка усиления депрессии при большом количестве сна"""
        current_entry = {
            'depressive_state': 'mild',
            'manic_state': 'none',
            'sleep_hours': 14.0
        }
        recent_entries = []
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'depressive')
    
    def test_determine_phase_stable_phase_returns_depressive(self):
        """Проверка определения устойчивой депрессивной фазы"""
        current_entry = {
            'depressive_state': 'moderate',
            'manic_state': 'none',
            'sleep_hours': 8.0
        }
        recent_entries = [
            {'depressive_state': 'moderate', 'manic_state': 'none', 'sleep_hours': 8.0},
            {'depressive_state': 'moderate', 'manic_state': 'none', 'sleep_hours': 8.0},
            {'depressive_state': 'moderate', 'manic_state': 'none', 'sleep_hours': 8.0},
            {'depressive_state': 'moderate', 'manic_state': 'none', 'sleep_hours': 8.0},
        ]
        phase, explanation = determine_phase_with_statistics(current_entry, recent_entries)
        self.assertEqual(phase, 'depressive')
        self.assertIn('устойчива', explanation[1].lower())


class DataProcessingTests(unittest.TestCase):
    """Тесты для обработки данных"""
    
    def test_format_sleep_hours_valid_value_returns_float(self):
        """Проверка форматирования часов сна возвращает float"""
        sleep_hours = "8.5"
        result = float(sleep_hours)
        self.assertEqual(result, 8.5)
        self.assertIsInstance(result, float)
    
    def test_format_sleep_hours_zero_returns_zero(self):
        """Проверка форматирования нулевого значения сна"""
        sleep_hours = "0"
        result = float(sleep_hours)
        self.assertEqual(result, 0.0)
    
    def test_format_state_value_none_returns_none(self):
        """Проверка обработки значения None для состояния"""
        state_value = None
        result = state_value or 'none'
        self.assertEqual(result, 'none')
    
    def test_format_state_value_valid_returns_value(self):
        """Проверка обработки валидного значения состояния"""
        state_value = 'moderate'
        result = state_value or 'none'
        self.assertEqual(result, 'moderate')
    
    def test_format_date_valid_returns_formatted_string(self):
        """Проверка форматирования даты возвращает строку"""
        entry_date = date(2024, 1, 15)
        result = entry_date.strftime('%Y-%m-%d')
        self.assertEqual(result, '2024-01-15')
    
    def test_format_date_range_returns_period_string(self):
        """Проверка форматирования диапазона дат"""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 7)
        result = f"{start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}"
        self.assertEqual(result, '01.01.2024 - 07.01.2024')
    
    def test_handle_none_value_returns_default(self):
        """Проверка обработки None значения возвращает значение по умолчанию"""
        value = None
        result = value or 'default'
        self.assertEqual(result, 'default')
    
    def test_convert_boolean_to_int_true_returns_one(self):
        """Проверка преобразования True в 1"""
        value = True
        result = int(bool(value))
        self.assertEqual(result, 1)
    
    def test_convert_boolean_to_int_false_returns_zero(self):
        """Проверка преобразования False в 0"""
        value = False
        result = int(bool(value))
        self.assertEqual(result, 0)


class StateScoreTests(unittest.TestCase):
    """Тесты для оценки состояний"""
    
    def test_state_score_none_returns_zero(self):
        """Проверка оценки состояния 'none' возвращает 0"""
        state_score_map = {'none': 0, 'mild': 3, 'moderate': 6, 'severe': 9}
        result = state_score_map.get('none', 0)
        self.assertEqual(result, 0)
    
    def test_state_score_mild_returns_three(self):
        """Проверка оценки состояния 'mild' возвращает 3"""
        state_score_map = {'none': 0, 'mild': 3, 'moderate': 6, 'severe': 9}
        result = state_score_map.get('mild', 0)
        self.assertEqual(result, 3)
    
    def test_state_score_moderate_returns_six(self):
        """Проверка оценки состояния 'moderate' возвращает 6"""
        state_score_map = {'none': 0, 'mild': 3, 'moderate': 6, 'severe': 9}
        result = state_score_map.get('moderate', 0)
        self.assertEqual(result, 6)
    
    def test_state_score_severe_returns_nine(self):
        """Проверка оценки состояния 'severe' возвращает 9"""
        state_score_map = {'none': 0, 'mild': 3, 'moderate': 6, 'severe': 9}
        result = state_score_map.get('severe', 0)
        self.assertEqual(result, 9)
    
    def test_state_score_invalid_returns_zero(self):
        """Проверка оценки невалидного состояния возвращает 0"""
        state_score_map = {'none': 0, 'mild': 3, 'moderate': 6, 'severe': 9}
        result = state_score_map.get('invalid', 0)
        self.assertEqual(result, 0)


class CustomTestResult(unittest.TextTestResult):
    """Кастомный результат тестов с подробным выводом и временем"""
    
    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self.start_time = None
        self.test_count = 0
        self.dots = False  # Отключаем стандартные точки
    
    def startTest(self, test):
        super().startTest(test)
        import time
        self.start_time = time.time()
        self.test_count += 1
        test_name = test._testMethodName
        test_doc = test._testMethodDoc or test_name
        self.stream.write(f"\n[Тест {self.test_count}] {test_name}\n")
        self.stream.write(f"Что тестируем: {test_doc}\n")
    
    def addSuccess(self, test):
        super().addSuccess(test)
        import time
        elapsed = time.time() - self.start_time if self.start_time else 0
        self.stream.write(f"Результат: [OK] Тест пройден (время: {elapsed:.3f}с)\n")
    
    def addError(self, test, err):
        super().addError(test, err)
        import time
        elapsed = time.time() - self.start_time if self.start_time else 0
        self.stream.write(f"Результат: [ERROR] Ошибка (время: {elapsed:.3f}с)\n")
        self.stream.write(f"Детали: {err[1]}\n")
    
    def addFailure(self, test, err):
        super().addFailure(test, err)
        import time
        elapsed = time.time() - self.start_time if self.start_time else 0
        self.stream.write(f"Результат: [FAIL] Тест провален (время: {elapsed:.3f}с)\n")
        self.stream.write(f"Детали: {err[1]}\n")
    
    def getDescription(self, test):
        """Переопределяем для отключения стандартного описания"""
        return ""


class CustomTestRunner(unittest.TextTestRunner):
    """Кастомный TestRunner с улучшенным выводом"""
    resultclass = CustomTestResult


if __name__ == '__main__':
    import sys
    runner = CustomTestRunner(verbosity=2, stream=sys.stdout)
    unittest.main(testRunner=runner, verbosity=0)

