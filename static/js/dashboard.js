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

/**
 * Функция для форматирования даты в YYYY-MM-DD в локальном времени
 */
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/df5b9261-cb83-488c-983b-e6808ea550f2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:setupEventListeners',message:'Range button clicked',data:{selectedRange:currentRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                console.log('Range button clicked:', currentRange);
                // #endregion
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
 * @param {string} lastEntryDate - Опциональная дата последней записи (для периода "7 дней")
 */
function getDateRange(lastEntryDate = null) {
    let endDate = new Date(today);
    
    // Для периода "7 дней" используем дату последней записи, если она указана
    if (currentRange === '7' && lastEntryDate) {
        // Создаем дату из строки YYYY-MM-DD в локальном времени
        const [year, month, day] = lastEntryDate.split('-').map(Number);
        endDate = new Date(year, month - 1, day);
    }
    
    let startDate = new Date(endDate);
    
    if (customRange) {
        return {
            start: customRange.start,
            end: customRange.end
        };
    }
    
    const days = parseInt(currentRange);
    startDate.setDate(startDate.getDate() - (days - 1));
    
    // #region agent log
    const result = {
        start: formatLocalDate(startDate),
        end: formatLocalDate(endDate)
    };
    const logData = {currentRange,lastEntryDate,customRange:!!customRange,startDate:formatLocalDate(startDate),endDate:formatLocalDate(endDate),today,result};
    fetch('http://127.0.0.1:7243/ingest/df5b9261-cb83-488c-983b-e6808ea550f2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:getDateRange',message:'Date range calculation',data:logData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch((e)=>{console.error('Log error:',e);});
    console.log('getDateRange:', logData);
    // #endregion
    
    return result;
}

/**
 * Загрузка данных дашборда
 * @param {boolean} isRetry - Флаг повторной загрузки (чтобы избежать бесконечного цикла)
 */
async function loadDashboardData(isRetry = false) {
    try {
        // Сначала загружаем данные с широким диапазоном, чтобы найти последнюю запись
        let dateRange = getDateRange();
        
        // #region agent log
        const initialLogData = {currentRange,isRetry,customRange:!!customRange,dateRange,isFirstLoad:!isRetry};
        fetch('http://127.0.0.1:7243/ingest/df5b9261-cb83-488c-983b-e6808ea550f2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:loadDashboardData',message:'Initial date range',data:initialLogData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch((e)=>{console.error('Log error:',e);});
        console.log('loadDashboardData - initial:', initialLogData);
        // #endregion
        
        // Если выбран период "7 дней" и это первая загрузка, сначала получаем последнюю дату записи
        const shouldSearchLastEntry = currentRange === '7' && !isRetry && !customRange;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/df5b9261-cb83-488c-983b-e6808ea550f2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:loadDashboardData',message:'Checking if should search last entry',data:{currentRange,isRetry,customRange:!!customRange,shouldSearchLastEntry},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch((e)=>{console.error('Log error:',e);});
        console.log('Should search last entry:', shouldSearchLastEntry, {currentRange, isRetry, customRange});
        // #endregion
        
        if (shouldSearchLastEntry) {
            // Загружаем данные за последние 30 дней, чтобы найти последнюю запись
            const tempEndDate = new Date(today);
            const tempStartDate = new Date(tempEndDate);
            tempStartDate.setDate(tempStartDate.getDate() - 29);
            
            const tempDateRange = {
                start: formatLocalDate(tempStartDate),
                end: formatLocalDate(tempEndDate)
            };
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/df5b9261-cb83-488c-983b-e6808ea550f2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:loadDashboardData',message:'Searching for last entry',data:{tempDateRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            const tempResponse = await fetch(
                `/get_dashboard_data?start_date=${tempDateRange.start}&end_date=${tempDateRange.end}`
            );
            
            // #region agent log
            console.log('tempResponse.ok:', tempResponse.ok, 'status:', tempResponse.status);
            // #endregion
            
            if (tempResponse.ok) {
                const tempData = await tempResponse.json();
                
                // #region agent log
                console.log('tempData:', {
                    success: tempData.success,
                    hasPhaseChartData: !!tempData.phase_chart_data,
                    phaseChartDataLength: tempData.phase_chart_data?.length || 0,
                    phaseChartData: tempData.phase_chart_data
                });
                // #endregion
                
                if (tempData.success && tempData.phase_chart_data && tempData.phase_chart_data.length > 0) {
                    // Находим последнюю дату записи
                    const lastEntryDate = tempData.phase_chart_data[tempData.phase_chart_data.length - 1].date;
                    
                    // #region agent log
                    console.log('Last entry found:', lastEntryDate, 'from', tempData.phase_chart_data.length, 'entries');
                    // #endregion
                    
                    // Пересчитываем диапазон на основе последней записи
                    dateRange = getDateRange(lastEntryDate);
                    
                    // #region agent log
                    console.log('Recalculated date range with last entry:', dateRange);
                    console.log('Date range details:', {
                        start: dateRange.start,
                        end: dateRange.end,
                        lastEntryDate: lastEntryDate,
                        expectedEnd: lastEntryDate,
                        matches: dateRange.end === lastEntryDate
                    });
                    // #endregion
                } else {
                    // #region agent log
                    console.log('No entries found or empty phase_chart_data');
                    // #endregion
                }
            } else {
                // #region agent log
                console.log('tempResponse not ok, status:', tempResponse.status);
                // #endregion
            }
        }
        
        // #region agent log
        console.log('Final dateRange for API call:', dateRange);
        console.log('API URL:', `/get_dashboard_data?start_date=${dateRange.start}&end_date=${dateRange.end}`);
        // #endregion
        
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
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/df5b9261-cb83-488c-983b-e6808ea550f2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:loadDashboardData',message:'Data loaded successfully',data:{finalDateRange:dateRange,dataEntriesCount:data.phase_chart_data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Обновление текущей фазы
        updateCurrentPhase(data.current_phase, dateRange.end, data.current_phase_explanation);
        
        // Обновление фазового чарта (возвращает эффективный диапазон данных)
        const effectiveDateRange = updatePhaseChart(data.phase_chart_data, dateRange);
        
        // Обновление чартов состояний
        updateStatesChart(data.chart_data, dateRange);
        
        // Обновление дашборда сна
        updateSleepDashboard(data.sleep_data || {}, dateRange);
        
        // Обновление отображения диапазона (показываем реальный диапазон данных)
        const finalDisplayRange = effectiveDateRange || dateRange;
        // #region agent log
        console.log('Updating date range display:', {
            effectiveDateRange,
            originalDateRange: dateRange,
            finalDisplayRange
        });
        // #endregion
        updateDateRangeDisplay(finalDisplayRange);
        
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
    
    // #region agent log
    console.log('updateDateRangeDisplay called with:', dateRange);
    // #endregion
    
    // Парсим даты из строк YYYY-MM-DD в локальном времени (не UTC)
    const [startYear, startMonth, startDay] = dateRange.start.split('-').map(Number);
    const [endYear, endMonth, endDay] = dateRange.end.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    // #region agent log
    console.log('Parsed dates:', {
        start: start.toISOString(),
        end: end.toISOString(),
        startLocal: formatLocalDate(start),
        endLocal: formatLocalDate(end)
    });
    // #endregion
    
    // Форматируем даты красиво
    const startFormatted = start.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    const endFormatted = end.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    // #region agent log
    console.log('Formatted dates for display:', {
        startFormatted,
        endFormatted,
        startDate: start,
        endDate: end,
        startGetDate: start.getDate(),
        endGetDate: end.getDate(),
        startGetMonth: start.getMonth(),
        endGetMonth: end.getMonth(),
        startGetFullYear: start.getFullYear(),
        endGetFullYear: end.getFullYear()
    });
    // #endregion
    
    // Сохраняем текущий диапазон для использования в модальном окне
    displayEl.dataset.startDate = dateRange.start;
    displayEl.dataset.endDate = dateRange.end;
    
    // Украшаем отображение с иконками и стилями, делаем кликабельным
    displayEl.innerHTML = `
        <div class="flex items-center gap-2 text-gray-700 dark:text-gray-200 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" id="date-range-clickable">
            <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span class="font-medium text-gray-900 dark:text-gray-100">${startFormatted}</span>
            <span class="text-gray-400 dark:text-gray-500">—</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">${endFormatted}</span>
        </div>
    `;
    
    // #region agent log
    console.log('Display element innerHTML set. Current display text:', displayEl.textContent);
    // #endregion
    
    // Добавляем обработчик клика для открытия модального окна выбора дат
    const clickableElement = document.getElementById('date-range-clickable');
    if (clickableElement) {
        clickableElement.addEventListener('click', () => {
            // Используем текущий эффективный диапазон при открытии модального окна
            const displayEl = document.getElementById('date-range-display');
            if (displayEl && displayEl.dataset.startDate && displayEl.dataset.endDate) {
                // Используем текущий диапазон для модального окна
                const tempRange = {
                    start: displayEl.dataset.startDate,
                    end: displayEl.dataset.endDate
                };
                showCustomRangeModalWithRange(tempRange);
            } else {
                showCustomRangeModal();
            }
        });
    }
}

/**
 * Показать модальное окно для произвольного диапазона с предустановленным диапазоном
 */
function showCustomRangeModalWithRange(dateRange) {
    const modal = document.getElementById('custom-range-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Устанавливаем значения из переданного диапазона
        document.getElementById('custom-start-date').value = dateRange.start;
        document.getElementById('custom-end-date').value = dateRange.end;
    }
}

/**
 * Интерполяция пропусков в данных графика
 * Заполняет пропуски плавным переходом, если есть точки до и после
 */
function interpolateGaps(data, allDays) {
    const interpolated = [...data];
    
    for (let i = 0; i < interpolated.length; i++) {
        // Если текущая точка - пропуск (null)
        if (interpolated[i] === null) {
            // Ищем ближайшую точку до пропуска
            let prevIndex = -1;
            for (let j = i - 1; j >= 0; j--) {
                if (interpolated[j] !== null) {
                    prevIndex = j;
                    break;
                }
            }
            
            // Ищем ближайшую точку после пропуска
            let nextIndex = -1;
            for (let j = i + 1; j < interpolated.length; j++) {
                if (interpolated[j] !== null) {
                    nextIndex = j;
                    break;
                }
            }
            
            // Если есть точки до и после - интерполируем
            if (prevIndex !== -1 && nextIndex !== -1) {
                const prevValue = interpolated[prevIndex];
                const nextValue = interpolated[nextIndex];
                const gapLength = nextIndex - prevIndex;
                const positionInGap = i - prevIndex;
                
                // Линейная интерполяция
                const interpolatedValue = prevValue + (nextValue - prevValue) * (positionInGap / gapLength);
                interpolated[i] = interpolatedValue;
            }
            // Если нет точки до или после - оставляем null (не интерполируем)
        }
    }
    
    return interpolated;
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
    
    // Находим первую и последнюю дату с данными для аккуратного обрезания обрывов
    // НО только если диапазон большой (больше 7 дней), чтобы не обрезать короткие периоды
    let firstDataDate = null;
    let lastDataDate = null;
    
    // Вычисляем длину исходного диапазона
    const originalDaysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const shouldTrimRange = originalDaysCount > 7; // Обрезаем только для периодов больше недели
    
    if (phaseData.length > 0 && shouldTrimRange) {
        // Сортируем даты для поиска первой и последней
        const sortedDates = phaseData.map(item => item.date).sort();
        firstDataDate = sortedDates[0];
        lastDataDate = sortedDates[sortedDates.length - 1];
    }
    
    // Если есть данные и нужно обрезать, обрезаем диапазон до первой и последней записи
    // Это уберет обрывы в начале и конце графика для длинных периодов
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;
    
    if (firstDataDate && lastDataDate && shouldTrimRange) {
        // Создаем даты из строк YYYY-MM-DD в локальном времени (не UTC)
        const [startYear, startMonth, startDay] = firstDataDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = lastDataDate.split('-').map(Number);
        effectiveStartDate = new Date(startYear, startMonth - 1, startDay);
        effectiveEndDate = new Date(endYear, endMonth - 1, endDay);
        
        // Устанавливаем время на начало/конец дня для корректного сравнения
        effectiveStartDate.setHours(0, 0, 0, 0);
        effectiveEndDate.setHours(23, 59, 59, 999);
    }
    
    // Функция для форматирования даты в YYYY-MM-DD в локальном времени
    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // Сохраняем эффективный диапазон для отображения
    const effectiveRange = {
        start: formatLocalDate(effectiveStartDate),
        end: formatLocalDate(effectiveEndDate)
    };
    
    // Генерируем все дни в эффективном диапазоне
    // Используем локальные даты напрямую, без конвертации через toISOString
    const currentDate = new Date(effectiveStartDate);
    currentDate.setHours(0, 0, 0, 0);
    // Для включения последнего дня добавляем 1 день к конечной дате
    const endDateForLoop = new Date(effectiveEndDate);
    endDateForLoop.setHours(0, 0, 0, 0);
    endDateForLoop.setDate(endDateForLoop.getDate() + 1); // Добавляем 1 день для включения последнего дня
    
    while (currentDate < endDateForLoop) { // Используем < вместо <=, так как endDateForLoop уже на день вперед
        const dateStr = formatLocalDate(currentDate);
        allDays.push({
            date: dateStr,
            phase: phaseMap[dateStr] || null
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Если нет данных вообще, показываем пустой график
    if (allDays.length === 0) {
        if (phaseChart) {
            phaseChart.destroy();
            phaseChart = null;
        }
        // Возвращаем исходный диапазон, если нет данных
        return dateRange;
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
    let data = allDays.map(day => phaseValues[day.phase || 'null']);
    const originalPhases = allDays.map(day => day.phase); // Сохраняем оригинальные фазы для определения интерполированных точек
    const pointColors = allDays.map(day => phaseColors[day.phase || 'null']);
    const pointBorderColors = allDays.map(day => phaseColors[day.phase || 'null']);
    
    // Интерполируем пропуски, если есть точки до и после
    data = interpolateGaps(data, allDays);
    
    // Вычисляем количество дней для определения стратегии отображения точек
    const daysCount = allDays.length;
    const isLongRange = daysCount > 60; // Больше 2 месяцев - считаем длинным диапазоном
    
    // Создаем массив радиусов точек: для длинных диапазонов скрываем все точки
    const pointRadii = allDays.map((day, index) => {
        const originalPhase = originalPhases[index];
        if (!originalPhase) {
            return 0; // 0 для пропусков и интерполированных
        }
        // Для длинных диапазонов скрываем все точки (показываются только при hover)
        // Для коротких диапазонов показываем все точки
        return isLongRange ? 0 : 5;
    });
    
    const basePointHoverRadius = isLongRange ? 6 : 7;
    
    // Кастомный плагин для горизонтальных линий с подписями фаз
    const phaseLinesPlugin = {
        id: 'phaseLines',
        afterDraw: (chart) => {
            const ctx = chart.ctx;
            const yScale = chart.scales.y;
            const chartArea = chart.chartArea;
            
            // Определяем фазы и их уровни
            const phases = [
                { value: 1, label: 'Смешанная', color: 'rgba(168, 85, 247, 0.6)' },
                { value: 2, label: 'Депрессия', color: 'rgba(239, 68, 68, 0.6)' },
                { value: 3, label: 'Норма', color: 'rgba(34, 197, 94, 0.6)' },
                { value: 4, label: 'Гипомания', color: 'rgba(234, 179, 8, 0.6)' }
            ];
            
            phases.forEach(phase => {
                const y = yScale.getPixelForValue(phase.value);
                
                // Рисуем горизонтальную линию
                ctx.save();
                ctx.strokeStyle = phase.color;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(chartArea.left, y);
                ctx.lineTo(chartArea.right, y);
                ctx.stroke();
                ctx.restore();
                
                // Рисуем подпись фазы слева
                ctx.save();
                ctx.fillStyle = phase.color.replace('0.6', '0.9');
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                
                // Рисуем фон для текста
                const textMetrics = ctx.measureText(phase.label);
                const textWidth = textMetrics.width;
                const textHeight = 16;
                const padding = 6;
                
                ctx.fillStyle = phase.color.replace('0.6', '0.85');
                ctx.fillRect(
                    chartArea.left + 5,
                    y - textHeight / 2,
                    textWidth + padding * 2,
                    textHeight
                );
                
                // Рисуем текст
                ctx.fillStyle = 'white';
                ctx.fillText(phase.label, chartArea.left + 5 + padding, y);
                ctx.restore();
            });
        }
    };
    
    if (phaseChart) {
        phaseChart.destroy();
    }
    
    // Получаем цвета для текущей темы
    const chartColors = window.ThemeManager && window.ThemeManager.getChartThemeOptions 
        ? window.ThemeManager.getChartThemeOptions() 
        : { text: '#374151', grid: '#E5E7EB', border: '#D1D5DB' };
    
    phaseChart = new Chart(ctx, {
        type: 'line',
        plugins: [phaseLinesPlugin],
        data: {
            labels: labels,
            datasets: [{
                label: 'Фаза',
                data: data,
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                pointBackgroundColor: pointColors,
                pointBorderColor: pointBorderColors,
                pointBorderWidth: 3,
                pointRadius: pointRadii, // Используем массив радиусов вместо функции
                pointHoverRadius: basePointHoverRadius + 2,
                borderWidth: 3,
                fill: true,
                tension: 0.3, // Меньше сглаживания для более выраженных изменений
                spanGaps: true // Соединять точки через интерполированные пропуски
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
                            size: 12,
                            weight: 'bold'
                        },
                        color: chartColors.text
                    },
                    grid: {
                        color: chartColors.grid,
                        lineWidth: 1
                    },
                    border: {
                        color: chartColors.border
                    },
                    title: {
                        display: true,
                        text: 'Фаза',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: chartColors.text
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        color: chartColors.text
                    },
                    border: {
                        color: chartColors.border
                    }
                }
            }
        }
    });
    
    // Возвращаем эффективный диапазон для отображения
    return effectiveRange;
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
    
    // Вычисляем длину исходного диапазона
    const originalDaysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const shouldTrimRange = originalDaysCount > 7; // Обрезаем только для периодов больше недели
    
    // Находим первую и последнюю дату с данными для аккуратного обрезания обрывов
    let firstDataDate = null;
    let lastDataDate = null;
    
    if (chartData.dates && chartData.dates.length > 0 && shouldTrimRange) {
        const sortedDates = [...chartData.dates].sort();
        firstDataDate = sortedDates[0];
        lastDataDate = sortedDates[sortedDates.length - 1];
    }
    
    // Если есть данные и нужно обрезать, обрезаем диапазон до первой и последней записи
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;
    
    if (firstDataDate && lastDataDate && shouldTrimRange) {
        // Создаем даты из строк YYYY-MM-DD в локальном времени (не UTC)
        const [startYear, startMonth, startDay] = firstDataDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = lastDataDate.split('-').map(Number);
        effectiveStartDate = new Date(startYear, startMonth - 1, startDay);
        effectiveEndDate = new Date(endYear, endMonth - 1, endDay);
        effectiveStartDate.setHours(0, 0, 0, 0);
        effectiveEndDate.setHours(23, 59, 59, 999);
    }
    
    // Генерируем все дни в эффективном диапазоне
    // Используем локальные даты напрямую, без конвертации через toISOString
    const currentDate = new Date(effectiveStartDate);
    currentDate.setHours(0, 0, 0, 0);
    // Для включения последнего дня добавляем 1 день к конечной дате
    const endDateForLoop = new Date(effectiveEndDate);
    endDateForLoop.setHours(0, 0, 0, 0);
    endDateForLoop.setDate(endDateForLoop.getDate() + 1); // Добавляем 1 день для включения последнего дня
    
    // Функция для форматирования даты в YYYY-MM-DD в локальном времени
    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    while (currentDate < endDateForLoop) { // Используем < вместо <=, так как endDateForLoop уже на день вперед
        const dateStr = formatLocalDate(currentDate);
        allDays.push({
            date: dateStr,
            data: dataMap[dateStr] || null
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Если нет данных вообще, показываем пустой график
    if (allDays.length === 0) {
        if (statesChart) {
            statesChart.destroy();
            statesChart = null;
        }
        return;
    }
    
    const labels = allDays.map(day => {
        const d = new Date(day.date);
        return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
    });
    
    // Преобразуем данные и интерполируем пропуски
    let moodData = allDays.map(day => day.data ? day.data.mood : null);
    let energyData = allDays.map(day => day.data ? day.data.energy : null);
    let irritabilityData = allDays.map(day => day.data ? day.data.irritability : null);
    let anxietyData = allDays.map(day => day.data ? day.data.anxiety : null);
    
    // Интерполируем пропуски для каждого набора данных
    moodData = interpolateGaps(moodData, allDays);
    energyData = interpolateGaps(energyData, allDays);
    irritabilityData = interpolateGaps(irritabilityData, allDays);
    anxietyData = interpolateGaps(anxietyData, allDays);
    
    // Вычисляем количество дней для определения стратегии отображения точек
    const daysCount = allDays.length;
    const isLongRange = daysCount > 60; // Больше 2 месяцев - считаем длинным диапазоном
    
    // Создаем массивы радиусов точек: для длинных диапазонов скрываем все точки
    const createPointRadii = (dataArray) => {
        return dataArray.map((value) => {
            if (value === null || value === undefined) {
                return 0; // 0 для пропусков
            }
            return isLongRange ? 0 : 4; // Скрываем при длинных диапазонах
        });
    };
    
    const moodPointRadii = createPointRadii(moodData);
    const energyPointRadii = createPointRadii(energyData);
    const irritabilityPointRadii = createPointRadii(irritabilityData);
    const anxietyPointRadii = createPointRadii(anxietyData);
    const pointHoverRadius = isLongRange ? 6 : 7;
    
    if (statesChart) {
        statesChart.destroy();
    }
    
    // Получаем цвета для текущей темы
    const chartColors = window.ThemeManager && window.ThemeManager.getChartThemeOptions 
        ? window.ThemeManager.getChartThemeOptions() 
        : { text: '#374151', grid: '#E5E7EB', border: '#D1D5DB' };
    
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
                    pointRadius: moodPointRadii,
                    pointHoverRadius: pointHoverRadius,
                    tension: 0.4,
                    fill: true,
                    spanGaps: true
                },
                {
                    label: 'Энергия',
                    data: energyData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    pointRadius: energyPointRadii,
                    pointHoverRadius: pointHoverRadius,
                    tension: 0.4,
                    fill: true,
                    spanGaps: true
                },
                {
                    label: 'Раздражительность',
                    data: irritabilityData,
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    pointRadius: irritabilityPointRadii,
                    pointHoverRadius: pointHoverRadius,
                    tension: 0.4,
                    fill: true,
                    spanGaps: true
                },
                {
                    label: 'Тревога',
                    data: anxietyData,
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    pointRadius: anxietyPointRadii,
                    pointHoverRadius: pointHoverRadius,
                    tension: 0.4,
                    fill: true,
                    spanGaps: true
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
                    labels: {
                        color: chartColors.text
                    }
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
                        stepSize: 1,
                        color: chartColors.text
                    },
                    grid: {
                        color: chartColors.grid
                    },
                    border: {
                        color: chartColors.border
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        color: chartColors.text
                    },
                    border: {
                        color: chartColors.border
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
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">Нет записей за выбранный период</p>';
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
            <div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-150">
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${formattedDate}</div>
                    ${entry.notes ? `<div class="text-sm text-gray-500 dark:text-gray-300 mt-1">${entry.notes}</div>` : ''}
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
            statsContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center col-span-full py-4">Нет данных о сне</p>';
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
    
    // Вычисляем длину исходного диапазона
    const originalDaysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const shouldTrimRange = originalDaysCount > 7; // Обрезаем только для периодов больше недели
    
    // Находим первую и последнюю дату с данными для аккуратного обрезания обрывов
    let firstDataDate = null;
    let lastDataDate = null;
    
    if (sleepData.dates && sleepData.dates.length > 0 && shouldTrimRange) {
        const sortedDates = [...sleepData.dates].sort();
        firstDataDate = sortedDates[0];
        lastDataDate = sortedDates[sortedDates.length - 1];
    }
    
    // Если есть данные и нужно обрезать, обрезаем диапазон до первой и последней записи
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;
    
    if (firstDataDate && lastDataDate && shouldTrimRange) {
        // Создаем даты из строк YYYY-MM-DD в локальном времени (не UTC)
        const [startYear, startMonth, startDay] = firstDataDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = lastDataDate.split('-').map(Number);
        effectiveStartDate = new Date(startYear, startMonth - 1, startDay);
        effectiveEndDate = new Date(endYear, endMonth - 1, endDay);
        effectiveStartDate.setHours(0, 0, 0, 0);
        effectiveEndDate.setHours(23, 59, 59, 999);
    }
    
    // Генерируем все дни в эффективном диапазоне
    // Используем локальные даты напрямую, без конвертации через toISOString
    const currentDate = new Date(effectiveStartDate);
    currentDate.setHours(0, 0, 0, 0);
    // Для включения последнего дня добавляем 1 день к конечной дате
    const endDateForLoop = new Date(effectiveEndDate);
    endDateForLoop.setHours(0, 0, 0, 0);
    endDateForLoop.setDate(endDateForLoop.getDate() + 1); // Добавляем 1 день для включения последнего дня
    
    // Функция для форматирования даты в YYYY-MM-DD в локальном времени
    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    while (currentDate < endDateForLoop) { // Используем < вместо <=, так как endDateForLoop уже на день вперед
        const dateStr = formatLocalDate(currentDate);
        allDays.push({
            date: dateStr,
            hours: sleepMap[dateStr] || null
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Если нет данных вообще, показываем пустой график
    if (allDays.length === 0) {
        if (sleepChart) {
            sleepChart.destroy();
            sleepChart = null;
        }
        return;
    }
    
    // График часов сна
    const labels = allDays.map(day => {
        const d = new Date(day.date);
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    });
    
    // Преобразуем данные и интерполируем пропуски
    let hoursData = allDays.map(day => day.hours);
    hoursData = interpolateGaps(hoursData, allDays);
    
    // Вычисляем количество дней для определения стратегии отображения точек
    const daysCount = allDays.length;
    const isLongRange = daysCount > 60; // Больше 2 месяцев - считаем длинным диапазоном
    
    // Создаем массив радиусов точек: для длинных диапазонов скрываем все точки
    const hoursPointRadii = hoursData.map((value) => {
        if (value === null || value === undefined) {
            return 0; // 0 для пропусков
        }
        return isLongRange ? 0 : 4; // Скрываем при длинных диапазонах
    });
    const pointHoverRadius = isLongRange ? 6 : 7;
    
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
                pointRadius: hoursPointRadii,
                pointHoverRadius: pointHoverRadius,
                fill: true,
                tension: 0.4,
                spanGaps: true
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
