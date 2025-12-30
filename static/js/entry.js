/**
 * JavaScript для страницы ввода/редактирования дневной записи
 */

let medications = [];
let customStates = [];
let selectedDate = window.today || new Date().toISOString().split('T')[0];
let isLoadingData = false; // Флаг для предотвращения автосохранения при загрузке данных

const STATE_SCORE = {
    none: 0,
    mild: 3,
    moderate: 6,
    severe: 9
};

const TIME_OF_DAY_LABELS = {
    morning: 'Утро',
    afternoon: 'День',
    evening: 'Вечер',
    night: 'Ночь'
};

const FREQUENCY_LABELS = {
    daily: 'Ежедневно',
    as_needed: 'По необходимости'
};

// Утилиты для корректной работы с локальными датами (без сдвигов по часовым поясам)
function parseLocalDateString(dateStr) {
    try {
        const parts = (dateStr || '').split('-').map(Number);
        if (parts.length !== 3) return new Date(NaN);
        const [y, m, d] = parts;
        return new Date(y, m - 1, d);
    } catch (e) {
        return new Date(NaN);
    }
}

function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeEntryPage();
});

function initializeEntryPage() {
    // Инициализируем справочники
    medications = Array.isArray(window.medications) ? window.medications : [];
    customStates = Array.isArray(window.customStates) ? window.customStates : [];
    
    // Нормализуем лекарства: удаляем дубликаты по ID
    const medSeenIds = new Set();
    medications = medications
        .map(med => {
            // Нормализуем ID к числу для консистентности
            const normalizedId = typeof med.id === 'number' ? med.id : parseInt(med.id);
            return {...med, id: normalizedId};
        })
        .filter(med => {
            // Удаляем дубликаты по ID
            if (medSeenIds.has(med.id)) {
                return false;
            }
            medSeenIds.add(med.id);
            return true;
        })
        .sort((a, b) => a.id - b.id); // Сортируем по ID
    
    // Нормализуем состояния: обрабатываем опции и удаляем дубликаты по ID
    const seenIds = new Set();
    customStates = customStates
        .map(state => {
            // Нормализуем ID к числу для консистентности
            const normalizedId = typeof state.id === 'number' ? state.id : parseInt(state.id);
            
            // Обрабатываем опции для multi_checkbox
            if (state.mark_type === 'multi_checkbox') {
                return {
                    ...state,
                    id: normalizedId,
                    options: (state.options || '').split('||').map(o => o.trim()).filter(Boolean)
                };
            }
            return {...state, id: normalizedId};
        })
        .filter(state => {
            // Удаляем дубликаты по ID
            if (seenIds.has(state.id)) {
                return false;
            }
            seenIds.add(state.id);
            return true;
        })
        .sort((a, b) => a.id - b.id); // Сортируем по ID
    
    // Инициализируем дату и навигацию
    initializeDateNavigation();
    
    // Инициализируем состояния
    initializeStateButtons();
    initializeBinaryButtons();
    initializeSleepSlider();
    initializeNewStateModal();
    
    // Обновляем отображение
    updateMedicationsList();
    updateCustomStatesList();
    
    // Инициализируем улучшенные заметки
    initializeEnhancedNotes();
    
    // Инициализируем автосохранение
    initializeAutoSave();
    
    // Подключаем обработчик кнопки "Определить тип дня"
    const determineDayTypeBtn = document.getElementById('determine-day-type-btn');
    if (determineDayTypeBtn) {
        determineDayTypeBtn.addEventListener('click', determineDayType);
    }
    
    // Загружаем запись за выбранную дату
    loadEntryForDate(selectedDate);
}

/**
 * Инициализация навигации по датам
 */
function initializeDateNavigation() {
    const dateInput = document.getElementById('entry-date-input');
    const dateDisplay = document.getElementById('date-display');
    const datePrevBtn = document.getElementById('date-prev-btn');
    const dateNextBtn = document.getElementById('date-next-btn');
    const dateCalendarBtn = document.getElementById('date-calendar-btn');
    
    if (dateInput) {
        dateInput.value = selectedDate;
        updateDateDisplay();
        
        // При изменении через календарь
        dateInput.addEventListener('change', () => {
            selectedDate = dateInput.value;
            updateDateDisplay();
            updateDateNavigationButtons();
            loadEntryForDate(selectedDate);
        });
    }
    
    // Кнопка календаря
    if (dateCalendarBtn) {
        dateCalendarBtn.addEventListener('click', () => {
            if (dateInput) {
                dateInput.showPicker ? dateInput.showPicker() : dateInput.click();
            }
        });
    }
    
    // Навигация стрелками
    if (datePrevBtn) {
        datePrevBtn.addEventListener('click', () => {
            const date = parseLocalDateString(selectedDate);
            date.setDate(date.getDate() - 1);
            selectedDate = formatLocalDate(date);
            if (dateInput) dateInput.value = selectedDate;
            updateDateDisplay();
            updateDateNavigationButtons();
            loadEntryForDate(selectedDate);
        });
    }
    
    if (dateNextBtn) {
        dateNextBtn.addEventListener('click', () => {
            const date = parseLocalDateString(selectedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (date < today) {
                date.setDate(date.getDate() + 1);
                selectedDate = formatLocalDate(date);
                if (dateInput) dateInput.value = selectedDate;
                updateDateDisplay();
                updateDateNavigationButtons();
                loadEntryForDate(selectedDate);
            }
        });
    }
    
    updateDateNavigationButtons();
}

/**
 * Обновление отображения даты в человекочитаемом формате
 */
function updateDateDisplay() {
    const dateDisplay = document.getElementById('date-display');
    if (!dateDisplay) return;
    
    const date = parseLocalDateString(selectedDate);
    date.setHours(0, 0, 0, 0);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dateStr = `${date.getDate()} ${months[date.getMonth()]}`;
    if (date.getFullYear() !== today.getFullYear()) dateStr += ` ${date.getFullYear()}`;
    
    dateDisplay.textContent = dateStr;
    
    // Подсветка для сегодняшнего дня
    const isToday = date.getTime() === today.getTime();
    
    // Удаляем предыдущие классы подсветки
    dateDisplay.classList.remove(
        'bg-indigo-100', 'dark:bg-indigo-900',
        'text-indigo-700', 'dark:text-indigo-200',
        'px-3', 'py-1', 'rounded-md', 'font-semibold'
    );
    
    // Добавляем подсветку, если это сегодня
    if (isToday) {
        dateDisplay.classList.add(
            'bg-indigo-100', 'dark:bg-indigo-900',
            'text-indigo-700', 'dark:text-indigo-200',
            'px-3', 'py-1', 'rounded-md', 'font-semibold'
        );
    }
}

/**
 * Обновление состояния кнопок навигации по датам
 */
function updateDateNavigationButtons() {
    const dateNextBtn = document.getElementById('date-next-btn');
    if (!dateNextBtn) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sel = parseLocalDateString(selectedDate);
    sel.setHours(0, 0, 0, 0);
    const isToday = sel >= today;
    
    dateNextBtn.disabled = isToday;
    dateNextBtn.classList.toggle('opacity-30', isToday);
    dateNextBtn.classList.toggle('cursor-not-allowed', isToday);
}

/**
 * Инициализация кнопок состояний
 */
function initializeStateButtons() {
    document.querySelectorAll('[data-state-group]').forEach(group => {
        const stateGroup = group.getAttribute('data-state-group');
        const buttons = group.querySelectorAll('.state-btn');
        const hiddenInput = document.querySelector(`input[name="${stateGroup}"]`);
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.getAttribute('data-value');

                const isAlreadyActive = btn.classList.contains('active');

                // Если уже выбрана — снимаем выбор (toggle off)
                if (isAlreadyActive) {
                    buttons.forEach(b => b.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700'));
                    if (hiddenInput) hiddenInput.value = '';
                } else {
                    // Иначе выбираем как обычно
                    buttons.forEach(b => b.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700'));
                    btn.classList.add('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
                    if (hiddenInput) hiddenInput.value = value;
                }

                // После изменения состояний пересчитываем тип дня
                updateDayTypeDisplay();
            });
        });
    });
}

/**
 * Инициализация бинарных кнопок (да/нет)
 */
function initializeBinaryButtons() {
    document.querySelectorAll('[data-binary]').forEach(btn => {
        btn.addEventListener('click', () => {
            const binaryField = btn.getAttribute('data-binary');
            const value = btn.getAttribute('data-value');
            const group = document.querySelectorAll(`[data-binary="${binaryField}"]`);
            const hiddenInput = document.querySelector(`input[name="${binaryField}"]`);
            
            const isAlreadyActive = btn.classList.contains('active');

            // Если уже выбрана — снимаем выбор
            if (isAlreadyActive) {
                group.forEach(b => b.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700'));
                if (hiddenInput) hiddenInput.value = '';
            } else {
                // Иначе выбираем как обычно
                group.forEach(b => b.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700'));
                btn.classList.add('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
                if (hiddenInput) hiddenInput.value = value;
            }
        });
    });
}

/**
 * Инициализация ползунка сна
 */
function initializeSleepSlider() {
    const sleepSlider = document.getElementById('sleep_hours');
    const sleepDisplay = document.getElementById('sleep_hours_display');
    const decreaseBtn = document.getElementById('sleep-hours-decrease');
    const increaseBtn = document.getElementById('sleep-hours-increase');
    
    if (sleepSlider && sleepDisplay) {
        // Функция для обновления отображения значения
        const updateDisplay = () => {
            const value = parseFloat(sleepSlider.value);
            sleepDisplay.textContent = value === 1 ? '1 час' : value < 5 ? `${value} часа` : `${value} часов`;
        };
        
        // Обновление отображения при изменении ползунка
        sleepSlider.addEventListener('input', updateDisplay);
        
        // Кнопка уменьшения
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => {
                const currentValue = parseFloat(sleepSlider.value);
                const step = parseFloat(sleepSlider.step) || 0.5;
                const newValue = Math.max(parseFloat(sleepSlider.min), currentValue - step);
                sleepSlider.value = newValue;
                updateDisplay();
                // Триггерим событие input для других обработчиков
                sleepSlider.dispatchEvent(new Event('input'));
            });
        }
        
        // Кнопка увеличения
        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => {
                const currentValue = parseFloat(sleepSlider.value);
                const step = parseFloat(sleepSlider.step) || 0.5;
                const newValue = Math.min(parseFloat(sleepSlider.max), currentValue + step);
                sleepSlider.value = newValue;
                updateDisplay();
                // Триггерим событие input для других обработчиков
                sleepSlider.dispatchEvent(new Event('input'));
            });
        }
        
        // Инициализация начального значения
        updateDisplay();
    }
}

/**
 * Установка значения состояния
 */
function setStateGroup(stateGroup, value) {
    const group = document.querySelector(`[data-state-group="${stateGroup}"]`);
    if (!group) return;
    
    const buttons = group.querySelectorAll('.state-btn');
    const hiddenInput = document.querySelector(`input[name="${stateGroup}"]`);
    
    buttons.forEach(btn => {
        const btnValue = btn.getAttribute('data-value');
        if (btnValue === value) {
            btn.classList.add('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
        } else {
            btn.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
        }
    });
    
    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

function clearStateGroup(stateGroup) {
    const group = document.querySelector(`[data-state-group="${stateGroup}"]`);
    if (!group) return;

    const buttons = group.querySelectorAll('.state-btn');
    const hiddenInput = document.querySelector(`input[name="${stateGroup}"]`);

    buttons.forEach(btn => {
        btn.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
    });

    if (hiddenInput) {
        hiddenInput.value = '';
    }

    // При полном сбросе состояний пересчитаем тип дня
    updateDayTypeDisplay();
}

/**
 * Установка бинарного значения
 */
function setBinaryValue(field, value) {
    const buttons = document.querySelectorAll(`[data-binary="${field}"]`);
    const hiddenInput = document.querySelector(`input[name="${field}"]`);
    
    buttons.forEach(btn => {
        const btnValue = btn.getAttribute('data-value');
        if (btnValue === value) {
            btn.classList.add('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
        } else {
            btn.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
        }
    });
    
    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

function clearBinaryValue(field) {
    const buttons = document.querySelectorAll(`[data-binary="${field}"]`);
    const hiddenInput = document.querySelector(`input[name="${field}"]`);

    buttons.forEach(btn => {
        btn.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
    });

    if (hiddenInput) {
        hiddenInput.value = '';
    }
}

// Логика типа дня теперь считается на сервере и отображается по данным записи
let currentDayTypeExplanation = null;

// Поддержка старых вызовов: ранее тип дня считался на клиенте.
// Сейчас расчёт выполняется на сервере, поэтому оставляем заглушку,
// чтобы не падать с ошибкой ReferenceError.
function updateDayTypeDisplay() {
    return;
}

function updateDayTypeUI(dt, explanation = null) {
    const dayTypeSection = document.getElementById('day-type-section');
    const display = document.getElementById('day-type-display');
    if (!dayTypeSection || !display) return;

    const colorClasses = [
        'bg-red-50','text-red-800','border-red-200',
        'dark:bg-red-900','dark:text-red-200','dark:border-red-700',
        'bg-yellow-50','text-yellow-800','border-yellow-200',
        'dark:bg-yellow-900','dark:text-yellow-200','dark:border-yellow-700',
        'bg-purple-50','text-purple-800','border-purple-200',
        'dark:bg-purple-900','dark:text-purple-200','dark:border-purple-700',
        'bg-green-50','text-green-800','border-green-200',
        'dark:bg-green-900','dark:text-green-200','dark:border-green-700',
        'bg-gray-50','text-gray-700','border-gray-200',
        'dark:bg-gray-700','dark:text-gray-200','dark:border-gray-600'
    ];
    display.classList.remove(...colorClasses);
    display.innerHTML = '';

    if (!dt) {
        dayTypeSection.classList.add('hidden');
        currentDayTypeExplanation = null;
        return;
    }

    dayTypeSection.classList.remove('hidden');
    currentDayTypeExplanation = explanation;

    let text = '';
    let icon = '';

    if (dt === 'depressive') {
        text = 'Тип дня: депрессивный эпизод.';
        // Используем изображение для депрессивной фазы, с fallback на эмодзи
        icon = '<img src="/static/images/depressive-phase.png" alt="Депрессивная фаза" class="w-8 h-8 object-contain" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline\';"><span style="display:none; font-size: 1.5rem;">😔</span>';
        display.classList.add('bg-red-50','dark:bg-red-900','text-red-800','dark:text-red-200','border-red-200','dark:border-red-700');
    } else if (dt === 'hypomanic') {
        text = 'Тип дня: гипоманиакальный эпизод.';
        // Используем изображение для гипомании, с fallback на эмодзи
        icon = '<img src="/static/images/hypomanic-phase.png" alt="Гипоманиакальный эпизод" class="w-16 h-16 object-contain" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline\';"><span style="display:none; font-size: 1.5rem;">😳</span>';
        display.classList.add('bg-yellow-50','dark:bg-yellow-900','text-yellow-800','dark:text-yellow-200','border-yellow-200','dark:border-yellow-700');
    } else if (dt === 'mixed') {
        text = 'Тип дня: смешанный эпизод (есть и депрессивные, и гипоманиакальные симптомы).';
        // Используем изображение для смешанного эпизода, с fallback на эмодзи
        icon = '<img src="/static/images/mixed-phase.png" alt="Смешанный эпизод" class="w-8 h-8 object-contain" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline\';"><span style="display:none; font-size: 1.5rem;">♻️</span>';
        display.classList.add('bg-purple-50','dark:bg-purple-900','text-purple-800','dark:text-purple-200','border-purple-200','dark:border-purple-700');
    } else {
        // normal или что-то по умолчанию
        text = 'Тип дня: нормальный день (без выраженного эпизода).';
        icon = '🙂';
        display.classList.add('bg-green-50','dark:bg-green-900','text-green-800','dark:text-green-200','border-green-200','dark:border-green-700');
    }

    if (dt === 'depressive' || dt === 'mixed') {
        display.innerHTML = `
            <span class="flex items-center justify-center w-8 h-8">${icon}</span>
            <span class="leading-snug">${text}</span>
        `;
    } else if (dt === 'hypomanic') {
        display.innerHTML = `
            <span class="flex items-center justify-center w-16 h-16">${icon}</span>
            <span class="leading-snug text-center">${text}</span>
        `;
        display.classList.add('flex', 'flex-col', 'items-center', 'text-center');
    } else {
        display.innerHTML = `
            <span class="text-lg leading-none">${icon}</span>
            <span class="leading-snug">${text}</span>
        `;
    }
    
    // Показываем/скрываем кнопку информации в зависимости от наличия объяснения
    const infoBtn = document.getElementById('day-type-info-btn');
    if (infoBtn) {
        if (explanation && explanation.length > 0) {
            infoBtn.classList.remove('hidden');
        } else {
            infoBtn.classList.add('hidden');
        }
    }
    
    // Показываем кнопку "Изменить" только если тип дня определен
    const editBtn = document.getElementById('day-type-edit-btn');
    if (editBtn) {
        editBtn.style.display = dt ? 'block' : 'none';
    }
}

function showDayTypeExplanation() {
    if (!currentDayTypeExplanation || currentDayTypeExplanation.length === 0) {
        StabilUtils.showMessage('Объяснение фазы недоступно', 'info');
        return;
    }
    
    // Создаем модальное окно для объяснения
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'day-type-explanation-modal';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-800">Почему определена эта фаза?</h3>
                    <button onclick="closeDayTypeExplanation()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="space-y-2">
                    ${currentDayTypeExplanation.map(exp => `
                        <div class="flex items-start gap-2 text-sm text-gray-700">
                            <span class="text-indigo-600 mt-0.5">•</span>
                            <span>${exp}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-6 flex justify-end">
                    <button onclick="closeDayTypeExplanation()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition">
                        Понятно
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Закрытие при клике вне модального окна
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeDayTypeExplanation();
        }
    });
}

function closeDayTypeExplanation() {
    const modal = document.getElementById('day-type-explanation-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Переключение редактора типа дня
 */
function toggleDayTypeEditor() {
    const editor = document.getElementById('day-type-editor');
    const display = document.getElementById('day-type-display');
    const editBtn = document.getElementById('day-type-edit-btn');
    
    if (!editor || !display) return;
    
    if (editor.classList.contains('hidden')) {
        // Показываем редактор
        editor.classList.remove('hidden');
        display.classList.add('opacity-50');
        editBtn.textContent = 'Отменить';
        
        // Устанавливаем текущее значение в селект
        const select = document.getElementById('day-type-select');
        if (select) {
            // Получаем текущий тип дня из отображения
            const currentType = getCurrentDayType();
            if (currentType) {
                select.value = currentType;
            }
        }
    } else {
        // Скрываем редактор
        cancelDayTypeEdit();
    }
}

/**
 * Получение текущего типа дня
 */
function getCurrentDayType() {
    const display = document.getElementById('day-type-display');
    if (!display) return null;
    
    // Проверяем классы для определения типа
    if (display.classList.contains('bg-red-50') || display.classList.contains('dark:bg-red-900')) {
        return 'depressive';
    } else if (display.classList.contains('bg-yellow-50') || display.classList.contains('dark:bg-yellow-900')) {
        return 'hypomanic';
    } else if (display.classList.contains('bg-purple-50') || display.classList.contains('dark:bg-purple-900')) {
        return 'mixed';
    } else {
        return 'normal';
    }
}

/**
 * Сохранение пользовательского типа дня
 */
async function saveDayType() {
    const select = document.getElementById('day-type-select');
    if (!select) return;
    
    const selectedType = select.value;
    if (!selectedType) return;
    
    // Сохраняем значение в скрытое поле для использования при автосохранении
    const form = document.getElementById('entryForm');
    if (form) {
        let manualDayTypeInput = form.querySelector('input[name="manual_day_type"]');
        if (!manualDayTypeInput) {
            manualDayTypeInput = document.createElement('input');
            manualDayTypeInput.type = 'hidden';
            manualDayTypeInput.name = 'manual_day_type';
            form.appendChild(manualDayTypeInput);
        }
        manualDayTypeInput.value = selectedType;
    }
    
    // Сохраняем через API
    try {
        const response = await fetch('/update_day_type', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                date: selectedDate,
                day_type: selectedType
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Обновляем отображение
            updateDayTypeUI(selectedType, null);
            cancelDayTypeEdit();
            StabilUtils.showMessage('Тип дня изменен', 'success');
            
            // Триггерим автосохранение для обновления данных
            if (typeof scheduleAutoSave === 'function') {
                scheduleAutoSave();
            }
        } else {
            StabilUtils.showMessage(result.message || 'Ошибка при изменении типа дня', 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения типа дня:', error);
        StabilUtils.showMessage('Ошибка при изменении типа дня', 'error');
    }
}

/**
 * Отмена редактирования типа дня
 */
function cancelDayTypeEdit() {
    const editor = document.getElementById('day-type-editor');
    const display = document.getElementById('day-type-display');
    const editBtn = document.getElementById('day-type-edit-btn');
    
    if (editor) {
        editor.classList.add('hidden');
    }
    if (display) {
        display.classList.remove('opacity-50');
    }
    if (editBtn) {
        editBtn.textContent = 'Изменить';
    }
    
    // Удаляем скрытое поле, если оно было создано
    const form = document.getElementById('entryForm');
    if (form) {
        const manualDayTypeInput = form.querySelector('input[name="manual_day_type"]');
        if (manualDayTypeInput) {
            manualDayTypeInput.remove();
        }
    }
}

/**
 * Загрузка записи за конкретную дату
 */
async function loadEntryForDate(dateStr) {
    // Устанавливаем флаг загрузки, чтобы предотвратить автосохранение
    isLoadingData = true;
    
    // При смене даты сразу очищаем визуальное состояние,
    // чтобы не оставались подсветки и тип дня от предыдущей даты.
    try {
        // Снимаем выделение со всех кнопок состояний
        document.querySelectorAll('.state-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
        });

        // Снимаем выделение со всех бинарных кнопок
        document.querySelectorAll('[data-binary]').forEach(btn => {
            btn.classList.remove('active', 'bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
        });

        // Прячем блок "Тип дня" и очищаем текст
        const initialDayTypeSection = document.getElementById('day-type-section');
        const initialDayTypeDisplay = document.getElementById('day-type-display');
        if (initialDayTypeSection) initialDayTypeSection.classList.add('hidden');
        if (initialDayTypeDisplay) initialDayTypeDisplay.textContent = '';
        
        // Очищаем заметки сразу при смене даты
        const notesField = document.getElementById('notes');
        const notesCounter = document.getElementById('notes-counter');
        if (notesField) {
            notesField.value = '';
            // Авторасширение после очистки
            if (typeof window.autoResizeTextarea === 'function') {
                window.autoResizeTextarea(notesField);
            }
            // Обновляем счетчик
            if (notesCounter) {
                notesCounter.textContent = '0 символов';
                notesCounter.classList.remove('text-indigo-600', 'dark:text-indigo-400');
            }
        }
    } catch (e) {
        console.error('Ошибка предварительной очистки при смене даты:', e);
    }

    try {
        const response = await fetch(`/get_entry/${dateStr}`, { credentials: 'include' });
        if (!response.ok) return;

        const data = await response.json();
        
        const entry = data.exists ? data.entry : null;
        
        // Если записи нет — мягко сбрасываем до "пустого" состояния
        const resetToEmptyState = () => {
            // Сбрасываем состояния к «не выбрано»
            clearStateGroup('depressive_state');
            clearStateGroup('manic_state');
            clearStateGroup('irritable_state');
            clearStateGroup('anxious_state');
            clearBinaryValue('psychotic_symptoms');
            clearBinaryValue('psychotherapy');

            // Сон
            document.getElementById('sleep_hours').value = 8;
            document.getElementById('sleep_quality').value = 'average';

            // Заметки и вторичные блоки
            const notesField = document.getElementById('notes');
            const notesCounter = document.getElementById('notes-counter');
            if (notesField) {
                notesField.value = '';
                // Обновляем счетчик
                if (notesCounter) {
                    notesCounter.textContent = '0 символов';
                    notesCounter.classList.remove('text-indigo-600', 'dark:text-indigo-400');
                }
            }
            
            // Очищаем скрытое поле типа дня
            const form = document.getElementById('entryForm');
            if (form) {
                const manualDayTypeInput = form.querySelector('input[name="manual_day_type"]');
                if (manualDayTypeInput) {
                    manualDayTypeInput.remove();
                }
            }
            
            resetMedicationsSelection();
            resetCustomStatesSelection();
            
            // Обновляем отображение ползунка сна
            const sleepSlider = document.getElementById('sleep_hours');
            const sleepDisplay = document.getElementById('sleep_hours_display');
            if (sleepSlider && sleepDisplay) {
                const value = parseFloat(sleepSlider.value);
                sleepDisplay.textContent = value === 1 ? '1 час' : value < 5 ? `${value} часа` : `${value} часов`;
            }

            // Тип дня пока не определён для новой незаполненной записи — скрываем блок
            updateDayTypeUI(null);
            
            // Загружаем черновик заметок, если есть
            if (typeof loadNotesDraft === 'function') {
                loadNotesDraft();
            }
        };

        if (!entry) {
            resetToEmptyState();
            // Дополнительно очищаем все поля формы, включая ползунки и числовые значения
            const moodSlider = document.getElementById('mood');
            const irritabilitySlider = document.getElementById('irritability');
            const anxietySlider = document.getElementById('anxiety');
            const energySlider = document.getElementById('energy');
            
            if (moodSlider) {
                moodSlider.value = 5;
                const moodDisplay = document.getElementById('mood_display');
                if (moodDisplay) moodDisplay.textContent = '5';
            }
            if (irritabilitySlider) {
                irritabilitySlider.value = 0;
                const irritabilityDisplay = document.getElementById('irritability_display');
                if (irritabilityDisplay) irritabilityDisplay.textContent = '0';
            }
            if (anxietySlider) {
                anxietySlider.value = 0;
                const anxietyDisplay = document.getElementById('anxiety_display');
                if (anxietyDisplay) anxietyDisplay.textContent = '0';
            }
            if (energySlider) {
                energySlider.value = 5;
                const energyDisplay = document.getElementById('energy_display');
                if (energyDisplay) energyDisplay.textContent = '5';
            }
            
            return;
        }

        // Если запись существует, но по сути "пустая" (все состояния "none", нет симптомов, заметок и доп.данных),
        // тоже считаем её как не заполнявшуюся и показываем пустое состояние без выбранных кнопок.
        const noPrimaryStates =
            (entry.depressive_state || 'none') === 'none' &&
            (entry.manic_state || 'none') === 'none' &&
            (entry.irritable_state || 'none') === 'none' &&
            (entry.anxious_state || 'none') === 'none';
        const noBinaryStates =
            !entry.psychotic_symptoms && !entry.psychotherapy;
        const noNotes = !entry.notes;
        // Отсутствие "содержательных" данных по лекарствам:
        // считаем, что данных нет, если либо вовсе нет словаря medications,
        // либо в нём нет ни одного true (все отметки "не принимал"/false).
        const noMedications =
            !data.medications ||
            Object.keys(data.medications).length === 0 ||
            Object.values(data.medications).every(v => !v);

        // Для пользовательских состояний значения появляются только если
        // пользователь что‑то реально зафиксировал, поэтому достаточно
        // проверить отсутствие ключей.
        const noCustomStateValues =
            !data.custom_state_values ||
            Object.keys(data.custom_state_values).length === 0;

        const isEffectivelyEmpty = noPrimaryStates && noBinaryStates && noNotes && noMedications && noCustomStateValues;
        if (isEffectivelyEmpty) {
            resetToEmptyState();
            return;
        }

        // Категориальные состояния
        setStateGroup('depressive_state', entry.depressive_state || 'none');
        setStateGroup('manic_state', entry.manic_state || 'none');
        setStateGroup('irritable_state', entry.irritable_state || 'none');
        setStateGroup('anxious_state', entry.anxious_state || 'none');
        setBinaryValue('psychotic_symptoms', entry.psychotic_symptoms ? 'yes' : 'no');
        setBinaryValue('psychotherapy', entry.psychotherapy ? 'yes' : 'no');

        // Сон
        document.getElementById('sleep_hours').value = entry.sleep_hours;
        document.getElementById('sleep_quality').value = entry.sleep_quality;
        
        // Обновляем отображение ползунка сна
        const sleepSlider = document.getElementById('sleep_hours');
        const sleepDisplay = document.getElementById('sleep_hours_display');
        if (sleepSlider && sleepDisplay) {
            const value = parseFloat(sleepSlider.value);
            sleepDisplay.textContent = value === 1 ? '1 час' : value < 5 ? `${value} часа` : `${value} часов`;
        }

        // Заметки - обнуляем, если нет данных или пустая строка
        const notesField = document.getElementById('notes');
        const notesCounter = document.getElementById('notes-counter');
        if (notesField) {
            // Проверяем, есть ли реальные заметки (не null, не undefined, не пустая строка)
            const notesValue = entry.notes;
            if (notesValue && typeof notesValue === 'string' && notesValue.trim().length > 0) {
                notesField.value = notesValue;
            } else {
                notesField.value = '';
                // Если заметок нет, пытаемся загрузить черновик
                if (typeof loadNotesDraft === 'function') {
                    loadNotesDraft();
                }
            }
            // Авторасширение после загрузки данных
            if (typeof window.autoResizeTextarea === 'function') {
                window.autoResizeTextarea(notesField);
            }
            // Обновляем счетчик
            if (notesCounter) {
                const text = notesField.value;
                const charCount = text.length;
                const wordCount = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
                notesCounter.textContent = `${charCount} символов, ${wordCount} слов`;
                notesCounter.classList.toggle('text-indigo-600', charCount > 0);
                notesCounter.classList.toggle('dark:text-indigo-400', charCount > 0);
            }
        }

        // Обновляем блок типа дня по данным записи (если сервер уже рассчитал)
        updateDayTypeUI(entry.day_type);
        
        // Если тип дня был установлен, сохраняем его в скрытое поле для автосохранения
        if (entry.day_type) {
            const form = document.getElementById('entryForm');
            if (form) {
                let manualDayTypeInput = form.querySelector('input[name="manual_day_type"]');
                if (!manualDayTypeInput) {
                    manualDayTypeInput = document.createElement('input');
                    manualDayTypeInput.type = 'hidden';
                    manualDayTypeInput.name = 'manual_day_type';
                    form.appendChild(manualDayTypeInput);
                }
                manualDayTypeInput.value = entry.day_type;
            }
        }

        // Лекарства
        resetMedicationsSelection();
        if (data.medications) {
            Object.entries(data.medications).forEach(([medId, taken]) => {
                // Нормализуем ID для поиска чекбокса
                const normalizedId = typeof medId === 'number' ? medId : parseInt(medId);
                const checkbox = document.querySelector(`input[name="medication_check_${normalizedId}"]`);
                if (checkbox) checkbox.checked = !!taken;
            });
        }


        // Пользовательские состояния
        resetCustomStatesSelection();
        if (data.custom_state_values) {
            Object.entries(data.custom_state_values).forEach(([stateId, value]) => {
                setCustomStateValue(stateId, value);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки записи:', error);
    } finally {
        // Снимаем флаг загрузки после завершения
        setTimeout(() => {
            isLoadingData = false;
        }, 500);
    }
}

function resetMedicationsSelection() {
    medications.forEach(med => {
        const checkbox = document.querySelector(`input[name="medication_check_${med.id}"]`);
        if (checkbox) checkbox.checked = false;
    });
}


function resetCustomStatesSelection() {
    customStates.forEach(state => {
        const container = document.getElementById(`custom_state_${state.id}`);
        if (!container) return;
        
        switch (state.mark_type) {
            case 'binary':
                // Убираем активное состояние, но не устанавливаем значение по умолчанию
                const binaryGroup = document.querySelectorAll(`[data-custom-binary="${state.id}"]`);
                const binaryHiddenInput = document.getElementById(`custom_state_binary_input_${state.id}`);
                binaryGroup.forEach(btn => {
                    btn.classList.remove('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
                });
                if (binaryHiddenInput) binaryHiddenInput.value = '';
                break;
            case 'categorical':
                // Убираем активное состояние, но не устанавливаем значение по умолчанию
                const catGroup = document.querySelector(`[data-custom-cat="${state.id}"]`);
                const catHiddenInput = document.getElementById(`custom_state_cat_input_${state.id}`);
                if (catGroup) {
                    catGroup.querySelectorAll('.custom-cat-btn').forEach(btn => {
                        btn.classList.remove('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
                    });
                }
                if (catHiddenInput) catHiddenInput.value = '';
                break;
            case 'numeric':
                const numInput = document.getElementById(`custom_state_num_${state.id}`);
                if (numInput) {
                    numInput.value = '5';
                    const valueDisplay = document.getElementById(`custom_state_num_value_${state.id}`);
                    if (valueDisplay) valueDisplay.textContent = '5';
                }
                break;
            case 'multi_checkbox':
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                break;
        }
    });
}

/**
 * Обновление списка лекарств
 */
function updateMedicationsList() {
    const container = document.getElementById('medications-list');
    if (!container) return;

    // Костыль: полностью очищаем контейнер перед обновлением
    // Это гарантированно удалит все старые элементы, включая дубликаты
    container.innerHTML = '';

    if (medications.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">Нет добавленных лекарств</p>';
        return;
    }

    // Удаляем дубликаты из массива перед отображением (на всякий случай)
    const seenIds = new Set();
    const uniqueMedications = medications.filter(med => {
        const medId = typeof med.id === 'number' ? med.id : parseInt(med.id);
        if (seenIds.has(medId)) {
            return false; // Дубликат - пропускаем
        }
        seenIds.add(medId);
        return true;
    });

    container.innerHTML = uniqueMedications.map(med => {
        const dosageText = med.dosage_mg ? `${med.dosage_mg} мг` : '';
        const timeText = med.time_of_day ? TIME_OF_DAY_LABELS[med.time_of_day] : '';
        const frequencyText = med.frequency ? FREQUENCY_LABELS[med.frequency] : '';
        
        const infoParts = [dosageText, timeText, frequencyText].filter(Boolean);
        const infoText = infoParts.length > 0 ? ` (${infoParts.join(', ')})` : '';
        
        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md mb-2 transition-colors">
                <div class="flex items-center space-x-3 flex-1">
                    <input type="checkbox" id="medication_check_${med.id}" name="medication_check_${med.id}" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded">
                    <label for="medication_check_${med.id}" class="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">
                        ${med.name}${infoText}
                    </label>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <button type="button" onclick="editMedication(${med.id})" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm flex items-center gap-1.5" title="Редактировать">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        <span>Изменить</span>
                    </button>
                    <button type="button" onclick="deleteMedication(${med.id})" class="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm flex items-center gap-1.5" title="Удалить">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-4 0a1 1 0 00-1 1v1h6V4a1 1 0 00-1-1m-4 0h4"></path>
                        </svg>
                        <span>Удалить</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}


/**
 * Обновление списка пользовательских состояний
 */
function updateCustomStatesList() {
    const container = document.getElementById('custom-states-list');
    if (!container) return;

    // Костыль: полностью очищаем контейнер перед обновлением
    // Это гарантированно удалит все старые элементы, включая дубликаты
    container.innerHTML = '';

    if (customStates.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">Нет добавленных состояний</p>';
        return;
    }

    // Удаляем дубликаты из массива перед отображением (на всякий случай)
    const seenIds = new Set();
    const uniqueStates = customStates.filter(state => {
        const stateId = typeof state.id === 'number' ? state.id : parseInt(state.id);
        if (seenIds.has(stateId)) {
            return false; // Дубликат - пропускаем
        }
        seenIds.add(stateId);
        return true;
    });

    container.innerHTML = uniqueStates.map(state => {
        let inputHtml = '';
        
        switch (state.mark_type) {
            case 'binary':
                inputHtml = `
                    <div class="flex gap-2" id="custom_state_binary_${state.id}">
                        <button type="button" data-custom-binary="${state.id}" data-value="no" class="custom-binary-btn px-5 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Нет</button>
                        <button type="button" data-custom-binary="${state.id}" data-value="yes" class="custom-binary-btn px-5 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Да</button>
                    </div>
                    <input type="hidden" id="custom_state_binary_input_${state.id}" name="custom_state_${state.id}" value="">
                `;
                break;
            case 'categorical':
                inputHtml = `
                    <div class="grid grid-cols-4 gap-2" id="custom_state_cat_${state.id}" data-custom-cat="${state.id}">
                        <button type="button" data-value="none" class="custom-cat-btn px-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Нет</button>
                        <button type="button" data-value="mild" class="custom-cat-btn px-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Лёгкое</button>
                        <button type="button" data-value="moderate" class="custom-cat-btn px-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Умеренное</button>
                        <button type="button" data-value="severe" class="custom-cat-btn px-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Тяжёлое</button>
                    </div>
                    <input type="hidden" id="custom_state_cat_input_${state.id}" name="custom_state_${state.id}" value="">
                `;
                break;
            case 'numeric':
                inputHtml = `
                    <div class="flex items-center gap-4">
                        <input type="range" id="custom_state_num_${state.id}" name="custom_state_${state.id}" 
                               min="0" max="10" value="5" 
                               class="flex-1">
                        <span id="custom_state_num_value_${state.id}" class="text-sm font-medium text-gray-700 dark:text-gray-300 w-8">5</span>
                    </div>
                `;
                break;
            case 'multi_checkbox':
                const options = Array.isArray(state.options) ? state.options : [];
                if (options.length === 0) {
                    inputHtml = `
                        <p class="text-xs text-gray-500 dark:text-gray-400">Для этого состояния ещё не заданы варианты чекбоксов.</p>
                    `;
                } else {
                    const optionsHtml = options.map(optionLabel => `
                        <label class="flex items-center text-base text-gray-700 dark:text-gray-300">
                            <input type="checkbox" name="custom_state_${state.id}" value="${optionLabel}">
                            <span>${optionLabel}</span>
                        </label>
                    `).join('');
                    inputHtml = `
                        <div class="flex flex-wrap gap-3 custom-state-multi-checkbox" id="custom_state_multi_${state.id}">
                            ${optionsHtml}
                        </div>
                    `;
                }
                break;
        }
        
        return `
            <div class="mb-4" id="custom_state_${state.id}">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ${state.name}
                </p>
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        ${inputHtml}
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <button 
                            type="button" 
                            onclick="editCustomState(${state.id})" 
                            class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1"
                            title="Редактировать"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                            <span>Изменить</span>
                        </button>
                        <button 
                            type="button" 
                            onclick="deleteCustomState(${state.id})" 
                            class="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1.5 px-2 py-1"
                            title="Удалить"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-4 0a1 1 0 00-1 1v1h6V4a1 1 0 00-1-1m-4 0h4"></path>
                            </svg>
                            <span>Удалить</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Инициализация обработчиков для пользовательских состояний
    initializeCustomStateHandlers();
}

// Глобальные обработчики для пользовательских состояний (добавляются один раз)
let customStateHandlersInitialized = false;

/**
 * Инициализация обработчиков для пользовательских состояний
 */
function initializeCustomStateHandlers() {
    // Используем делегирование событий на контейнере, чтобы избежать дублирования обработчиков
    const container = document.getElementById('custom-states-list');
    if (!container) return;
    
    // Добавляем обработчики только один раз
    if (customStateHandlersInitialized) return;
    customStateHandlersInitialized = true;
    
    // Бинарные и категориальные кнопки - используем делегирование событий
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-custom-binary]');
        if (btn) {
            const stateId = btn.getAttribute('data-custom-binary');
            const value = btn.getAttribute('data-value');
            const isAlreadyActive = btn.classList.contains('active');

            // Toggle off
            if (isAlreadyActive) {
                setCustomStateBinary(stateId, '');
                return;
            }

            setCustomStateBinary(stateId, value);
            return;
        }
        
        // Категориальные кнопки
        const catBtn = e.target.closest('.custom-cat-btn');
        if (catBtn) {
            const group = catBtn.closest('[data-custom-cat]');
            if (group) {
                const stateId = group.getAttribute('data-custom-cat');
                const value = catBtn.getAttribute('data-value');
                const isAlreadyActive = catBtn.classList.contains('active');

                // Toggle off
                if (isAlreadyActive) {
                    setCustomStateCategorical(stateId, '');
                    return;
                }

                setCustomStateCategorical(stateId, value);
                return;
            }
        }
    });
    
    // Числовые ползунки - используем делегирование событий
    container.addEventListener('input', (e) => {
        const slider = e.target;
        if (slider.id && slider.id.startsWith('custom_state_num_')) {
            const stateId = slider.id.replace('custom_state_num_', '');
            const valueDisplay = document.getElementById(`custom_state_num_value_${stateId}`);
            if (valueDisplay) {
                valueDisplay.textContent = slider.value;
            }
        }
    });
    
    // Множественные чекбоксы - используем делегирование событий
    container.addEventListener('change', (e) => {
        const checkbox = e.target;
        if (checkbox.type === 'checkbox' && checkbox.closest('.custom-state-multi-checkbox')) {
            const label = checkbox.closest('label');
            if (label) {
                if (checkbox.checked) {
                    label.classList.add('active');
                } else {
                    label.classList.remove('active');
                }
            }
        }
    });
}

function setCustomStateBinary(stateId, value) {
    const group = document.querySelectorAll(`[data-custom-binary="${stateId}"]`);
    const hiddenInput = document.getElementById(`custom_state_binary_input_${stateId}`);
    
    // Если value пустой, убираем все активные состояния
    if (!value || value === '') {
        group.forEach(btn => {
            btn.classList.remove('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
        });
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        return;
    }
    
    group.forEach(btn => {
        const btnValue = btn.getAttribute('data-value');
        if (btnValue === value) {
            btn.classList.add('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
        } else {
            btn.classList.remove('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
        }
    });
    
    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

function setCustomStateCategorical(stateId, value) {
    const group = document.querySelector(`[data-custom-cat="${stateId}"]`);
    if (!group) return;
    
    const buttons = group.querySelectorAll('.custom-cat-btn');
    const hiddenInput = document.getElementById(`custom_state_cat_input_${stateId}`);
    
    // Если value пустой, убираем все активные состояния
    if (!value || value === '') {
        buttons.forEach(btn => {
            btn.classList.remove('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
        });
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        return;
    }
    
    buttons.forEach(btn => {
        const btnValue = btn.getAttribute('data-value');
        if (btnValue === value) {
            btn.classList.add('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
        } else {
            btn.classList.remove('active', 'bg-indigo-50', 'dark:bg-indigo-900', 'border-indigo-500', 'text-indigo-700', 'dark:text-indigo-200');
        }
    });
    
    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

function setCustomStateValue(stateId, value) {
    const state = customStates.find(s => s.id.toString() === stateId.toString());
    if (!state) return;
    
    switch (state.mark_type) {
        case 'binary':
            setCustomStateBinary(stateId, value);
            break;
        case 'categorical':
            setCustomStateCategorical(stateId, value);
            break;
        case 'numeric':
            const numInput = document.getElementById(`custom_state_num_${stateId}`);
            if (numInput) {
                numInput.value = value;
                const valueDisplay = document.getElementById(`custom_state_num_value_${stateId}`);
                if (valueDisplay) valueDisplay.textContent = value;
            }
            break;
        case 'multi_checkbox':
            const container = document.getElementById(`custom_state_multi_${stateId}`);
            if (container) {
                // Значение для множественного выбора - строка со значениями через запятую
                const values = value.split(',').map(v => v.trim());
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    const isChecked = values.includes(cb.value);
                    cb.checked = isChecked;
                    // Обновляем визуальное состояние label
                    const label = cb.closest('label');
                    if (label) {
                        if (isChecked) {
                            label.classList.add('active');
                        } else {
                            label.classList.remove('active');
                        }
                    }
                });
            }
            break;
    }
}

/**
 * Сбор данных формы (оптимизированная версия)
 */
function collectFormData() {
    const form = document.getElementById('entryForm');
    if (!form) return null;
    
    // Используем прямые селекторы вместо FormData для ускорения
    const getValue = (name) => {
        const input = form.querySelector(`[name="${name}"]`);
        return input ? input.value : '';
    };
    
    const depressive_state = getValue('depressive_state') || 'none';
    const manic_state = getValue('manic_state') || 'none';
    const irritable_state = getValue('irritable_state') || 'none';
    const anxious_state = getValue('anxious_state') || 'none';
    
    const sleepHoursInput = form.querySelector('[name="sleep_hours"]');
    const sleepQualityInput = form.querySelector('[name="sleep_quality"]');
    const notesInput = form.querySelector('[name="notes"]');
    const psychoticInput = form.querySelector('[name="psychotic_symptoms"]');
    const psychotherapyInput = form.querySelector('[name="psychotherapy"]');

    // Проверяем, установлен ли тип дня вручную пользователем
    // Используем скрытое поле для хранения пользовательского выбора
    const manualDayTypeInput = form.querySelector('input[name="manual_day_type"]');
    const manualDayType = manualDayTypeInput ? manualDayTypeInput.value : null;

    // Числовые прокси для обратной совместимости с аналитикой
    const data = {
        date: selectedDate,
        mood: STATE_SCORE[depressive_state] ?? 0,
        irritability: STATE_SCORE[irritable_state] ?? 0,
        anxiety: STATE_SCORE[anxious_state] ?? 0,
        energy: STATE_SCORE[manic_state] ?? 5,
        sleep_hours: sleepHoursInput ? parseFloat(sleepHoursInput.value) : 0,
        sleep_quality: sleepQualityInput ? sleepQualityInput.value : 'average',
        notes: notesInput ? notesInput.value : '',
        medications: {},
        custom_values: {},
        custom_state_values: {},
        depressive_state,
        manic_state,
        irritable_state,
        anxious_state,
        psychotic_symptoms: psychoticInput ? psychoticInput.value === 'yes' : false,
        psychotherapy: psychotherapyInput ? psychotherapyInput.value === 'yes' : false
    };
    
    // Добавляем пользовательский тип дня, если он установлен вручную
    if (manualDayType && manualDayType !== '') {
        data.day_type = manualDayType;
    }
    
    // Лекарства (оптимизированный сбор через прямые селекторы)
    medications.forEach(med => {
        const checkbox = form.querySelector(`[name="medication_check_${med.id}"]`);
        data.medications[med.id] = checkbox ? checkbox.checked : false;
    });
    
    // Пользовательские состояния (оптимизированный сбор)
    customStates.forEach(state => {
        let value = null;
        
        switch (state.mark_type) {
            case 'binary':
            case 'categorical':
            case 'numeric':
                const input = form.querySelector(`[name="custom_state_${state.id}"]`);
                value = input ? input.value : null;
                break;
            case 'multi_checkbox':
                const checkboxes = form.querySelectorAll(`input[name="custom_state_${state.id}"]:checked`);
                if (checkboxes.length > 0) {
                    value = Array.from(checkboxes).map(cb => cb.value).join(',');
                }
                break;
        }
        
        if (value !== null && value !== '') {
            data.custom_state_values[state.id] = value;
        }
    });
    
    return data;
}

/**
 * Сохранение записи
 */
async function saveEntry(showMessage = true) {
    const data = collectFormData();
    if (!data) {
        if (showMessage) {
            StabilUtils.showMessage('Не удалось собрать данные формы', 'error');
        }
        return { success: false, error: 'Не удалось собрать данные формы' };
    }
    
    try {
        const response = await fetch('/save_entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (showMessage) {
                StabilUtils.showMessage('Запись сохранена успешно!', 'success');
            }

            // Обновляем блок типа дня по ответу сервера (если он есть)
            updateDayTypeUI(result.day_type, result.day_type_explanation);
            
            // Очищаем черновик заметок после успешного сохранения
            if (typeof clearNotesDraft === 'function') {
                clearNotesDraft();
            }
            
            return { success: true, day_type: result.day_type, day_type_explanation: result.day_type_explanation };
        } else {
            if (showMessage) {
                StabilUtils.showMessage(result.message || 'Ошибка при сохранении записи', 'error');
            }
            return { success: false, error: result.message };
        }
    } catch (error) {
        console.error('Ошибка сохранения записи:', error);
        if (showMessage) {
            StabilUtils.showMessage('Ошибка при сохранении записи', 'error');
        }
        return { success: false, error: error.message };
    }
}

/**
 * Модалки для лекарств, трекеров и состояний
 */
let editingMedicationId = null;

function addMedication() {
    editingMedicationId = null;
    document.getElementById('medication-modal-title').textContent = 'Добавить лекарство';
    document.getElementById('save-medication-btn').textContent = 'Добавить';
    document.getElementById('addMedicationModal').classList.remove('hidden');
    document.getElementById('new-medication-name').value = '';
    document.getElementById('new-medication-dosage').value = '';
    document.getElementById('new-medication-time').value = '';
    document.getElementById('new-medication-frequency').value = 'daily';
    document.getElementById('new-medication-name').focus();
}

function editMedication(medId) {
    // Унифицируем сравнение ID
    const med = medications.find(m => {
        const mId = typeof m.id === 'number' ? m.id : parseInt(m.id);
        const searchId = typeof medId === 'number' ? medId : parseInt(medId);
        return mId === searchId;
    });
    if (!med) return;
    
    editingMedicationId = medId;
    document.getElementById('medication-modal-title').textContent = 'Редактировать лекарство';
    document.getElementById('save-medication-btn').textContent = 'Сохранить';
    document.getElementById('new-medication-name').value = med.name || '';
    document.getElementById('new-medication-dosage').value = med.dosage_mg || '';
    document.getElementById('new-medication-time').value = med.time_of_day || '';
    document.getElementById('new-medication-frequency').value = med.frequency || 'daily';
    document.getElementById('addMedicationModal').classList.remove('hidden');
    document.getElementById('new-medication-name').focus();
}

function closeAddMedicationModal() {
    document.getElementById('addMedicationModal').classList.add('hidden');
    editingMedicationId = null;
}

async function saveMedication() {
    const name = document.getElementById('new-medication-name').value.trim();
    const dosage_mg = document.getElementById('new-medication-dosage').value ? parseInt(document.getElementById('new-medication-dosage').value) : null;
    const time_of_day = document.getElementById('new-medication-time').value || null;
    const frequency = document.getElementById('new-medication-frequency').value || 'daily';
    
    if (!name) {
        StabilUtils.showMessage('Введите название лекарства', 'error');
        return;
    }
    
    try {
        const url = editingMedicationId ? '/update_medication' : '/add_medication';
        const body = editingMedicationId 
            ? { med_id: editingMedicationId, name, dosage_mg, time_of_day, frequency }
            : { name, dosage_mg, time_of_day, frequency };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            StabilUtils.showMessage(editingMedicationId ? 'Лекарство обновлено' : 'Лекарство добавлено', 'success');
            closeAddMedicationModal();
            
            if (editingMedicationId) {
                // Костыль: удаляем все элементы с таким ID и добавляем обновленное
                // Полная очистка DOM в updateMedicationsList() гарантирует отсутствие дубликатов
                const editingId = typeof editingMedicationId === 'number' ? editingMedicationId : parseInt(editingMedicationId);
                
                // Удаляем все элементы с таким ID
                medications = medications.filter(m => {
                    const mId = typeof m.id === 'number' ? m.id : parseInt(m.id);
                    return mId !== editingId;
                });
                
                // Добавляем обновленное лекарство
                medications.push(result.medication);
            } else {
                // При добавлении нового тоже проверяем на дубликаты
                const newId = typeof result.medication.id === 'number' ? result.medication.id : parseInt(result.medication.id);
                medications = medications.filter(m => {
                    const mId = typeof m.id === 'number' ? m.id : parseInt(m.id);
                    return mId !== newId;
                });
                medications.push(result.medication);
            }
            
            // Сортируем по ID для консистентности
            medications.sort((a, b) => {
                const aId = typeof a.id === 'number' ? a.id : parseInt(a.id);
                const bId = typeof b.id === 'number' ? b.id : parseInt(b.id);
                return aId - bId;
            });
            
            // Полностью пересоздаем список (костыль удаляет все старые элементы)
            updateMedicationsList();
        } else {
            StabilUtils.showMessage(result.message || 'Ошибка при сохранении лекарства', 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения лекарства:', error);
        StabilUtils.showMessage('Ошибка при сохранении лекарства', 'error');
    }
}

async function deleteMedication(medId) {
    // Унифицируем сравнение ID
    const med = medications.find(m => {
        const mId = typeof m.id === 'number' ? m.id : parseInt(m.id);
        const searchId = typeof medId === 'number' ? medId : parseInt(medId);
        return mId === searchId;
    });
    if (!med) return;

    const confirmed = window.confirm(`Удалить лекарство "${med.name}" и все отметки его приёма?`);
    if (!confirmed) return;

    try {
        const response = await fetch('/delete_medication', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ med_id: medId })
        });

        const result = await response.json();
        if (result.success) {
            // Унифицируем сравнение ID при удалении
            const deleteId = typeof medId === 'number' ? medId : parseInt(medId);
            medications = medications.filter(m => {
                const mId = typeof m.id === 'number' ? m.id : parseInt(m.id);
                return mId !== deleteId;
            });
            updateMedicationsList();
            StabilUtils.showMessage('Лекарство удалено', 'success');
        } else {
            StabilUtils.showMessage(result.message || 'Ошибка при удалении лекарства', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления лекарства:', error);
        StabilUtils.showMessage('Ошибка при удалении лекарства', 'error');
    }
}


let editingStateId = null;

function addCustomState() {
    editingStateId = null;
    document.getElementById('state-modal-title').textContent = 'Добавить состояние';
    document.getElementById('save-state-btn').textContent = 'Добавить';
    document.getElementById('addCustomStateModal').classList.remove('hidden');
    document.getElementById('new-state-name').value = '';
    document.getElementById('new-state-mark-type').value = 'categorical';
    resetNewStateOptions();
    initializeNewStateModal();
    document.getElementById('new-state-name').focus();
}

function editCustomState(stateId) {
    // Унифицируем сравнение ID (могут быть строки или числа)
    const state = customStates.find(s => {
        const sId = typeof s.id === 'number' ? s.id : parseInt(s.id);
        const searchId = typeof stateId === 'number' ? stateId : parseInt(stateId);
        return sId === searchId;
    });
    if (!state) return;
    
    editingStateId = stateId;
    document.getElementById('state-modal-title').textContent = 'Редактировать состояние';
    document.getElementById('save-state-btn').textContent = 'Сохранить';
    document.getElementById('new-state-name').value = state.name || '';
    document.getElementById('new-state-mark-type').value = state.mark_type || 'categorical';
    
    resetNewStateOptions();
    
    // Если тип multi_checkbox, загружаем опции
    if (state.mark_type === 'multi_checkbox' && state.options) {
        const optionsArray = Array.isArray(state.options) 
            ? state.options 
            : (typeof state.options === 'string' ? state.options.split('||') : []);
        
        const list = document.getElementById('new-state-options-list');
        optionsArray.forEach(option => {
            if (option && option.trim()) {
                const row = document.createElement('div');
                row.className = 'flex items-center gap-2';
                row.innerHTML = `
                    <input type="text" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 new-state-option-input" value="${option.trim()}" placeholder="Новый вариант">
                    <button type="button" onclick="removeNewStateOptionRow(this)" class="text-xs text-gray-500 hover:text-gray-700">Удалить</button>
                `;
                list.appendChild(row);
            }
        });
    }
    
    initializeNewStateModal();
    document.getElementById('addCustomStateModal').classList.remove('hidden');
    document.getElementById('new-state-name').focus();
}

function closeAddCustomStateModal() {
    document.getElementById('addCustomStateModal').classList.add('hidden');
    editingStateId = null;
}

async function saveCustomState() {
    const name = document.getElementById('new-state-name').value.trim();
    const mark_type = document.getElementById('new-state-mark-type').value;
    let options = [];
    
    if (mark_type === 'multi_checkbox') {
        const inputs = document.querySelectorAll('#new-state-options-list .new-state-option-input');
        inputs.forEach(input => {
            const val = input.value.trim();
            if (val) {
                options.push(val);
            }
        });
        
        if (options.length === 0) {
            StabilUtils.showMessage('Добавьте хотя бы один вариант для чекбоксов', 'error');
            return;
        }
    }
    
    if (!name) {
        StabilUtils.showMessage('Введите название состояния', 'error');
        return;
    }
    
    try {
        const url = editingStateId ? '/update_custom_state' : '/add_custom_state';
        const body = editingStateId 
            ? { state_id: editingStateId, name, mark_type, options }
            : { name, mark_type, options };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            StabilUtils.showMessage(editingStateId ? 'Состояние обновлено' : 'Состояние добавлено', 'success');
            closeAddCustomStateModal();
            
            const updatedState = result.state;
            // Обрабатываем опции для multi_checkbox
            if (updatedState && updatedState.mark_type === 'multi_checkbox') {
                if (Array.isArray(updatedState.options)) {
                    updatedState.options = updatedState.options;
                } else if (updatedState.options === null || updatedState.options === undefined) {
                    updatedState.options = options.length > 0 ? options : [];
                } else if (typeof updatedState.options === 'string') {
                    updatedState.options = updatedState.options.split('||').map(o => o.trim()).filter(Boolean);
                } else {
                    updatedState.options = [];
                }
            }
            
            if (editingStateId) {
                // Костыль: просто удаляем старое состояние и добавляем новое
                // Полная очистка DOM в updateCustomStatesList() гарантирует отсутствие дубликатов
                const editingId = typeof editingStateId === 'number' ? editingStateId : parseInt(editingStateId);
                
                // Удаляем все элементы с таким ID
                customStates = customStates.filter(s => {
                    const sId = typeof s.id === 'number' ? s.id : parseInt(s.id);
                    return sId !== editingId;
                });
                
                // Добавляем обновленное состояние
                customStates.push(updatedState);
            } else {
                // При добавлении нового тоже проверяем на дубликаты
                const newId = typeof updatedState.id === 'number' ? updatedState.id : parseInt(updatedState.id);
                customStates = customStates.filter(s => {
                    const sId = typeof s.id === 'number' ? s.id : parseInt(s.id);
                    return sId !== newId;
                });
                customStates.push(updatedState);
            }
            
            // Сортируем по ID для консистентности
            customStates.sort((a, b) => {
                const aId = typeof a.id === 'number' ? a.id : parseInt(a.id);
                const bId = typeof b.id === 'number' ? b.id : parseInt(b.id);
                return aId - bId;
            });
            
            // Полностью пересоздаем список (костыль удаляет все старые элементы)
            updateCustomStatesList();
        } else {
            StabilUtils.showMessage(result.message || 'Ошибка при сохранении состояния', 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения состояния:', error);
        StabilUtils.showMessage('Ошибка при сохранении состояния', 'error');
    }
}

async function deleteCustomState(stateId) {
    // Унифицируем сравнение ID
    const state = customStates.find(s => {
        const sId = typeof s.id === 'number' ? s.id : parseInt(s.id);
        const searchId = typeof stateId === 'number' ? stateId : parseInt(stateId);
        return sId === searchId;
    });
    if (!state) return;

    const confirmed = window.confirm(`Удалить состояние "${state.name}" и все его отметки в записях?`);
    if (!confirmed) return;

    try {
        const response = await fetch('/delete_custom_state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ state_id: stateId })
        });

        const result = await response.json();
        if (result.success) {
            // Унифицируем сравнение ID при удалении
            const deleteId = typeof stateId === 'number' ? stateId : parseInt(stateId);
            customStates = customStates.filter(s => {
                const sId = typeof s.id === 'number' ? s.id : parseInt(s.id);
                return sId !== deleteId;
            });
            updateCustomStatesList();
            StabilUtils.showMessage('Состояние удалено', 'success');
        } else {
            StabilUtils.showMessage(result.message || 'Ошибка при удалении состояния', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления состояния:', error);
        StabilUtils.showMessage('Ошибка при удалении состояния', 'error');
    }
}

function initializeNewStateModal() {
    const typeSelect = document.getElementById('new-state-mark-type');
    const optionsWrapper = document.getElementById('new-state-options-wrapper');
    if (!typeSelect || !optionsWrapper) return;
    
    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'multi_checkbox') {
            optionsWrapper.classList.remove('hidden');
        } else {
            optionsWrapper.classList.add('hidden');
        }
    });
}

function addNewStateOptionRow() {
    const list = document.getElementById('new-state-options-list');
    if (!list) return;
    
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
        <input type="text" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 new-state-option-input" placeholder="Новый вариант">
        <button type="button" onclick="removeNewStateOptionRow(this)" class="text-xs text-gray-500 hover:text-gray-700">Удалить</button>
    `;
    list.appendChild(row);
}

function removeNewStateOptionRow(button) {
    const row = button.closest('div');
    const list = document.getElementById('new-state-options-list');
    if (row && list && list.children.length > 1) {
        list.removeChild(row);
    } else if (row && list && list.children.length === 1) {
        // Если строка одна, просто очищаем поле
        const input = row.querySelector('input');
        if (input) input.value = '';
    }
}

function resetNewStateOptions() {
    const optionsWrapper = document.getElementById('new-state-options-wrapper');
    const list = document.getElementById('new-state-options-list');
    if (!optionsWrapper || !list) return;
    
    optionsWrapper.classList.add('hidden');
    list.innerHTML = `
        <div class="flex items-center gap-2">
            <input type="text" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 new-state-option-input" placeholder="Например: сигареты">
            <button type="button" onclick="removeNewStateOptionRow(this)" class="text-xs text-gray-500 hover:text-gray-700">Удалить</button>
        </div>
    `;
}

/**
 * Инициализация улучшенных заметок (дневник)
 */
function initializeEnhancedNotes() {
    const notesField = document.getElementById('notes');
    const notesCounter = document.getElementById('notes-counter');
    const notesPrompts = document.getElementById('notes-prompts');
    const promptButtons = document.querySelectorAll('.prompt-btn');
    const notesExpandBtn = document.getElementById('notes-expand-btn');
    const notesFullscreenModal = document.getElementById('notes-fullscreen-modal');
    const notesFullscreen = document.getElementById('notes-fullscreen');
    const notesFullscreenCounter = document.getElementById('notes-fullscreen-counter');
    const notesCloseFullscreen = document.getElementById('notes-close-fullscreen');
    const autosaveIndicator = document.getElementById('notes-autosave-indicator');
    const autosaveStatus = document.getElementById('autosave-status');
    
    if (!notesField) return;
    
    // Обновление счетчика символов и слов
    function updateCounter(field, counterElement) {
        const text = field.value;
        const charCount = text.length;
        const wordCount = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
        
        if (counterElement) {
            counterElement.textContent = `${charCount} символов, ${wordCount} слов`;
            counterElement.classList.toggle('text-indigo-600', charCount > 0);
            counterElement.classList.toggle('dark:text-indigo-400', charCount > 0);
        }
    }
    
    // Автосохранение черновика в localStorage
    let autosaveTimeout;
    function autosave() {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => {
            const draftKey = `entry_draft_${selectedDate}`;
            localStorage.setItem(draftKey, notesField.value);
            
            if (autosaveIndicator && autosaveStatus) {
                autosaveIndicator.classList.remove('hidden');
                autosaveStatus.textContent = 'Черновик сохранен';
                setTimeout(() => {
                    autosaveIndicator.classList.add('hidden');
                }, 2000);
            }
        }, 2000); // Сохраняем через 2 секунды после последнего изменения
    }
    
    // Загрузка черновика из localStorage
    function loadDraft() {
        const draftKey = `entry_draft_${selectedDate}`;
        const draft = localStorage.getItem(draftKey);
        // Загружаем черновик только если поле пустое и нет сохраненной записи
        if (draft && !notesField.value.trim()) {
            notesField.value = draft;
            if (typeof window.autoResizeTextarea === 'function') {
                window.autoResizeTextarea(notesField);
            }
            updateCounter(notesField, notesCounter);
        }
    }
    
    // Очистка черновика после успешного сохранения
    function clearDraft() {
        const draftKey = `entry_draft_${selectedDate}`;
        localStorage.removeItem(draftKey);
    }
    
    // Функция авторасширения textarea (доступна глобально)
    window.autoResizeTextarea = function(textarea) {
        if (!textarea) return;
        // Сбрасываем высоту для правильного расчета scrollHeight
        textarea.style.height = 'auto';
        // Устанавливаем новую высоту на основе содержимого
        textarea.style.height = textarea.scrollHeight + 'px';
    };
    
    // Инициализируем авторасширение при загрузке
    if (notesField && typeof window.autoResizeTextarea === 'function') {
        window.autoResizeTextarea(notesField);
    }
    
    // Обработчики событий для основного поля
    notesField.addEventListener('input', () => {
        if (typeof window.autoResizeTextarea === 'function') {
            window.autoResizeTextarea(notesField);
        }
        updateCounter(notesField, notesCounter);
        autosave();
    });
    
    // Подсказки для размышления
    promptButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.textContent.trim();
            const currentText = notesField.value;
            const newText = currentText ? `${currentText}\n\n${prompt}\n` : `${prompt}\n`;
            notesField.value = newText;
            if (typeof window.autoResizeTextarea === 'function') {
                window.autoResizeTextarea(notesField);
            }
            notesField.focus();
            // Перемещаем курсор в конец
            notesField.setSelectionRange(notesField.value.length, notesField.value.length);
            updateCounter(notesField, notesCounter);
            autosave();
        });
    });
    
    // Скрытие подсказок при начале ввода
    notesField.addEventListener('focus', () => {
        if (notesPrompts && notesField.value.length > 50) {
            notesPrompts.style.opacity = '0.6';
        }
    });
    
    notesField.addEventListener('blur', () => {
        if (notesPrompts) {
            notesPrompts.style.opacity = '1';
        }
    });
    
    // Полноэкранный режим редактирования
    if (notesExpandBtn && notesFullscreenModal && notesFullscreen) {
        notesExpandBtn.addEventListener('click', () => {
            notesFullscreen.value = notesField.value;
            updateCounter(notesFullscreen, notesFullscreenCounter);
            notesFullscreenModal.classList.remove('hidden');
            notesFullscreen.focus();
            
            // Синхронизация с основным полем
            notesFullscreen.addEventListener('input', () => {
                notesField.value = notesFullscreen.value;
                if (typeof window.autoResizeTextarea === 'function') {
                    window.autoResizeTextarea(notesField);
                }
                updateCounter(notesField, notesCounter);
                updateCounter(notesFullscreen, notesFullscreenCounter);
                autosave();
            });
        });
        
        if (notesCloseFullscreen) {
            notesCloseFullscreen.addEventListener('click', () => {
                notesFullscreenModal.classList.add('hidden');
            });
        }
        
        // Закрытие по Escape
        notesFullscreenModal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                notesFullscreenModal.classList.add('hidden');
            }
        });
        
        // Закрытие при клике вне модального окна
        notesFullscreenModal.addEventListener('click', (e) => {
            if (e.target === notesFullscreenModal) {
                notesFullscreenModal.classList.add('hidden');
            }
        });
    }
    
    // Инициализация при загрузке
    updateCounter(notesField, notesCounter);
    
    // Функция для загрузки черновика заметок (будет вызвана из loadEntryForDate)
    window.loadNotesDraft = function() {
        loadDraft();
    };
    
    // Функция для очистки черновика заметок (будет вызвана из saveEntry)
    window.clearNotesDraft = function() {
        clearDraft();
    };
}

/**
 * Инициализация автосохранения
 */
function initializeAutoSave() {
    let autosaveTimeout;
    let isSaving = false;
    let lastSavedDataHash = null; // Хэш последних сохраненных данных
    const statusText = document.getElementById('autosave-text');
    
    // Кэшируем селекторы для быстрого доступа
    const form = document.getElementById('entryForm');
    if (!form) return;
    
    function showStatus(message, isSuccess = true) {
        if (statusText) {
            statusText.textContent = message;
            statusText.classList.remove('text-gray-500', 'text-green-600', 'text-red-600', 'dark:text-gray-400', 'dark:text-green-400', 'dark:text-red-400');
            if (isSuccess) {
                statusText.classList.add('text-green-600', 'dark:text-green-400');
            } else {
                statusText.classList.add('text-red-600', 'dark:text-red-400');
            }
        }
    }
    
    function resetStatus() {
        if (statusText) {
            setTimeout(() => {
                statusText.textContent = 'Изменения сохраняются автоматически';
                statusText.classList.remove('text-green-600', 'text-red-600', 'dark:text-green-400', 'dark:text-red-400');
                statusText.classList.add('text-gray-500', 'dark:text-gray-400');
            }, 1500);
        }
    }
    
    // Быстрое вычисление хэша данных для сравнения
    function getDataHash(data) {
        return JSON.stringify({
            d: data.depressive_state,
            m: data.manic_state,
            i: data.irritable_state,
            a: data.anxious_state,
            ps: data.psychotic_symptoms,
            pt: data.psychotherapy,
            sh: data.sleep_hours,
            sq: data.sleep_quality,
            n: data.notes,
            med: Object.keys(data.medications).sort().map(k => `${k}:${data.medications[k]}`).join(','),
            csv: Object.keys(data.custom_state_values).sort().map(k => `${k}:${data.custom_state_values[k]}`).join(',')
        });
    }
    
    async function performAutoSave() {
        if (isSaving || isLoadingData) return;
        
        // Быстро собираем данные
        const data = collectFormData();
        if (!data) return;
        
        // Проверяем, изменились ли данные
        const currentHash = getDataHash(data);
        if (currentHash === lastSavedDataHash) {
            // Данные не изменились, пропускаем сохранение
            return;
        }
        
        isSaving = true;
        showStatus('Сохранение...', true);
        
        try {
            const response = await fetch('/save_entry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result && result.success) {
                lastSavedDataHash = currentHash; // Сохраняем хэш успешно сохраненных данных
                showStatus('✓ Сохранено', true);
                resetStatus();
                
                // Обновляем блок типа дня по ответу сервера (если он есть)
                if (result.day_type !== undefined) {
                    updateDayTypeUI(result.day_type, result.day_type_explanation);
                }
                
                // Очищаем черновик заметок после успешного сохранения
                if (typeof clearNotesDraft === 'function') {
                    clearNotesDraft();
                }
            } else {
                showStatus('Ошибка сохранения', false);
                resetStatus();
            }
        } catch (error) {
            console.error('Ошибка автосохранения:', error);
            showStatus('Ошибка сохранения', false);
            resetStatus();
        } finally {
            isSaving = false;
        }
    }
    
    // Throttling для разных типов полей
    let notesThrottleTimeout = null;
    let isNotesInput = false;
    
    // Автосохранение при изменении полей
    function scheduleAutoSave(isNotes = false) {
        // Не сохраняем, если идет загрузка данных
        if (isLoadingData || isSaving) return;
        
        // Для заметок используем более длинный throttle
        if (isNotes) {
            isNotesInput = true;
            clearTimeout(notesThrottleTimeout);
            notesThrottleTimeout = setTimeout(() => {
                isNotesInput = false;
                clearTimeout(autosaveTimeout);
                autosaveTimeout = setTimeout(performAutoSave, 2000);
            }, 4000); // Для заметок ждем 4 секунды после последнего ввода
            return;
        }
        
        clearTimeout(autosaveTimeout);
        // Для остальных полей - 3 секунды
        autosaveTimeout = setTimeout(performAutoSave, 3000);
    }
    
    // Сбрасываем хэш при смене даты
    const originalLoadEntryForDate = window.loadEntryForDate;
    if (originalLoadEntryForDate) {
        window.loadEntryForDate = async function(dateStr) {
            lastSavedDataHash = null; // Сбрасываем хэш при смене даты
            clearTimeout(autosaveTimeout); // Отменяем запланированное автосохранение
            clearTimeout(notesThrottleTimeout); // Отменяем throttle для заметок
            isNotesInput = false;
            await originalLoadEntryForDate(dateStr);
        };
    }
    
    // Используем делегирование событий для лучшей производительности
    // Один обработчик на всю форму вместо множества отдельных
    
    form.addEventListener('click', (e) => {
        // Состояния
        if (e.target.classList.contains('state-btn')) {
            scheduleAutoSave();
        }
        // Бинарные кнопки
        else if (e.target.hasAttribute('data-binary')) {
            scheduleAutoSave();
        }
        // Пользовательские состояния (кнопки)
        else if (e.target.classList.contains('custom-binary-btn') || 
                 e.target.classList.contains('custom-cat-btn') ||
                 e.target.closest('[data-custom-binary]') ||
                 e.target.closest('.custom-cat-btn')) {
            scheduleAutoSave();
        }
    });
    
    form.addEventListener('change', (e) => {
        const target = e.target;
        // Качество сна
        if (target.name === 'sleep_quality') {
            scheduleAutoSave();
        }
        // Лекарства
        else if (target.name && target.name.startsWith('medication_check_')) {
            scheduleAutoSave();
        }
        // Пользовательские состояния (чекбоксы)
        else if (target.name && target.name.startsWith('custom_state_')) {
            scheduleAutoSave();
        }
    });
    
    form.addEventListener('input', (e) => {
        const target = e.target;
        // Ползунок сна
        if (target.name === 'sleep_hours') {
            scheduleAutoSave(false);
        }
        // Заметки - используем специальный throttle
        else if (target.name === 'notes') {
            scheduleAutoSave(true);
        }
        // Числовые ползунки пользовательских состояний
        else if (target.id && target.id.startsWith('custom_state_num_')) {
            scheduleAutoSave(false);
        }
    });
}

/**
 * Определение типа дня
 */
async function determineDayType() {
    const btn = document.getElementById('determine-day-type-btn');
    if (!btn) return;
    
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Определение...';
    
    try {
        // Сохраняем запись, чтобы получить тип дня
        const result = await saveEntry(false);
        
        if (result && result.success) {
            StabilUtils.showMessage('Тип дня определен', 'success');
        } else {
            StabilUtils.showMessage(result?.error || 'Ошибка при определении типа дня', 'error');
        }
    } catch (error) {
        console.error('Ошибка определения типа дня:', error);
        StabilUtils.showMessage('Ошибка при определении типа дня', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Горячие клавиши для модалок
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (!document.getElementById('addMedicationModal').classList.contains('hidden')) {
            closeAddMedicationModal();
        }
        if (!document.getElementById('addCustomStateModal').classList.contains('hidden')) {
            closeAddCustomStateModal();
        }
        if (!document.getElementById('notes-fullscreen-modal').classList.contains('hidden')) {
            document.getElementById('notes-fullscreen-modal').classList.add('hidden');
        }
    }
});
