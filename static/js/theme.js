/**
 * Модуль управления темной темой для приложения Affecta
 * Поддерживает автоматическое определение системной темы и ручное переключение
 */

(function() {
    'use strict';

    const THEME_STORAGE_KEY = 'affecta-theme';
    const DARK_CLASS = 'dark';

    /**
     * Получает сохраненную тему из localStorage или определяет системную
     * @returns {string} 'dark' или 'light'
     */
    function getInitialTheme() {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        
        if (savedTheme) {
            return savedTheme;
        }
        
        // Проверяем системные настройки
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        
        return 'light';
    }

    /**
     * Применяет тему к документу
     * @param {string} theme - 'dark' или 'light'
     */
    function applyTheme(theme) {
        const root = document.documentElement;
        
        if (theme === 'dark') {
            root.classList.add(DARK_CLASS);
        } else {
            root.classList.remove(DARK_CLASS);
        }
        
        updateThemeIcon(theme);
    }

    /**
     * Обновляет иконку переключателя темы
     * @param {string} theme - 'dark' или 'light'
     */
    function updateThemeIcon(theme) {
        const lightIcon = document.getElementById('theme-toggle-light-icon');
        const darkIcon = document.getElementById('theme-toggle-dark-icon');
        
        if (lightIcon && darkIcon) {
            if (theme === 'dark') {
                lightIcon.classList.add('hidden');
                darkIcon.classList.remove('hidden');
            } else {
                lightIcon.classList.remove('hidden');
                darkIcon.classList.add('hidden');
            }
        }
    }

    /**
     * Переключает тему между светлой и темной
     */
    function toggleTheme() {
        const currentTheme = document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        
        // Обновляем графики Chart.js, если они есть
        updateChartsTheme(newTheme);
    }

    /**
     * Получает цвета для графиков в зависимости от темы
     * @param {boolean} isDark - темная ли тема
     * @returns {object} объект с цветами
     */
    function getChartColors(isDark) {
        return {
            text: isDark ? '#E5E7EB' : '#374151',
            grid: isDark ? '#4B5563' : '#E5E7EB',
            border: isDark ? '#6B7280' : '#D1D5DB'
        };
    }

    /**
     * Обновляет тему графиков Chart.js
     * @param {string} theme - 'dark' или 'light'
     */
    function updateChartsTheme(theme) {
        if (typeof Chart === 'undefined') {
            return;
        }
        
        const isDark = theme === 'dark';
        const colors = getChartColors(isDark);
        
        // Обновляем все существующие графики
        if (Chart.instances) {
            Object.values(Chart.instances).forEach(chart => {
                if (chart.options) {
                    // Обновляем цвета осей
                    if (chart.options.scales) {
                        Object.keys(chart.options.scales).forEach(scaleId => {
                            const scale = chart.options.scales[scaleId];
                            if (scale.ticks) {
                                scale.ticks.color = colors.text;
                            }
                            if (scale.grid) {
                                scale.grid.color = colors.grid;
                                scale.grid.borderColor = colors.border;
                            }
                            if (scale.border) {
                                scale.border.color = colors.border;
                            }
                        });
                    }
                    
                    // Обновляем цвета легенды
                    if (chart.options.plugins) {
                        if (chart.options.plugins.legend) {
                            if (!chart.options.plugins.legend.labels) {
                                chart.options.plugins.legend.labels = {};
                            }
                            chart.options.plugins.legend.labels.color = colors.text;
                        }
                        
                        // Обновляем цвета тултипов
                        if (chart.options.plugins.tooltip) {
                            chart.options.plugins.tooltip.backgroundColor = isDark 
                                ? 'rgba(55, 65, 81, 0.95)' 
                                : 'rgba(255, 255, 255, 0.95)';
                            chart.options.plugins.tooltip.titleColor = colors.text;
                            chart.options.plugins.tooltip.bodyColor = colors.text;
                            chart.options.plugins.tooltip.borderColor = colors.border;
                            chart.options.plugins.tooltip.borderWidth = 1;
                        }
                    }
                    
                    chart.update('none'); // Обновляем без анимации
                }
            });
        }
    }

    /**
     * Получает опции для графиков с учетом текущей темы
     * @returns {object} объект с цветами для графиков
     */
    function getChartThemeOptions() {
        const isDark = document.documentElement.classList.contains(DARK_CLASS);
        return getChartColors(isDark);
    }

    /**
     * Инициализирует тему при загрузке страницы
     */
    function initTheme() {
        const theme = getInitialTheme();
        applyTheme(theme);
        
        // Слушаем изменения системной темы (только если пользователь не выбрал тему вручную)
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            mediaQuery.addEventListener('change', (e) => {
                // Применяем системную тему только если пользователь не сохранил свой выбор
                if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    /**
     * Инициализирует обработчик клика на переключатель темы
     */
    function initThemeToggle() {
        const toggleButton = document.getElementById('theme-toggle');
        
        if (toggleButton) {
            toggleButton.addEventListener('click', toggleTheme);
        }
    }

    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initTheme();
            initThemeToggle();
        });
    } else {
        // DOM уже загружен
        initTheme();
        initThemeToggle();
    }

    // Экспортируем функции для использования в других модулях
    window.ThemeManager = {
        toggle: toggleTheme,
        apply: applyTheme,
        getCurrent: function() {
            return document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
        },
        updateCharts: updateChartsTheme,
        getChartColors: getChartThemeOptions
    };

})();

