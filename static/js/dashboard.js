/**
 * JavaScript для страницы дашборда
 */

// Глобальные переменные
let phaseChart = null;
let statesChart = null;
let sleepChart = null;
let currentRange = '7'; // По умолчанию 7 дней
let customRange = null; // {start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'} или null
let today = window.today || new Date().toISOString().split('T')[0];
let currentPhaseExplanation = null; // Объяснение текущей фазы

// Безопасное приведение к числу
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

/**
 * Инициализация дашборда
 */
async function initializeDashboard() {
    try {
        // Установка максимальной даты для календарей
        const todayDate = new Date(today);
        const maxDate = todayDate.toISOString().split('T')[0];
        document.getElementById('custom-start-date')?.setAttribute('max', maxDate);
        document.getElementById('custom-end-date')?.setAttribute('max', maxDate);
        
        // Инициализация кнопок диапазонов
        updateRangeButtons();
        
        // Инициализация объяснения фазы из серверных данных (если есть)
        if (window.currentPhaseExplanation) {
            currentPhaseExplanation = window.currentPhaseExplanation;
            const infoBtn = document.getElementById('current-phase-info-btn');
            if (infoBtn && currentPhaseExplanation && currentPhaseExplanation.length > 0) {
                infoBtn.classList.remove('hidden');
            }
        }
        
        // Загрузка данных за последние 7 дней
        await loadDashboardData();
        
        // Настройка обработчиков событий
        setupEventListeners();
        
    } catch (error) {
        console.error('Ошибка инициализации дашборда:', error);
        StabilUtils.showMessage('Ошибка загрузки данных дашборда', 'error');
    }
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Переключатели диапазонов
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.id === 'custom-range-btn') {
                showCustomRangeModal();
            } else {
                currentRange = this.getAttribute('data-range');
                customRange = null;
                updateRangeButtons();
                loadDashboardData();
            }
        });
    });
    
    // Модальное окно для произвольного диапазона
    document.getElementById('cancel-custom-range')?.addEventListener('click', hideCustomRangeModal);
    document.getElementById('apply-custom-range')?.addEventListener('click', applyCustomRange);
    
    // Переключение чартов состояний
    document.getElementById('toggle-states-chart')?.addEventListener('click', toggleStatesChart);
    
    // Переключение чартов сна
    document.getElementById('toggle-sleep-chart')?.addEventListener('click', toggleSleepChart);
    
    // Кнопка объяснения текущей фазы
    document.getElementById('current-phase-info-btn')?.addEventListener('click', showCurrentPhaseExplanation);
}

/**
 * Показать модальное окно для произвольного диапазона
 */
function showCustomRangeModal() {
    const modal = document.getElementById('custom-range-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Установка значений, если уже выбран произвольный диапазон
        if (customRange) {
            document.getElementById('custom-start-date').value = customRange.start;
            document.getElementById('custom-end-date').value = customRange.end;
        } else {
            // По умолчанию последние 7 дней
            const endDate = new Date(today);
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            document.getElementById('custom-end-date').value = endDate.toISOString().split('T')[0];
            document.getElementById('custom-start-date').value = startDate.toISOString().split('T')[0];
        }
    }
}

/**
 * Скрыть модальное окно для произвольного диапазона
 */
function hideCustomRangeModal() {
    const modal = document.getElementById('custom-range-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Применить произвольный диапазон
 */
function applyCustomRange() {
    const startDate = document.getElementById('custom-start-date').value;
    const endDate = document.getElementById('custom-end-date').value;
    
    if (!startDate || !endDate) {
        StabilUtils.showMessage('Выберите обе даты', 'error');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        StabilUtils.showMessage('Начальная дата должна быть раньше конечной', 'error');
        return;
    }
    
    if (new Date(startDate) > new Date(today) || new Date(endDate) > new Date(today)) {
        StabilUtils.showMessage('Нельзя выбирать будущие даты', 'error');
        return;
    }
    
    customRange = { start: startDate, end: endDate };
    currentRange = 'custom';
    updateRangeButtons();
    hideCustomRangeModal();
    loadDashboardData();
}

/**
 * Обновление состояния кнопок диапазонов
 */
function updateRangeButtons() {
    document.querySelectorAll('.range-btn').forEach(btn => {
        if (btn.id === 'custom-range-btn') {
            if (currentRange === 'custom') {
                btn.classList.remove('bg-gray-200', 'text-gray-700');
                btn.classList.add('bg-indigo-600', 'text-white');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700');
            }
        } else {
            const range = btn.getAttribute('data-range');
            if (currentRange === range) {
                btn.classList.remove('bg-gray-200', 'text-gray-700');
                btn.classList.add('bg-indigo-600', 'text-white');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700');
            }
        }
    });
}

/**
 * Получение дат для выбранного диапазона
 */
function getDateRange() {
    const endDate = new Date(today);
    let startDate = new Date(endDate);
    
    if (customRange) {
        return {
            start: customRange.start,
            end: customRange.end
        };
    }
    
    const days = parseInt(currentRange);
    startDate.setDate(startDate.getDate() - (days - 1));
    
    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}

/**
 * Загрузка данных дашборда
 */
async function loadDashboardData() {
    try {
        const dateRange = getDateRange();
        
        const response = await fetch(
            `/get_dashboard_data?start_date=${dateRange.start}&end_date=${dateRange.end}`
        );
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки данных');
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Ошибка загрузки данных');
        }
        
        // Обновление текущей фазы
        updateCurrentPhase(data.current_phase, dateRange.end, data.current_phase_explanation);
        
        // Обновление фазового чарта
        updatePhaseChart(data.phase_chart_data, dateRange);
        
        // Обновление чартов состояний
        updateStatesChart(data.chart_data, dateRange);
        
        // Обновление дашборда сна
        updateSleepDashboard(data.sleep_data || {}, dateRange);
        
        // Обновление отображения диапазона
        updateDateRangeDisplay(dateRange);
        
        // Загрузка последних записей
        loadRecentEntries(data.recent_entries || []);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        StabilUtils.showMessage('Ошибка загрузки данных', 'error');
    }
}

/**
 * Обновление отображения текущей фазы
 */
function updateCurrentPhase(phase, date, explanation = null) {
    const labelEl = document.getElementById('current-phase-label');
    const dateEl = document.getElementById('current-phase-date');
    const infoBtn = document.getElementById('current-phase-info-btn');
    
    if (!labelEl) return;
    
    currentPhaseExplanation = explanation;
    
    const phaseLabels = {
        'depressive': { text: 'Депрессия', color: 'text-red-600' },
        'normal': { text: 'Норма', color: 'text-green-600' },
        'hypomanic': { text: 'Гипомания', color: 'text-yellow-600' },
        'mixed': { text: 'Смешанная', color: 'text-purple-600' }
    };
    
    const phaseInfo = phaseLabels[phase] || phaseLabels['normal'];
    labelEl.innerHTML = `<span class="${phaseInfo.color}">${phaseInfo.text}</span>`;
    
    if (dateEl) {
        const dateObj = new Date(date);
        dateEl.textContent = `Рассчитано на основе записи от ${dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    }
    
    // Всегда показываем кнопку, даже если объяснения нет
    if (infoBtn) {
        infoBtn.style.display = 'inline-block';
        infoBtn.style.opacity = '1';
        infoBtn.style.cursor = 'pointer';
    }
}

/**
 * Показать объяснение текущей фазы
 */
window.showCurrentPhaseExplanation = function() {
    // Если объяснения нет, создаем базовое объяснение на основе текущей фазы
    if (!currentPhaseExplanation || currentPhaseExplanation.length === 0) {
        const phaseLabel = document.getElementById('current-phase-label');
        if (phaseLabel) {
            const phaseText = phaseLabel.textContent.trim();
            currentPhaseExplanation = [`Фаза "${phaseText}" определена на основе последней записи. Для получения детального объяснения необходимо заполнить запись с указанием депрессивного и маниакального состояний.`];
        } else {
            StabilUtils.showMessage('Объяснение фазы недоступно', 'info');
            return;
        }
    }
    
    // Создаем модальное окно для объяснения
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'current-phase-explanation-modal';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-800">Почему определена эта фаза?</h3>
                    <button type="button" onclick="window.closeCurrentPhaseExplanation()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="space-y-2">
                    ${currentPhaseExplanation.map(exp => `
                        <div class="flex items-start gap-2 text-sm text-gray-700">
                            <span class="text-indigo-600 mt-0.5">•</span>
                            <span>${exp}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-6 flex justify-end">
                    <button type="button" onclick="window.closeCurrentPhaseExplanation()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition">
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
            window.closeCurrentPhaseExplanation();
        }
    });
}

/**
 * Закрыть модальное окно объяснения текущей фазы
 */
window.closeCurrentPhaseExplanation = function() {
    const modal = document.getElementById('current-phase-explanation-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Обновление отображения диапазона дат
 */
function updateDateRangeDisplay(dateRange) {
    const displayEl = document.getElementById('date-range-display');
    if (!displayEl) return;
    
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    
    displayEl.textContent = `${start.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })} - ${end.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}`;
}

/**
 * Обновление фазового чарта
 */
function updatePhaseChart(phaseData, dateRange) {
    const ctx = document.getElementById('phaseChart');
    if (!ctx) return;
    
    // Подготовка данных для всех дней в диапазоне
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const allDays = [];
    const phaseMap = {};
    
    // Создаем карту фаз по датам
    phaseData.forEach(item => {
        phaseMap[item.date] = item.phase;
    });
    
    // Генерируем все дни в диапазоне
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        allDays.push({
            date: dateStr,
            phase: phaseMap[dateStr] || null
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Числовые значения для фаз (от ада к эйфории)
    const phaseValues = {
        'mixed': 1,           // Самый низко (смешанное состояние)
        'depressive': 2,      // Низко (депрессия)
        'normal': 3,          // Средний уровень
        'hypomanic': 4,       // Высоко (эйфория)
        'null': null          // Нет данных
    };
    
    // Цвета для фаз
    const phaseColors = {
        'depressive': 'rgba(239, 68, 68, 1)',
        'normal': 'rgba(34, 197, 94, 1)',
        'hypomanic': 'rgba(234, 179, 8, 1)',
        'mixed': 'rgba(168, 85, 247, 1)',
        'null': 'rgba(229, 231, 235, 0.3)' // серый для дней без данных
    };
    
    // Подготовка данных для Chart.js
    const labels = allDays.map(day => {
        const d = new Date(day.date);
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    });
    
    // Преобразуем фазы в числовые значения для линейного графика
    const data = allDays.map(day => phaseValues[day.phase || 'null']);
    const pointColors = allDays.map(day => phaseColors[day.phase || 'null']);
    const pointBorderColors = allDays.map(day => phaseColors[day.phase || 'null']);
    
    if (phaseChart) {
        phaseChart.destroy();
    }
    
    phaseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Фаза',
                data: data,
                borderColor: 'rgba(99, 102, 241, 0.8)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                pointBackgroundColor: pointColors,
                pointBorderColor: pointBorderColors,
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                borderWidth: 2,
                fill: true,
                tension: 0.4, // Сглаживание линии
                spanGaps: false // Не соединять точки через пропуски
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const day = allDays[index];
                            const phaseLabels = {
                                'depressive': 'Депрессия',
                                'normal': 'Норма',
                                'hypomanic': 'Гипомания',
                                'mixed': 'Смешанная',
                                'null': 'Нет данных'
                            };
                            return phaseLabels[day.phase || 'null'] || 'Неизвестно';
                        },
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const day = allDays[index];
                            if (day.phase) {
                                const d = new Date(day.date);
                                return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 0.5,
                    max: 4.5,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            const phaseLabels = {
                                1: 'Смешанная',
                                2: 'Депрессия',
                                3: 'Норма',
                                4: 'Гипомания'
                            };
                            return phaseLabels[value] || '';
                        },
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

/**
 * Обновление чартов состояний
 */
function updateStatesChart(chartData, dateRange) {
    const ctx = document.getElementById('statesChart');
    if (!ctx) return;
    
    // Подготовка данных для всех дней в диапазоне
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const allDays = [];
    const dataMap = {};
    
    // Создаем карту данных по датам
    chartData.dates.forEach((date, index) => {
        dataMap[date] = {
            mood: chartData.mood[index],
            energy: chartData.energy[index],
            irritability: chartData.irritability[index],
            anxiety: chartData.anxiety[index]
        };
    });
    
    // Генерируем все дни в диапазоне
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        allDays.push({
            date: dateStr,
            data: dataMap[dateStr] || null
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const labels = allDays.map(day => {
        const d = new Date(day.date);
        return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
    });
    
    const moodData = allDays.map(day => day.data ? day.data.mood : null);
    const energyData = allDays.map(day => day.data ? day.data.energy : null);
    const irritabilityData = allDays.map(day => day.data ? day.data.irritability : null);
    const anxietyData = allDays.map(day => day.data ? day.data.anxiety : null);
    
    if (statesChart) {
        statesChart.destroy();
    }
    
    statesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Настроение',
                    data: moodData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.1,
                    fill: true,
                    spanGaps: false
                },
                {
                    label: 'Энергия',
                    data: energyData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1,
                    fill: true,
                    spanGaps: false
                },
                {
                    label: 'Раздражительность',
                    data: irritabilityData,
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.1,
                    fill: true,
                    spanGaps: false
                },
                {
                    label: 'Тревога',
                    data: anxietyData,
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.1,
                    fill: true,
                    spanGaps: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

/**
 * Переключение видимости чартов состояний
 */
function toggleStatesChart() {
    const container = document.getElementById('states-chart-container');
    const toggleText = document.getElementById('toggle-states-text');
    
    if (!container) return;
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (toggleText) toggleText.textContent = 'Свернуть';
    } else {
        container.classList.add('hidden');
        if (toggleText) toggleText.textContent = 'Развернуть';
    }
}

/**
 * Переключение видимости дашборда сна
 */
function toggleSleepChart() {
    const container = document.getElementById('sleep-chart-container');
    const toggleText = document.getElementById('toggle-sleep-text');
    
    if (!container) return;
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (toggleText) toggleText.textContent = 'Свернуть';
    } else {
        container.classList.add('hidden');
        if (toggleText) toggleText.textContent = 'Развернуть';
    }
}

/**
 * Загрузка последних записей
 */
function loadRecentEntries(entries) {
    const container = document.getElementById('recent-entries');
    if (!container) return;
    
    if (!entries || entries.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет записей за выбранный период</p>';
        return;
    }
    
    // Сортируем по дате (последние первыми) и берем первые 7
    const sortedEntries = [...entries]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 7);
    
    const phaseLabels = {
        'depressive': 'Депрессивный',
        'normal': 'Нормальный',
        'hypomanic': 'Гипоманический',
        'mixed': 'Смешанный'
    };
    
    container.innerHTML = sortedEntries.map(entry => {
        const date = new Date(entry.date);
        const formattedDate = date.toLocaleDateString('ru-RU', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short',
            year: 'numeric'
        });
        
        return `
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition duration-150">
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900">${formattedDate}</div>
                    ${entry.notes ? `<div class="text-sm text-gray-500 mt-1">${entry.notes}</div>` : ''}
                </div>
                <div class="ml-4">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${StabilUtils.getDayTypeColor(entry.phase)}">
                        ${phaseLabels[entry.phase] || entry.phase}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Обновление дашборда сна
 */
function updateSleepDashboard(sleepData, dateRange) {
    const statsContainer = document.getElementById('sleep-stats');
    const ctx = document.getElementById('sleepChart');
    
    if (!ctx || !sleepData.dates || sleepData.dates.length === 0) {
        if (statsContainer) {
            statsContainer.innerHTML = '<p class="text-gray-500 text-center col-span-full py-4">Нет данных о сне</p>';
        }
        if (sleepChart) {
            sleepChart.destroy();
            sleepChart = null;
        }
        return;
    }
    
    // Расчет статистики
    const hours = sleepData.hours.filter(h => h > 0);
    const avgHours = hours.length > 0 ? (hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1) : 0;
    const minHours = hours.length > 0 ? Math.min(...hours).toFixed(1) : 0;
    const maxHours = hours.length > 0 ? Math.max(...hours).toFixed(1) : 0;
    
    // Обновление статистики
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-sm text-gray-600 mb-1">Среднее</div>
                <div class="text-2xl font-bold text-blue-600">${avgHours} ч</div>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
                <div class="text-sm text-gray-600 mb-1">Минимум</div>
                <div class="text-2xl font-bold text-green-600">${minHours} ч</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
                <div class="text-sm text-gray-600 mb-1">Максимум</div>
                <div class="text-2xl font-bold text-purple-600">${maxHours} ч</div>
            </div>
        `;
    }
    
    // Подготовка данных для всех дней в диапазоне
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const allDays = [];
    const sleepMap = {};
    
    // Создаем карту данных по датам
    sleepData.dates.forEach((date, index) => {
        sleepMap[date] = sleepData.hours[index];
    });
    
    // Генерируем все дни в диапазоне
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        allDays.push({
            date: dateStr,
            hours: sleepMap[dateStr] || null
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // График часов сна
    const labels = allDays.map(day => {
        const d = new Date(day.date);
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    });
    
    const hoursData = allDays.map(day => day.hours);
    
    if (sleepChart) {
        sleepChart.destroy();
    }
    
    sleepChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Часы сна',
                data: hoursData,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: '#3B82F6',
                borderWidth: 2,
                pointBackgroundColor: '#3B82F6',
                pointBorderColor: '#3B82F6',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const date = new Date(sleepData.dates[context.dataIndex]);
                            return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}: ${context.parsed.y} ч`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value + ' ч';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}
