"""
Анализатор фаз биполярного расстройства
Вынесен из routes.py для повышения читаемости и тестируемости
"""

from datetime import date


class PhaseAnalyzer:
    """Класс для определения фазы биполярного расстройства на основе статистики"""
    
    STATE_SCORES = {
        'none': 0,
        'mild': 3,
        'moderate': 6,
        'severe': 9
    }
    
    SLEEP_THRESHOLDS = {
        'low': 3,
        'high': 12
    }
    
    EXPLANATION_TEXT = {
        'none': 'Нет',
        'mild': 'Лёгкое',
        'moderate': 'Умеренное',
        'severe': 'Тяжёлое'
    }
    
    def __init__(self, current_entry, recent_entries):
        """
        Инициализация анализатора
        
        Args:
            current_entry: dict с полями depressive_state, manic_state, sleep_hours, entry_date
            recent_entries: list записей за предыдущие дни (без текущей)
        """
        self.current_entry = current_entry
        self.recent_entries = recent_entries
        self.all_entries = self._prepare_entries()
    
    def _prepare_entries(self):
        """Подготовка всех записей для анализа"""
        entries = list(self.recent_entries) if self.recent_entries else []
        
        if self.current_entry:
            entries.append({
                'depressive_state': self.current_entry.get('depressive_state', 'none'),
                'manic_state': self.current_entry.get('manic_state', 'none'),
                'sleep_hours': self.current_entry.get('sleep_hours', 0),
                'entry_date': self.current_entry.get('entry_date')
            })
        
        return entries
    
    def determine_phase(self):
        """
        Определение фазы биполярного расстройства
        
        Returns:
            tuple: (phase, explanation_list)
            где phase - 'normal', 'depressive', 'hypomanic', 'mixed'
            explanation_list - список строк с объяснением
        """
        if not self.all_entries:
            return 'normal', ["Нет данных для анализа"]
        
        # Проверка на быстрые переключения (смешанная фаза)
        rapid_switches = self._count_rapid_switches()
        if rapid_switches >= 2:
            return 'mixed', self._explain_rapid_switches(rapid_switches)
        
        # Проверка на одновременные симптомы (смешанная фаза)
        if self.current_entry and self._is_mixed_current():
            return 'mixed', self._explain_mixed_current()
        
        # Определение по статистике
        return self._determine_by_statistics()
    
    def _state_score(self, value):
        """Получение числового значения состояния"""
        return self.STATE_SCORES.get(value or 'none', 0)
    
    def _check_episode(self, score, sleep_hours):
        """Проверка наличия эпизода (достаточной интенсивности симптомов)"""
        sleep_hours = float(sleep_hours or 0)
        return score >= 6 or (score >= 3 and (sleep_hours <= self.SLEEP_THRESHOLDS['low'] or 
                                               sleep_hours >= self.SLEEP_THRESHOLDS['high']))
    
    def _classify_day(self, entry):
        """Классификация дня по типу эпизода"""
        sleep_hours = float(entry.get('sleep_hours', 0) or 0)
        dep_score = self._state_score(entry.get('depressive_state', 'none'))
        man_score = self._state_score(entry.get('manic_state', 'none'))
        
        dep_episode = self._check_episode(dep_score, sleep_hours)
        man_episode = self._check_episode(man_score, sleep_hours)
        
        if dep_episode and man_episode:
            return 'mixed'
        elif dep_episode:
            return 'depressive'
        elif man_episode:
            return 'hypomanic'
        else:
            return 'normal'
    
    def _count_rapid_switches(self):
        """Подсчет быстрых переключений между депрессией и гипоманией"""
        phases = [self._classify_day(e) for e in self.all_entries]
        
        switches = 0
        for i in range(len(phases) - 1):
            if {phases[i], phases[i+1]} == {'depressive', 'hypomanic'}:
                switches += 1
        
        return switches
    
    def _is_mixed_current(self):
        """Проверка на смешанное состояние в текущей записи"""
        if not self.current_entry:
            return False
        
        sleep_hours = float(self.current_entry.get('sleep_hours', 0) or 0)
        dep_score = self._state_score(self.current_entry.get('depressive_state', 'none'))
        man_score = self._state_score(self.current_entry.get('manic_state', 'none'))
        
        dep_episode = self._check_episode(dep_score, sleep_hours)
        man_episode = self._check_episode(man_score, sleep_hours)
        
        return dep_episode and man_episode
    
    def _explain_rapid_switches(self, switches_count):
        """Объяснение быстрых переключений"""
        explanation = [
            f"Смешанная фаза определена на основе анализа паттернов за последние {len(self.all_entries)} дней",
            f"Обнаружены быстрые переключения между депрессией и гипоманией: {switches_count} переключений за период",
            "Быстрая смена фаз указывает на смешанное состояние"
        ]
        return explanation
    
    def _explain_mixed_current(self):
        """Объяснение смешанного состояния в текущей записи"""
        explanation = ["Смешанная фаза определена на основе текущей записи"]
        
        dep_state = self.current_entry.get('depressive_state', 'none')
        man_state = self.current_entry.get('manic_state', 'none')
        
        dep_text = self.EXPLANATION_TEXT.get(dep_state, dep_state)
        man_text = self.EXPLANATION_TEXT.get(man_state, man_state)
        
        explanation.append(
            f"Одновременно присутствуют симптомы: депрессивное состояние ({dep_text}) "
            f"и маниакальное состояние ({man_text})"
        )
        
        sleep_hours = float(self.current_entry.get('sleep_hours', 0) or 0)
        if sleep_hours >= self.SLEEP_THRESHOLDS['high']:
            explanation.append(f"Дополнительно: очень много сна ({sleep_hours} ч) усилило депрессивные симптомы")
        if sleep_hours <= self.SLEEP_THRESHOLDS['low']:
            explanation.append(f"Дополнительно: очень мало сна ({sleep_hours} ч) усилило маниакальные симптомы")
        
        return explanation
    
    def _determine_by_statistics(self):
        """Определение фазы по статистике (устойчивость >= 50%)"""
        # Подсчет фаз
        phase_scores = {
            'depressive': 0,
            'hypomanic': 0,
            'mixed': 0,
            'normal': 0
        }
        
        for entry in self.all_entries:
            day_phase = self._classify_day(entry)
            phase_scores[day_phase] += 1
        
        total_days = len(self.all_entries)
        threshold = max(1, total_days * 0.5)
        
        # Исключаем 'normal' из статистики, если есть другие фазы
        non_normal_scores = {k: v for k, v in phase_scores.items() if k != 'normal'}
        
        if non_normal_scores:
            max_phase, max_count = max(non_normal_scores.items(), key=lambda x: x[1])
            
            if max_count >= threshold:
                return self._explain_stable_phase(max_phase, max_count, total_days)
        
        # Если нет устойчивой фазы, определяем по текущему состоянию
        if self.current_entry:
            return self._determine_by_current()
        
        return 'normal', [
            "Нормальная фаза определена на основе анализа",
            f"За последние {total_days} дней не было устойчивых симптомов"
        ]
    
    def _explain_stable_phase(self, phase, count, total):
        """Объяснение устойчивой фазы"""
        phase_names = {
            'depressive': 'Депрессивная',
            'hypomanic': 'Гипоманиакальная',
            'mixed': 'Смешанная'
        }
        
        explanation = [
            f"{phase_names[phase]} фаза определена на основе статистики за последние {total} дней",
            f"Фаза устойчива: {count} из {total} дней ({int(count/total*100)}%)"
        ]
        
        if self.current_entry and phase in ['depressive', 'hypomanic']:
            state_key = 'depressive_state' if phase == 'depressive' else 'manic_state'
            state = self.current_entry.get(state_key, 'none')
            state_text = self.EXPLANATION_TEXT.get(state, state)
            explanation.append(f"Текущее состояние: {state_text}")
        
        return phase, explanation
    
    def _determine_by_current(self):
        """Определение фазы по текущей записи (когда нет устойчивости)"""
        if not self.current_entry:
            return 'normal', ["Нет данных для анализа"]
        
        sleep_hours = float(self.current_entry.get('sleep_hours', 0) or 0)
        dep_score = self._state_score(self.current_entry.get('depressive_state', 'none'))
        man_score = self._state_score(self.current_entry.get('manic_state', 'none'))
        
        dep_episode = self._check_episode(dep_score, sleep_hours)
        man_episode = self._check_episode(man_score, sleep_hours)
        
        total_days = len(self.all_entries)
        
        if dep_episode:
            explanation = ["Депрессивная фаза определена на основе текущей записи"]
            if total_days > 1:
                explanation.append(f"За последние {total_days} дней фаза не была устойчивой (менее 50% дней)")
            
            state = self.current_entry.get('depressive_state', 'none')
            state_text = self.EXPLANATION_TEXT.get(state, state)
            explanation.append(f"Текущее депрессивное состояние: {state_text}")
            
            return 'depressive', explanation
        
        elif man_episode:
            explanation = ["Гипоманиакальная фаза определена на основе текущей записи"]
            if total_days > 1:
                explanation.append(f"За последние {total_days} дней фаза не была устойчивой (менее 50% дней)")
            
            state = self.current_entry.get('manic_state', 'none')
            state_text = self.EXPLANATION_TEXT.get(state, state)
            explanation.append(f"Текущее маниакальное состояние: {state_text}")
            
            return 'hypomanic', explanation
        
        explanation = ["Нормальная фаза определена на основе анализа"]
        if total_days > 1:
            explanation.append(f"За последние {total_days} дней не было устойчивых симптомов")
        
        return 'normal', explanation

