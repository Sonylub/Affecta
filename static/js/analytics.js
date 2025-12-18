/**
 * JavaScript для страницы аналитики
 */

// Глобальные переменные
let analyticsData = null;
let charts = {};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeAnalytics();
});

/**
 * Инициализация аналитики
 */
async function initializeAnalytics() {
    try {
        // Загрузка данных
        await loadAnalyticsData();
        
        // Инициализация графиков
        initializeCharts();
        
        // Обновление таблицы данных
        updateDataTable();
        
        // Настройка обработчиков событий
        setupEventListeners();
        
    } catch (error) {
        console.error('Ошибка инициализации аналитики:', error);
        StabilUtils.showMessage('Ошибка загрузки данных аналитики', 'error');
    }
}

/**
 * Загрузка данных аналитики
 */
async function loadAnalyticsData() {
    const period = document.getElementById('period-select').value;
    
    try {
        const response = await fetch(`/get_analytics_data?period=${period}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
                analyticsData = data.data;
                updateStatisticsCards();
            } else {
                throw new Error(data.message || 'Ошибка загрузки данных');
            }
        } else {
            throw new Error('Ошибка сети');
        }
    } catch (error) {
        console.error('Ошибка загрузки данных аналитики:', error);
        StabilUtils.showMessage('Ошибка загрузки данных аналитики', 'error');
    }
}

/**
 * Обновление карточек статистики
 */
function updateStatisticsCards() {
    const container = document.getElementById('statistics-cards');
    const data = analyticsData;
    
    if (!data || !data.dates || data.dates.length === 0) {
        container.innerHTML = `
            <div class="col-span-4 bg-white rounded-lg shadow-sm p-6 text-center">
                <p class="text-gray-500">Нет данных за выбранный период</p>
            </div>
        `;
        return;
    }
    
    // Вычисление статистик
    const totalEntries = data.dates.length;
    const avgMood = data.mood.reduce((a, b) => a + b, 0) / totalEntries;
    const avgEnergy = data.energy.reduce((a, b) => a + b, 0) / totalEntries;
    const avgSleep = data.sleep_hours.reduce((a, b) => a + b, 0) / totalEntries;
    const avgIrritability = data.irritability.reduce((a, b) => a + b, 0) / totalEntries;
    const avgAnxiety = data.anxiety.reduce((a, b) => a + b, 0) / totalEntries;
    
    // Подсчет типов дней
    const dayTypes = data.day_types.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    
    // Поиск трендов
    const moodTrend = calculateTrend(data.mood);
    const energyTrend = calculateTrend(data.energy);
    const sleepTrend = calculateTrend(data.sleep_hours);
    
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm p-4">
            <div class="flex items-center">
                <div class="p-2 bg-blue-100 rounded-lg">
                    <span class="text-2xl">📊</span>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-600">Всего записей</p>
                    <p class="text-2xl font-bold text-gray-800">${totalEntries}</p>
                </div>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-sm p-4">
            <div class="flex items-center">
                <div class="p-2 bg-green-100 rounded-lg">
                    <span class="text-2xl">😊</span>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-600">Среднее настроение</p>
                    <p class="text-2xl font-bold text-gray-800">${avgMood.toFixed(1)}</p>
                    <p class="text-xs ${moodTrend > 0 ? 'text-green-600' : moodTrend < 0 ? 'text-red-600' : 'text-gray-600'}">
                        ${moodTrend > 0 ? '↗' : moodTrend < 0 ? '↘' : '→'} ${Math.abs(moodTrend).toFixed(2)}
                    </p>
                </div>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-sm p-4">
            <div class="flex items-center">
                <div class="p-2 bg-purple-100 rounded-lg">
                    <span class="text-2xl">⚡</span>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-600">Средняя энергия</p>
                    <p class="text-2xl font-bold text-gray-800">${avgEnergy.toFixed(1)}</p>
                    <p class="text-xs ${energyTrend > 0 ? 'text-green-600' : energyTrend < 0 ? 'text-red-600' : 'text-gray-600'}">
                        ${energyTrend > 0 ? '↗' : energyTrend < 0 ? '↘' : '→'} ${Math.abs(energyTrend).toFixed(2)}
                    </p>
                </div>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-sm p-4">
            <div class="flex items-center">
                <div class="p-2 bg-yellow-100 rounded-lg">
                    <span class="text-2xl">😴</span>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-600">Средний сон</p>
                    <p class="text-2xl font-bold text-gray-800">${avgSleep.toFixed(1)} ч</p>
                    <p class="text-xs ${sleepTrend > 0 ? 'text-green-600' : sleepTrend < 0 ? 'text-red-600' : 'text-gray-600'}">
                        ${sleepTrend > 0 ? '↗' : sleepTrend < 0 ? '↘' : '→'} ${Math.abs(sleepTrend).toFixed(2)}
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Вычисление тренда (наклон линейной регрессии)
 * @param {Array} data - Массив чисел
 * @returns {number} Наклон тренда
 */
function calculateTrend(data) {
    if (data.length < 2) return 0;
    
    const n = data.length;
    const x = Array.from({length: n}, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * data[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}

/**
 * Инициализация всех графиков
 */
function initializeCharts() {
    if (!analyticsData || !analyticsData.dates || analyticsData.dates.length === 0) {
        showNoDataCharts();
        return;
    }
    
    initializeMoodChart();
    initializeEnergyChart();
    initializeSleepChart();
    initializeDayTypeChart();
    initializeCustomCharts();
}

/**
 * Показать сообщения об отсутствии данных для графиков
 */
function showNoDataCharts() {
    const chartIds = ['moodChart', 'energyChart', 'sleepChart', 'dayTypeChart'];
    
    chartIds.forEach(chartId => {
        const canvas = document.getElementById(chartId);
        if (canvas) {
            const parent = canvas.parentNode;
            canvas.style.display = 'none';
            
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'text-center text-gray-500 py-8';
            noDataMessage.innerHTML = '<p>Недостаточно данных для построения графика</p>';
            parent.appendChild(noDataMessage);
        }
    });
}

/**
 * Инициализация графика настроения
 */
function initializeMoodChart() {
    const ctx = document.getElementById('moodChart').getContext('2d');
    const dates = analyticsData.dates.map(date => new Date(date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
    
    charts.moodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Настроение',
                data: analyticsData.mood,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/**
 * Инициализация графика энергии
 */
function initializeEnergyChart() {
    const ctx = document.getElementById('energyChart').getContext('2d');
    const dates = analyticsData.dates.map(date => new Date(date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
    
    charts.energyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Энергия',
                data: analyticsData.energy,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/**
 * Инициализация графика сна
 */
function initializeSleepChart() {
    const ctx = document.getElementById('sleepChart').getContext('2d');
    const dates = analyticsData.dates.map(date => new Date(date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
    
    charts.sleepChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Часы сна',
                data: analyticsData.sleep_hours,
                backgroundColor: '#8B5CF6',
                borderColor: '#7C3AED',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' ч';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Инициализация графика типов дней
 */
function initializeDayTypeChart() {
    const ctx = document.getElementById('dayTypeChart').getContext('2d');
    
    // Подсчет типов дней
    const dayTypeCounts = analyticsData.day_types.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    
    const labels = {
        'depressive': 'Депрессивные',
        'normal': 'Нормальные',
        'hypomanic': 'Гипоманические',
        'mixed': 'Смешанные'
    };
    
    const colors = {
        'depressive': '#EF4444',
        'normal': '#10B981',
        'hypomanic': '#F59E0B',
        'mixed': '#8B5CF6'
    };
    
    charts.dayTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dayTypeCounts).map(type => labels[type] || type),
            datasets: [{
                data: Object.values(dayTypeCounts),
                backgroundColor: Object.keys(dayTypeCounts).map(type => colors[type] || '#6B7280'),
                borderWidth: 2,
                borderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

/**
 * Инициализация графиков для кастомных трекеров
 */
function initializeCustomCharts() {
    const container = document.getElementById('custom-trackers-charts');
    const section = document.getElementById('custom-trackers-section');
    
    if (!analyticsData.custom_trackers || Object.keys(analyticsData.custom_trackers).length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    Object.entries(analyticsData.custom_trackers).forEach(([trackerName, values]) => {
        // Проверяем, что значения - это числа
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        
        if (numericValues.length === 0) return;
        
        const chartContainer = document.createElement('div');
        chartContainer.className = 'bg-white rounded-lg shadow-sm p-4';
        chartContainer.innerHTML = `
            <h4 class="text-md font-semibold text-gray-800 mb-3">${trackerName}</h4>
            <canvas id="custom-${trackerName.replace(/\s+/g, '-').toLowerCase()}" width="300" height="200"></canvas>
        `;
        
        container.appendChild(chartContainer);
        
        const ctx = document.getElementById(`custom-${trackerName.replace(/\s+/g, '-').toLowerCase()}`).getContext('2d');
        const dates = analyticsData.dates.map(date => new Date(date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
        
        charts[`custom_${trackerName}`] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: trackerName,
                    data: numericValues,
                    borderColor: '#6366F1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    });
}

/**
 * Обновление таблицы данных
 */
function updateDataTable() {
    const tbody = document.getElementById('data-table');
    
    if (!analyticsData || !analyticsData.dates || analyticsData.dates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-gray-500 py-4">Нет данных за выбранный период</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = analyticsData.dates.map((date, index) => {
        const entryDate = new Date(date);
        const formattedDate = entryDate.toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        
        const mood = analyticsData.mood[index];
        const energy = analyticsData.energy[index];
        const sleep = analyticsData.sleep_hours[index];
        const dayType = analyticsData.day_types[index];
        const notes = analyticsData.notes ? analyticsData.notes[index] || '' : '';
        
        return `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="showDetailModal('${date}')">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${StabilUtils.getMoodColor(mood)}">${mood}/10</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${energy}/10</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${sleep.toFixed(1)} ч</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${StabilUtils.getDayTypeColor(dayType)}">
                        ${getDayTypeLabel(dayType)}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">${notes || '-'}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Получение метки для типа дня
 */
function getDayTypeLabel(dayType) {
    const labels = {
        'depressive': 'Депрессивный',
        'normal': 'Нормальный',
        'hypomanic': 'Гипоманический',
        'mixed': 'Смешанный'
    };
    return labels[dayType] || dayType;
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Изменение периода
    document.getElementById('period-select').addEventListener('change', function() {
        loadAnalyticsData();
        
        // Уничтожение старых графиков
        Object.values(charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        charts = {};
        
        // Переинициализация графиков
        setTimeout(() => {
            initializeCharts();
            updateDataTable();
        }, 100);
    });
}

/**
 * Показ детального модального окна
 */
async function showDetailModal(date) {
    try {
        const response = await fetch(`/get_entry/${date}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.exists) {
                const modal = document.getElementById('detailModal');
                const content = document.getElementById('detail-content');
                
                const entryDate = new Date(date).toLocaleDateString('ru-RU', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                content.innerHTML = `
                    <div class="space-y-4">
                        <div class="text-lg font-semibold text-gray-800">${entryDate}</div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">Настроение</div>
                                <div class="text-xl font-bold ${StabilUtils.getMoodColor(data.entry.mood)}">${data.entry.mood}/10</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">Энергия</div>
                                <div class="text-xl font-bold">${data.entry.energy}/10</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">Раздражительность</div>
                                <div class="text-xl font-bold">${data.entry.irritability}/10</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">Тревога</div>
                                <div class="text-xl font-bold">${data.entry.anxiety}/10</div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">Сон</div>
                                <div class="text-lg font-bold">${data.entry.sleep_hours} часов</div>
                                <div class="text-sm text-gray-500">
                                    ${data.entry.sleep_quality === 'good' ? 'Хорошее качество' : 
                                      data.entry.sleep_quality === 'average' ? 'Среднее качество' : 'Плохое качество'}
                                </div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">Тип дня</div>
                                <div class="text-lg font-bold">
                                    <span class="px-2 py-1 text-xs font-medium rounded-full ${StabilUtils.getDayTypeColor(data.entry.day_type)}">
                                        ${getDayTypeLabel(data.entry.day_type)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        ${data.entry.notes ? `
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600 mb-2">Заметки</div>
                                <div class="text-gray-800">${data.entry.notes}</div>
                            </div>
                        ` : ''}
                        
                        ${data.medications && Object.keys(data.medications).length > 0 ? `
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600 mb-2">Прием лекарств</div>
                                <div class="space-y-1">
                                    ${Object.entries(data.medications).map(([medId, taken]) => {
                                        const medName = medications.find(m => m.id == medId)?.name || `Лекарство ${medId}`;
                                        const takenText = taken === 'full' ? 'Полный прием' : taken === 'half' ? 'Половина' : 'Не принимал';
                                        return `<div class="text-sm">${medName}: ${takenText}</div>`;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${data.custom_values && Object.keys(data.custom_values).length > 0 ? `
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600 mb-2">Дополнительные параметры</div>
                                <div class="space-y-1">
                                    ${Object.entries(data.custom_values).map(([trackerId, value]) => {
                                        const trackerName = customTrackers.find(t => t.id == trackerId)?.name || `Трекер ${trackerId}`;
                                        return `<div class="text-sm">${trackerName}: ${value}</div>`;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки детальной информации:', error);
        StabilUtils.showMessage('Ошибка загрузки данных', 'error');
    }
}

/**
 * Закрытие детального модального окна
 */
function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

/**
 * Экспорт в PDF
 */
async function exportToPDF() {
    const period = document.getElementById('period-select').value;
    
    try {
        const response = await fetch(`/export_pdf?period=${period}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `affecta_report_${period}d.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            StabilUtils.showMessage('Отчет успешно скачан', 'success');
        } else {
            const error = await response.json();
            StabilUtils.showMessage(error.message || 'Ошибка при создании отчета', 'error');
        }
    } catch (error) {
        console.error('Ошибка экспорта в PDF:', error);
        StabilUtils.showMessage('Ошибка при экспорте отчета', 'error');
    }
}

// Обработчики нажатия клавиши Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (!document.getElementById('detailModal').classList.contains('hidden')) {
            closeDetailModal();
        }
    }
});