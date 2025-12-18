/**
 * JavaScript для страницы ввода/редактирования дневной записи
 */

let medications = [];
let customStates = [];
let selectedDate = window.today || new Date().toISOString().split('T')[0];

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

document.addEventListener('DOMContentLoaded', function() {
    initializeEntryPage();
});

function initializeEntryPage() {
    // Инициализируем справочники
    medications = Array.isArray(window.medications) ? window.medications : [];
    customStates = Array.isArray(window.customStates) ? window.customStates : [];
    customStates = customStates.map(state => 
        state.mark_type === 'multi_checkbox' 
            ? {...state, options: (state.options || '').split('||').map(o => o.trim()).filter(Boolean)}
            : state
    );
    
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
    
    // Подключаем обработчик сохранения
    const entryForm = document.getElementById('entryForm');
    if (entryForm) {
        entryForm.addEventListener('submit', saveEntry);
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
            const date = new Date(selectedDate);
            date.setDate(date.getDate() - 1);
            selectedDate = date.toISOString().split('T')[0];
            if (dateInput) dateInput.value = selectedDate;
            updateDateDisplay();
            updateDateNavigationButtons();
            loadEntryForDate(selectedDate);
        });
    }
    
    if (dateNextBtn) {
        dateNextBtn.addEventListener('click', () => {
            const date = new Date(selectedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (date < today) {
                date.setDate(date.getDate() + 1);
                selectedDate = date.toISOString().split('T')[0];
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
    
    const date = new Date(selectedDate);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dateStr = `${date.getDate()} ${months[date.getMonth()]}`;
    if (date.getFullYear() !== today.getFullYear()) dateStr += ` ${date.getFullYear()}`;
    
    dateDisplay.textContent = dateStr;
}

/**
 * Обновление состояния кнопок навигации по датам
 */
function updateDateNavigationButtons() {
    const dateNextBtn = document.getElementById('date-next-btn');
    if (!dateNextBtn) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = new Date(selectedDate) >= today;
    
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
    
    if (sleepSlider && sleepDisplay) {
        // Обновление отображения при изменении
        sleepSlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            sleepDisplay.textContent = value === 1 ? '1 час' : value < 5 ? `${value} часа` : `${value} часов`;
        });
        
        // Инициализация начального значения
        const initialValue = parseFloat(sleepSlider.value);
        sleepDisplay.textContent = initialValue === 1 ? '1 час' : initialValue < 5 ? `${initialValue} часа` : `${initialValue} часов`;
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

function updateDayTypeUI(dt, explanation = null) {
    const dayTypeSection = document.getElementById('day-type-section');
    const display = document.getElementById('day-type-display');
    if (!dayTypeSection || !display) return;

    const colorClasses = [
        'bg-red-50','text-red-800','border-red-200',
        'bg-yellow-50','text-yellow-800','border-yellow-200',
        'bg-purple-50','text-purple-800','border-purple-200',
        'bg-green-50','text-green-800','border-green-200',
        'bg-gray-50','text-gray-700','border-gray-200'
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
        display.classList.add('bg-red-50','text-red-800','border-red-200');
    } else if (dt === 'hypomanic') {
        text = 'Тип дня: гипоманиакальный эпизод.';
        // Используем изображение для гипомании, с fallback на эмодзи
        icon = '<img src="/static/images/hypomanic-phase.png" alt="Гипоманиакальный эпизод" class="w-16 h-16 object-contain" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline\';"><span style="display:none; font-size: 1.5rem;">😳</span>';
        display.classList.add('bg-yellow-50','text-yellow-800','border-yellow-200');
    } else if (dt === 'mixed') {
        text = 'Тип дня: смешанный эпизод (есть и депрессивные, и гипоманиакальные симптомы).';
        // Используем изображение для смешанного эпизода, с fallback на эмодзи
        icon = '<img src="/static/images/mixed-phase.png" alt="Смешанный эпизод" class="w-8 h-8 object-contain" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline\';"><span style="display:none; font-size: 1.5rem;">♻️</span>';
        display.classList.add('bg-purple-50','text-purple-800','border-purple-200');
    } else {
        // normal или что-то по умолчанию
        text = 'Тип дня: нормальный день (без выраженного эпизода).';
        icon = '🙂';
        display.classList.add('bg-green-50','text-green-800','border-green-200');
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
 * Загрузка записи за конкретную дату
 */
async function loadEntryForDate(dateStr) {
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
    } catch (e) {
        console.error('Ошибка предварительной очистки при смене даты:', e);
    }

    try {
        const response = await fetch(`/get_entry/${dateStr}`);
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
            document.getElementById('notes').value = '';
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

        // Заметки
        document.getElementById('notes').value = entry.notes || '';

        // Обновляем блок типа дня по данным записи (если сервер уже рассчитал)
        updateDayTypeUI(entry.day_type);

        // Лекарства
        resetMedicationsSelection();
        if (data.medications) {
            Object.entries(data.medications).forEach(([medId, taken]) => {
                const checkbox = document.querySelector(`input[name="medication_check_${medId}"]`);
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
                setCustomStateBinary(state.id, 'no');
                break;
            case 'categorical':
                setCustomStateCategorical(state.id, 'none');
                break;
            case 'numeric':
                const numInput = document.getElementById(`custom_state_num_${state.id}`);
                if (numInput) numInput.value = '5';
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

    if (medications.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Нет добавленных лекарств</p>';
        return;
    }

    container.innerHTML = medications.map(med => {
        const dosageText = med.dosage_mg ? `${med.dosage_mg} мг` : '';
        const timeText = med.time_of_day ? TIME_OF_DAY_LABELS[med.time_of_day] : '';
        const frequencyText = med.frequency ? FREQUENCY_LABELS[med.frequency] : '';
        
        const infoParts = [dosageText, timeText, frequencyText].filter(Boolean);
        const infoText = infoParts.length > 0 ? ` (${infoParts.join(', ')})` : '';
        
        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-md mb-2">
                <div class="flex items-center space-x-3 flex-1">
                    <input type="checkbox" id="medication_check_${med.id}" name="medication_check_${med.id}" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                    <label for="medication_check_${med.id}" class="text-sm font-medium text-gray-700 flex-1">
                        ${med.name}${infoText}
                    </label>
                </div>
                <div class="flex items-center gap-1 ml-2">
                    <button type="button" onclick="editMedication(${med.id})" class="text-indigo-600 hover:text-indigo-500 text-sm" title="Редактировать">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button type="button" onclick="deleteMedication(${med.id})" class="text-red-500 hover:text-red-600 text-sm" title="Удалить">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-4 0a1 1 0 00-1 1v1h6V4a1 1 0 00-1-1m-4 0h4"></path>
                        </svg>
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

    if (customStates.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Нет добавленных состояний</p>';
        return;
    }

    container.innerHTML = customStates.map(state => {
        let inputHtml = '';
        
        switch (state.mark_type) {
            case 'binary':
                inputHtml = `
                    <div class="flex gap-2" id="custom_state_binary_${state.id}">
                        <button type="button" data-custom-binary="${state.id}" data-value="no" class="custom-binary-btn px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors active">Нет</button>
                        <button type="button" data-custom-binary="${state.id}" data-value="yes" class="custom-binary-btn px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">Да</button>
                    </div>
                    <input type="hidden" id="custom_state_binary_input_${state.id}" name="custom_state_${state.id}" value="no">
                `;
                break;
            case 'categorical':
                inputHtml = `
                    <div class="grid grid-cols-4 gap-2" id="custom_state_cat_${state.id}" data-custom-cat="${state.id}">
                        <button type="button" data-value="none" class="custom-cat-btn px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors active">Нет</button>
                        <button type="button" data-value="mild" class="custom-cat-btn px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">Лёгкое</button>
                        <button type="button" data-value="moderate" class="custom-cat-btn px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">Умеренное</button>
                        <button type="button" data-value="severe" class="custom-cat-btn px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">Тяжёлое</button>
                    </div>
                    <input type="hidden" id="custom_state_cat_input_${state.id}" name="custom_state_${state.id}" value="none">
                `;
                break;
            case 'numeric':
                inputHtml = `
                    <div class="flex items-center gap-4">
                        <input type="range" id="custom_state_num_${state.id}" name="custom_state_${state.id}" 
                               min="0" max="10" value="5" 
                               class="flex-1">
                        <span id="custom_state_num_value_${state.id}" class="text-sm font-medium text-gray-700 w-8">5</span>
                    </div>
                `;
                break;
            case 'multi_checkbox':
                const options = Array.isArray(state.options) ? state.options : [];
                if (options.length === 0) {
                    inputHtml = `
                        <p class="text-xs text-gray-500">Для этого состояния ещё не заданы варианты чекбоксов.</p>
                    `;
                } else {
                    const optionsHtml = options.map(optionLabel => `
                        <label class="flex items-center text-sm text-gray-700">
                            <input type="checkbox" name="custom_state_${state.id}" value="${optionLabel}">
                            <span>${optionLabel}</span>
                        </label>
                    `).join('');
                    inputHtml = `
                        <div class="flex flex-wrap gap-2 custom-state-multi-checkbox" id="custom_state_multi_${state.id}">
                            ${optionsHtml}
                        </div>
                    `;
                }
                break;
        }
        
        return `
            <div class="mb-4" id="custom_state_${state.id}">
                <p class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span>${state.name}</span>
                    <button 
                        type="button" 
                        onclick="editCustomState(${state.id})" 
                        class="text-xs text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
                        title="Редактировать"
                    >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button 
                        type="button" 
                        onclick="deleteCustomState(${state.id})" 
                        class="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                        title="Удалить"
                    >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-4 0a1 1 0 00-1 1v1h6V4a1 1 0 00-1-1m-4 0h4"></path>
                        </svg>
                    </button>
                </p>
                ${inputHtml}
            </div>
        `;
    }).join('');

    // Инициализация обработчиков для пользовательских состояний
    initializeCustomStateHandlers();
}

/**
 * Инициализация обработчиков для пользовательских состояний
 */
function initializeCustomStateHandlers() {
    // Бинарные кнопки
    document.querySelectorAll('[data-custom-binary]').forEach(btn => {
        btn.addEventListener('click', () => {
            const stateId = btn.getAttribute('data-custom-binary');
            const value = btn.getAttribute('data-value');

            const isAlreadyActive = btn.classList.contains('active');

            // Toggle off
            if (isAlreadyActive) {
                setCustomStateBinary(stateId, '');
                return;
            }

            setCustomStateBinary(stateId, value);
        });
    });
    
    // Категориальные кнопки
    document.querySelectorAll('[data-custom-cat]').forEach(group => {
        const stateId = group.getAttribute('data-custom-cat');
        const buttons = group.querySelectorAll('.custom-cat-btn');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.getAttribute('data-value');

                const isAlreadyActive = btn.classList.contains('active');

                // Toggle off
                if (isAlreadyActive) {
                    setCustomStateCategorical(stateId, '');
                    return;
                }

                setCustomStateCategorical(stateId, value);
            });
        });
    });
    
    // Числовые ползунки
    document.querySelectorAll('[id^="custom_state_num_"]').forEach(slider => {
        const stateId = slider.id.replace('custom_state_num_', '');
        const valueDisplay = document.getElementById(`custom_state_num_value_${stateId}`);
        
        slider.addEventListener('input', function() {
            if (valueDisplay) {
                valueDisplay.textContent = this.value;
            }
        });
    });
    
    // Множественные чекбоксы
    document.querySelectorAll('.custom-state-multi-checkbox input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const label = this.closest('label');
            if (label) {
                if (this.checked) {
                    label.classList.add('active');
                } else {
                    label.classList.remove('active');
                }
            }
        });
    });
}

function setCustomStateBinary(stateId, value) {
    const group = document.querySelectorAll(`[data-custom-binary="${stateId}"]`);
    const hiddenInput = document.getElementById(`custom_state_binary_input_${stateId}`);
    
    group.forEach(btn => {
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

function setCustomStateCategorical(stateId, value) {
    const group = document.querySelector(`[data-custom-cat="${stateId}"]`);
    if (!group) return;
    
    const buttons = group.querySelectorAll('.custom-cat-btn');
    const hiddenInput = document.getElementById(`custom_state_cat_input_${stateId}`);
    
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
 * Сохранение записи
 */
async function saveEntry(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    const depressive_state = formData.get('depressive_state') || 'none';
    const manic_state = formData.get('manic_state') || 'none';
    const irritable_state = formData.get('irritable_state') || 'none';
    const anxious_state = formData.get('anxious_state') || 'none';

    // Числовые прокси для обратной совместимости с аналитикой
    const data = {
        date: selectedDate,
        mood: STATE_SCORE[depressive_state] ?? 0,
        irritability: STATE_SCORE[irritable_state] ?? 0,
        anxiety: STATE_SCORE[anxious_state] ?? 0,
        energy: STATE_SCORE[manic_state] ?? 5,
        sleep_hours: parseFloat(formData.get('sleep_hours')),
        sleep_quality: formData.get('sleep_quality'),
        notes: formData.get('notes'),
        medications: {},
        custom_values: {},
        custom_state_values: {},
        depressive_state,
        manic_state,
        irritable_state,
        anxious_state,
        psychotic_symptoms: formData.get('psychotic_symptoms') === 'yes',
        psychotherapy: formData.get('psychotherapy') === 'yes'
    };
    
    // Лекарства (теперь просто да/нет)
    medications.forEach(med => {
        const isChecked = formData.get(`medication_check_${med.id}`) !== null;
        data.medications[med.id] = isChecked;
    });
    
    
    // Пользовательские состояния
    customStates.forEach(state => {
        let value = null;
        
        switch (state.mark_type) {
            case 'binary':
                value = formData.get(`custom_state_${state.id}`);
                break;
            case 'categorical':
                value = formData.get(`custom_state_${state.id}`);
                break;
            case 'numeric':
                value = formData.get(`custom_state_${state.id}`);
                break;
            case 'multi_checkbox':
                const checkboxes = document.querySelectorAll(`input[name="custom_state_${state.id}"]:checked`);
                value = Array.from(checkboxes).map(cb => cb.value).join(',');
                break;
        }
        
        if (value !== null && value !== '') {
            data.custom_state_values[state.id] = value;
        }
    });
    
    try {
        const response = await fetch('/save_entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            StabilUtils.showMessage('Запись сохранена успешно!', 'success');

            // Обновляем блок типа дня по ответу сервера (если он есть)
            updateDayTypeUI(result.day_type, result.day_type_explanation);
        } else {
            StabilUtils.showMessage(result.message || 'Ошибка при сохранении записи', 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения записи:', error);
        StabilUtils.showMessage('Ошибка при сохранении записи', 'error');
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
    const med = medications.find(m => m.id === medId);
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
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            StabilUtils.showMessage(editingMedicationId ? 'Лекарство обновлено' : 'Лекарство добавлено', 'success');
            closeAddMedicationModal();
            
            if (editingMedicationId) {
                const index = medications.findIndex(m => m.id === editingMedicationId);
                if (index !== -1) {
                    medications[index] = result.medication;
                }
            } else {
                medications.push(result.medication);
            }
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
    const med = medications.find(m => m.id === medId);
    if (!med) return;

    const confirmed = window.confirm(`Удалить лекарство "${med.name}" и все отметки его приёма?`);
    if (!confirmed) return;

    try {
        const response = await fetch('/delete_medication', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ med_id: medId })
        });

        const result = await response.json();
        if (result.success) {
            medications = medications.filter(m => m.id !== medId);
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
    const state = customStates.find(s => s.id === stateId);
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
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            StabilUtils.showMessage(editingStateId ? 'Состояние обновлено' : 'Состояние добавлено', 'success');
            closeAddCustomStateModal();
            
            const updatedState = result.state;
            if (updatedState && updatedState.mark_type === 'multi_checkbox') {
                updatedState.options = Array.isArray(updatedState.options) ? updatedState.options : options;
            }
            
            if (editingStateId) {
                const index = customStates.findIndex(s => s.id === editingStateId);
                if (index !== -1) {
                    customStates[index] = updatedState;
                }
            } else {
                customStates.push(updatedState);
            }
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
    const state = customStates.find(s => s.id === stateId);
    if (!state) return;

    const confirmed = window.confirm(`Удалить состояние "${state.name}" и все его отметки в записях?`);
    if (!confirmed) return;

    try {
        const response = await fetch('/delete_custom_state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ state_id: stateId })
        });

        const result = await response.json();
        if (result.success) {
            customStates = customStates.filter(s => s.id !== stateId);
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

// Горячие клавиши для модалок
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (!document.getElementById('addMedicationModal').classList.contains('hidden')) {
            closeAddMedicationModal();
        }
        if (!document.getElementById('addCustomStateModal').classList.contains('hidden')) {
            closeAddCustomStateModal();
        }
    }
});
