"""
Генерация PDF отчётов для биполярного трекера "Affecta"
Проект для защиты - студент 20 лет

Класс ReportGenerator:
- Генерация PDF отчётов с помощью reportlab
- Построение графиков с помощью matplotlib
- Поддержка кириллицы через системные шрифты
- Разделы: история фаз, статистика сна, график состояний, заметки
"""

import io
import os
from datetime import datetime, date, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.dates import MonthLocator


class ReportGenerator:
    """Класс для генерации PDF отчётов"""
    
    def __init__(self, db, user_id, username):
        """
        Инициализация генератора отчётов
        
        Args:
            db: Экземпляр Database
            user_id: ID пользователя
            username: Имя пользователя
        """
        self.db = db
        self.user_id = user_id
        self.username = username
        self._register_cyrillic_font()
        self._setup_matplotlib()
    
    def _register_cyrillic_font(self):  # <-- ДОЛЖЕН БЫТЬ С ОТСТУПОМ (4 пробела)
        """Регистрация шрифта с поддержкой кириллицы"""
        import platform
        
        font_paths = []
        
        # Windows шрифты
        if platform.system() == 'Windows':
            windows_fonts = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
            font_paths = [
                os.path.join(windows_fonts, 'arial.ttf'),
                os.path.join(windows_fonts, 'ARIAL.TTF'),
                os.path.join(windows_fonts, 'calibri.ttf'),
            ]
        # Linux шрифты
        else:
            # Стандартные пути к шрифтам в Linux
            linux_font_paths = [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
                '/usr/share/fonts/TTF/DejaVuSans.ttf',
                '/usr/share/fonts/TTF/LiberationSans-Regular.ttf',
                '/usr/local/share/fonts/DejaVuSans.ttf',
            ]
            
            # Также попробуем найти через find
            import subprocess
            try:
                result = subprocess.run(['find', '/usr/share/fonts', '-name', 'DejaVuSans.ttf', '-type', 'f'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0 and result.stdout.strip():
                    linux_font_paths.insert(0, result.stdout.strip().split('\n')[0])
            except:
                pass
            
            font_paths = linux_font_paths
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    pdfmetrics.registerFont(TTFont('CyrillicFont', font_path))
                    self.font_name = 'CyrillicFont'
                    return
                except Exception as e:
                    print(f"Ошибка регистрации шрифта {font_path}: {e}")
                    continue
        
        # Если ничего не найдено, используем Helvetica (без кириллицы)
        self.font_name = 'Helvetica'
        print("Предупреждение: шрифт с поддержкой кириллицы не найден, используется Helvetica")
    
    def _get_font_name(self):
        """Получение имени шрифта с поддержкой кириллицы"""
        return getattr(self, 'font_name', 'Helvetica')
    
    def _setup_matplotlib(self):
        """Настройка matplotlib для корректного отображения кириллицы и улучшения качества"""
        import platform
        
        # Настройка параметров matplotlib для лучшего качества
        plt.rcParams['figure.dpi'] = 300
        plt.rcParams['savefig.dpi'] = 300
        plt.rcParams['figure.facecolor'] = 'white'
        plt.rcParams['axes.facecolor'] = 'white'
        plt.rcParams['font.size'] = 11
        plt.rcParams['axes.labelsize'] = 12
        plt.rcParams['axes.titlesize'] = 14
        plt.rcParams['xtick.labelsize'] = 10
        plt.rcParams['ytick.labelsize'] = 10
        plt.rcParams['legend.fontsize'] = 10
        plt.rcParams['figure.titlesize'] = 16
        plt.rcParams['lines.linewidth'] = 2.5
        plt.rcParams['lines.markersize'] = 6
        plt.rcParams['grid.alpha'] = 0.3
        plt.rcParams['axes.grid'] = True
        plt.rcParams['grid.linestyle'] = '--'
        plt.rcParams['axes.axisbelow'] = True
        
        # Настройка шрифта для matplotlib
        font_paths = []
        if platform.system() == 'Windows':
            windows_fonts = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
            font_paths = [
                os.path.join(windows_fonts, 'arial.ttf'),
                os.path.join(windows_fonts, 'ARIAL.TTF'),
                os.path.join(windows_fonts, 'calibri.ttf'),
            ]
        else:
            font_paths = [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                '/usr/share/fonts/TTF/DejaVuSans.ttf',
            ]
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    from matplotlib import font_manager
                    font_prop = font_manager.FontProperties(fname=font_path)
                    plt.rcParams['font.family'] = font_prop.get_name()
                    break
                except Exception as e:
                    print(f"Ошибка настройки шрифта matplotlib {font_path}: {e}")
                    continue
    
    def generate_report(self, start_date, end_date, sections, comment=None):
        """Генерация PDF отчёта"""
        entries = self._get_entries_data(start_date, end_date)
        
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4, 
                               rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
        
        styles = getSampleStyleSheet()
        font_name = self._get_font_name()
        for style_name in ['Normal', 'Heading1', 'Heading2', 'Heading3']:
            if style_name in styles:
                styles[style_name].fontName = font_name
        
        story = []
        self._build_pdf_content(story, start_date, end_date, entries, sections, comment, styles)
        doc.build(story)
        
        pdf_bytes = pdf_buffer.getvalue()
        pdf_buffer.close()
        return pdf_bytes
    
    def _get_entries_data(self, start_date, end_date):
        """Получение данных записей за период"""
        entries = self.db.get_entries_period(self.user_id, start_date, end_date)
        enriched_entries = []
        for entry in entries:
            enriched = dict(entry)
            enriched['medications'] = self.db.get_medication_intakes(entry['id'])
            enriched['custom_states'] = self.db.get_custom_state_values(entry['id'])
            enriched['custom_values'] = self.db.get_custom_values(entry['id'])
            enriched_entries.append(enriched)
        return enriched_entries
    
    def _build_pdf_content(self, story, start_date, end_date, entries, sections, comment, styles):
        """Построение контента PDF"""
        self._add_header(story, start_date, end_date, comment, styles)
        
        if sections.get('phase_history', True):
            self._add_phase_history_chart(story, entries, start_date, end_date, styles)
        
        if sections.get('sleep_stats', True):
            self._add_sleep_stats(story, entries, styles)
        
        if sections.get('states_chart', True):
            self._add_states_chart(story, entries, start_date, end_date, styles)
        
        if sections.get('notes', True) and entries:
            notes_entries = [e for e in entries if e.get('notes')]
            if notes_entries:
                self._add_notes_section(story, notes_entries, styles)
        
        self._add_footer(story, styles)
    
    def _add_header(self, story, start_date, end_date, comment, styles):
        """Добавление шапки отчёта"""
        start_str = start_date.strftime('%d.%m.%Y')
        end_str = end_date.strftime('%d.%m.%Y')
        generated_date = datetime.now().strftime('%d.%m.%Y %H:%M')
        
        # Заголовок
        font_name = self._get_font_name()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=HexColor('#4F46E5'),
            alignment=TA_CENTER,
            spaceAfter=20,
            fontName=font_name
        )
        story.append(Paragraph('Affecta - Отчёт о состоянии', title_style))
        story.append(Spacer(1, 0.5*cm))
        
        # Информация
        font_name = getattr(self, 'font_name', 'Helvetica')
        info_style = ParagraphStyle(
            'Info',
            parent=styles['Normal'],
            fontSize=10,
            textColor=HexColor('#6B7280'),
            alignment=TA_CENTER,
            spaceAfter=5,
            fontName=font_name
        )
        story.append(Paragraph(f'<b>Период:</b> {start_str} - {end_str}', info_style))
        story.append(Paragraph(f'<b>Пользователь:</b> {self.username}', info_style))
        story.append(Paragraph(f'<b>Дата формирования:</b> {generated_date}', info_style))
        story.append(Spacer(1, 1*cm))
        
        # Комментарий
        if comment:
            font_name = getattr(self, 'font_name', 'Helvetica')
            comment_style = ParagraphStyle(
                'Comment',
                parent=styles['Normal'],
                fontSize=10,
                backColor=HexColor('#FEF3C7'),
                borderColor=HexColor('#F59E0B'),
                borderWidth=1,
                borderPadding=10,
                leftIndent=10,
                rightIndent=10,
                spaceAfter=15,
                fontName=font_name
            )
            story.append(Paragraph(f'<b>Комментарий к отчёту:</b><br/>{self._escape_html(comment)}', comment_style))
            story.append(Spacer(1, 0.5*cm))
    
    def _escape_html(self, text):
        """Экранирование HTML в тексте"""
        if not text:
            return ''
        return (text
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&#x27;'))
    
    def _generate_general_info(self, entries, start_date, end_date):
        """Генерация раздела общей информации"""
        total_days = (end_date - start_date).days + 1
        entries_count = len(entries)
        coverage = (entries_count / total_days * 100) if total_days > 0 else 0
        
        # Подсчёт фаз
        phase_counts = {}
        for entry in entries:
            phase = entry.get('day_type', 'normal')
            phase_counts[phase] = phase_counts.get(phase, 0) + 1
        
        phase_labels = {
            'depressive': 'Депрессивная',
            'normal': 'Нормальная',
            'hypomanic': 'Гипоманиакальная',
            'mixed': 'Смешанная'
        }
        
        phase_html = ''
        for phase, count in phase_counts.items():
            percentage = (count / entries_count * 100) if entries_count > 0 else 0
            phase_html += f'<div class="stat-item"><span>{phase_labels.get(phase, phase)}:</span> <strong>{count} ({percentage:.1f}%)</strong></div>'
        
        return f'''
        <div class="section">
            <h2>Общая информация о периоде</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Дней в периоде:</span>
                    <span class="value">{total_days}</span>
                </div>
                <div class="info-item">
                    <span class="label">Записей заполнено:</span>
                    <span class="value">{entries_count}</span>
                </div>
                <div class="info-item">
                    <span class="label">Покрытие данными:</span>
                    <span class="value">{coverage:.1f}%</span>
                </div>
            </div>
            <div class="phases-summary">
                <h3>Распределение фаз:</h3>
                {phase_html}
            </div>
        </div>
        '''
    
    def _generate_phases_section(self, entries):
        """Генерация раздела о текущей и доминирующей фазе"""
        if not entries:
            return '<div class="section"><h2>Текущая и доминирующая фаза</h2><p class="no-data">Нет данных</p></div>'
        
        # Текущая фаза (последняя запись)
        last_entry = entries[-1]
        current_phase = last_entry.get('day_type', 'normal')
        current_date = last_entry['entry_date'].strftime('%d.%m.%Y')
        
        # Доминирующая фаза (наиболее частая)
        phase_counts = {}
        for entry in entries:
            phase = entry.get('day_type', 'normal')
            phase_counts[phase] = phase_counts.get(phase, 0) + 1
        
        dominant_phase = max(phase_counts.items(), key=lambda x: x[1])[0] if phase_counts else 'normal'
        dominant_count = phase_counts.get(dominant_phase, 0)
        dominant_percentage = (dominant_count / len(entries) * 100) if entries else 0
        
        phase_labels = {
            'depressive': 'Депрессивная',
            'normal': 'Нормальная',
            'hypomanic': 'Гипоманиакальная',
            'mixed': 'Смешанная'
        }
        
        phase_colors = {
            'depressive': '#DC2626',
            'normal': '#059669',
            'hypomanic': '#D97706',
            'mixed': '#9333EA'
        }
        
        return f'''
        <div class="section">
            <h2>Текущая и доминирующая фаза</h2>
            <div class="phases-info">
                <div class="phase-card" style="border-left-color: {phase_colors.get(current_phase, '#6B7280')};">
                    <div class="phase-label">Текущая фаза</div>
                    <div class="phase-value" style="color: {phase_colors.get(current_phase, '#6B7280')};">
                        {phase_labels.get(current_phase, current_phase)}
                    </div>
                    <div class="phase-date">на {current_date}</div>
                </div>
                <div class="phase-card" style="border-left-color: {phase_colors.get(dominant_phase, '#6B7280')};">
                    <div class="phase-label">Доминирующая фаза</div>
                    <div class="phase-value" style="color: {phase_colors.get(dominant_phase, '#6B7280')};">
                        {phase_labels.get(dominant_phase, dominant_phase)}
                    </div>
                    <div class="phase-date">{dominant_count} дней ({dominant_percentage:.1f}% периода)</div>
                </div>
            </div>
        </div>
        '''
    
    def _create_chart_image(self, fig) -> io.BytesIO:
        """Создание изображения графика для вставки в PDF"""
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight', 
                   facecolor='white', edgecolor='none', pad_inches=0.2)
        img_buffer.seek(0)
        plt.close()
        return img_buffer
    
    def _add_phase_history_chart(self, story, entries, start_date, end_date, styles):
        """Добавление графика истории фаз"""
        font_name = self._get_font_name()
        if not entries:
            heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
            story.append(Paragraph('История фаз', heading_style))
            story.append(Paragraph('Нет данных', styles['Normal']))
            story.append(Spacer(1, 1*cm))
            return
        
        # Создание графика с увеличенным размером
        fig, ax = plt.subplots(figsize=(12, 5))
        fig.patch.set_facecolor('white')
        
        # Подготовка данных
        phase_map = {entry['entry_date']: entry.get('day_type', 'normal') for entry in entries}
        
        # Заполнение всех дней в периоде
        dates = []
        phases = []
        current_date = start_date
        while current_date <= end_date:
            dates.append(current_date)
            phases.append(phase_map.get(current_date, None))
            current_date += timedelta(days=1)
        
        # Числовые значения для фаз
        phase_values = {
            'depressive': 1,
            'normal': 2,
            'hypomanic': 3,
            'mixed': 0.5
        }
        
        # Цвета для фаз
        phase_colors = {
            'depressive': '#DC2626',
            'normal': '#059669',
            'hypomanic': '#D97706',
            'mixed': '#9333EA'
        }
        
        # Преобразование в числовые значения
        y_values = [phase_values.get(p, 2) if p else None for p in phases]
        
        # Построение графика с более толстыми линиями и крупными маркерами
        ax.plot(dates, y_values, marker='o', linestyle='-', linewidth=3, markersize=8, 
               color='#4F46E5', alpha=0.7, zorder=1)
        
        # Цвета точек с увеличенным размером
        for i, (d, p) in enumerate(zip(dates, phases)):
            if p:
                ax.plot(d, phase_values.get(p, 2), 'o', color=phase_colors.get(p, '#6B7280'), 
                       markersize=10, zorder=2, markeredgewidth=1.5, markeredgecolor='white')
        
        # Настройка осей с увеличенными шрифтами
        ax.set_ylim(0, 3.5)
        ax.set_yticks([0.5, 1, 2, 3])
        ax.set_yticklabels(['Смешанная', 'Депрессия', 'Норма', 'Гипомания'], fontsize=11)
        ax.set_xlabel('Дата', fontsize=13, fontweight='bold')
        ax.set_ylabel('Фаза', fontsize=13, fontweight='bold')
        ax.grid(True, alpha=0.4, linestyle='--', linewidth=1)
        ax.set_title('История фаз за период', fontsize=15, fontweight='bold', pad=15)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        
        # Форматирование дат
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%d.%m'))
        num_days = len(dates)
        if num_days > 365:
            ax.xaxis.set_major_locator(MonthLocator(interval=max(1, num_days // 365)))
        elif num_days > 90:
            ax.xaxis.set_major_locator(MonthLocator(interval=1))
        elif num_days > 30:
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(7, num_days // 10)))
        else:
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, num_days // 10)))
        plt.xticks(rotation=45, ha='right')
        
        plt.tight_layout()
        
        # Добавление в PDF
        font_name = self._get_font_name()
        heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
        story.append(Paragraph('История фаз', heading_style))
        
        img_buffer = self._create_chart_image(fig)
        img = Image(img_buffer, width=17*cm, height=7*cm)
        story.append(img)
        story.append(Spacer(1, 1*cm))
    
    def _add_states_chart(self, story, entries, start_date, end_date, styles):
        """Добавление графика состояний"""
        font_name = self._get_font_name()
        if not entries:
            heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
            story.append(Paragraph('График состояний', heading_style))
            story.append(Paragraph('Нет данных', styles['Normal']))
            story.append(Spacer(1, 1*cm))
            return
        
        # Создание графика с увеличенным размером
        fig, ax = plt.subplots(figsize=(12, 6))
        fig.patch.set_facecolor('white')
        
        # Подготовка данных
        dates = [e['entry_date'] for e in entries]
        mood_data = [e.get('mood', 5) for e in entries]
        energy_data = [e.get('energy', 5) for e in entries]
        irritability_data = [e.get('irritability', 0) for e in entries]
        anxiety_data = [e.get('anxiety', 0) for e in entries]
        
        # Построение графиков с увеличенными маркерами и линиями
        ax.plot(dates, mood_data, marker='o', linestyle='-', linewidth=3, markersize=7, 
                color='#10B981', label='Настроение', alpha=0.85, zorder=4)
        ax.plot(dates, energy_data, marker='s', linestyle='-', linewidth=3, markersize=7, 
                color='#3B82F6', label='Энергия', alpha=0.85, zorder=3)
        ax.plot(dates, irritability_data, marker='^', linestyle='-', linewidth=3, markersize=7, 
                color='#EF4444', label='Раздражительность', alpha=0.85, zorder=2)
        ax.plot(dates, anxiety_data, marker='v', linestyle='-', linewidth=3, markersize=7, 
                color='#F59E0B', label='Тревога', alpha=0.85, zorder=1)
        
        # Настройка осей с увеличенными шрифтами
        ax.set_ylim(0, 10)
        ax.set_xlabel('Дата', fontsize=13, fontweight='bold')
        ax.set_ylabel('Значение (0-10)', fontsize=13, fontweight='bold')
        ax.set_title('График состояний за период', fontsize=15, fontweight='bold', pad=15)
        ax.grid(True, alpha=0.4, linestyle='--', linewidth=1)
        ax.legend(loc='best', fontsize=11, framealpha=0.95, edgecolor='gray', fancybox=True)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        
        # Форматирование дат
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%d.%m'))
        num_days = len(dates)
        if num_days > 365:
            ax.xaxis.set_major_locator(MonthLocator(interval=max(1, num_days // 365)))
        elif num_days > 90:
            ax.xaxis.set_major_locator(MonthLocator(interval=1))
        elif num_days > 30:
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(7, num_days // 10)))
        else:
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, num_days // 10)))
        plt.xticks(rotation=45, ha='right')
        
        plt.tight_layout()
        
        # Добавление в PDF
        font_name = self._get_font_name()
        heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
        story.append(Paragraph('График состояний', heading_style))
        
        img_buffer = self._create_chart_image(fig)
        img = Image(img_buffer, width=17*cm, height=8.5*cm)
        story.append(img)
        story.append(Spacer(1, 1*cm))
    
    def _add_sleep_stats(self, story, entries, styles):
        """Добавление статистики сна"""
        font_name = self._get_font_name()
        if not entries:
            heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
            story.append(Paragraph('Статистика сна', heading_style))
            story.append(Paragraph('Нет данных', styles['Normal']))
            story.append(Spacer(1, 1*cm))
            return
        
        sleep_hours = [float(e.get('sleep_hours', 0) or 0) for e in entries if e.get('sleep_hours', 0)]
        
        if not sleep_hours:
            heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
            story.append(Paragraph('Статистика сна', heading_style))
            story.append(Paragraph('Нет данных о сне', styles['Normal']))
            story.append(Spacer(1, 1*cm))
            return
        
        avg_sleep = sum(sleep_hours) / len(sleep_hours)
        min_sleep = min(sleep_hours)
        max_sleep = max(sleep_hours)
        
        # Качество сна
        quality_counts = {}
        for entry in entries:
            quality = entry.get('sleep_quality', 'average')
            quality_counts[quality] = quality_counts.get(quality, 0) + 1
        
        quality_labels = {
            'poor': 'Плохое',
            'average': 'Среднее',
            'good': 'Хорошее'
        }
        
        # Добавление в PDF
        font_name = self._get_font_name()
        heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
        story.append(Paragraph('Статистика сна', heading_style))
        
        # Статистика
        stats_text = f'Среднее: {avg_sleep:.1f} ч | Минимум: {min_sleep:.1f} ч | Максимум: {max_sleep:.1f} ч'
        story.append(Paragraph(stats_text, styles['Normal']))
        story.append(Spacer(1, 0.3*cm))
        
        # Качество сна
        quality_text = 'Качество сна: '
        quality_parts = []
        for quality, count in quality_counts.items():
            percentage = (count / len(entries) * 100) if entries else 0
            quality_parts.append(f"{quality_labels.get(quality, quality)}: {count} ({percentage:.1f}%)")
        story.append(Paragraph(quality_text + ' | '.join(quality_parts), styles['Normal']))
        story.append(Spacer(1, 0.5*cm))
        
        # График сна с улучшенным оформлением
        fig, ax = plt.subplots(figsize=(12, 5))
        fig.patch.set_facecolor('white')
        
        dates = [e['entry_date'] for e in entries if e.get('sleep_hours', 0)]
        hours = [float(e.get('sleep_hours', 0) or 0) for e in entries if e.get('sleep_hours', 0)]
        
        ax.plot(dates, hours, marker='o', linestyle='-', linewidth=3, markersize=8, 
               color='#3B82F6', zorder=2, markeredgewidth=1.5, markeredgecolor='white')
        ax.fill_between(dates, hours, alpha=0.25, color='#3B82F6', zorder=1)
        ax.set_xlabel('Дата', fontsize=13, fontweight='bold')
        ax.set_ylabel('Часы сна', fontsize=13, fontweight='bold')
        ax.set_title('График сна за период', fontsize=15, fontweight='bold', pad=15)
        ax.grid(True, alpha=0.4, linestyle='--', linewidth=1)
        ax.set_ylim(bottom=0)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        
        # Форматирование дат
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%d.%m'))
        num_days = len(dates)
        if num_days > 365:
            ax.xaxis.set_major_locator(MonthLocator(interval=max(1, num_days // 365)))
        elif num_days > 90:
            ax.xaxis.set_major_locator(MonthLocator(interval=1))
        elif num_days > 30:
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(7, num_days // 10)))
        else:
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, num_days // 10)))
        plt.xticks(rotation=45, ha='right')
        
        plt.tight_layout()
        
        img_buffer = self._create_chart_image(fig)
        img = Image(img_buffer, width=17*cm, height=7*cm)
        story.append(img)
        story.append(Spacer(1, 1*cm))
    
    def _generate_medications_section(self, entries):
        """Генерация раздела о приёме лекарств"""
        # Получение всех лекарств пользователя
        medications = self.db.get_user_medications(self.user_id)
        
        if not medications:
            return '<div class="section"><h2>Приём лекарств</h2><p class="no-data">Лекарства не добавлены</p></div>'
        
        # Создание карты приёмов
        med_intakes_map = {}
        for entry in entries:
            for med_intake in entry.get('medications', []):
                med_id = med_intake.get('med_id')
                med_name = med_intake.get('name')
                if med_id and med_id not in med_intakes_map:
                    # Получаем информацию о лекарстве из списка всех лекарств
                    med_info = next((m for m in medications if m['id'] == med_id), None)
                    if med_info:
                        med_intakes_map[med_id] = {
                            'name': med_info.get('name', med_name),
                            'dosage_mg': med_info.get('dosage_mg'),
                            'time_of_day': med_info.get('time_of_day'),
                            'frequency': med_info.get('frequency', 'daily'),
                            'intakes': []
                        }
                if med_id and med_id in med_intakes_map:
                    med_intakes_map[med_id]['intakes'].append({
                        'date': entry['entry_date'],
                        'taken': med_intake.get('taken', 'none')
                    })
        
        if not med_intakes_map:
            return '<div class="section"><h2>Приём лекарств</h2><p class="no-data">Нет данных о приёме лекарств за период</p></div>'
        
        # Генерация HTML
        med_html = ''
        for med_id, med_data in med_intakes_map.items():
            taken_count = sum(1 for i in med_data['intakes'] if i['taken'] != 'none')
            total_count = len(med_data['intakes'])
            compliance = (taken_count / total_count * 100) if total_count > 0 else 0
            
            dosage_str = f"{med_data['dosage_mg']} мг" if med_data['dosage_mg'] else "—"
            time_str = {
                'morning': 'Утро',
                'afternoon': 'День',
                'evening': 'Вечер',
                'night': 'Ночь'
            }.get(med_data['time_of_day'], med_data['time_of_day'] or '—')
            frequency_str = {
                'daily': 'Ежедневно',
                'as_needed': 'По необходимости'
            }.get(med_data['frequency'], med_data['frequency'])
            
            med_html += f'''
            <div class="medication-item">
                <div class="med-header">
                    <h3>{med_data['name']}</h3>
                    <span class="compliance">Соблюдение: {compliance:.1f}%</span>
                </div>
                <div class="med-details">
                    <div class="med-detail"><strong>Дозировка:</strong> {dosage_str}</div>
                    <div class="med-detail"><strong>Время приёма:</strong> {time_str}</div>
                    <div class="med-detail"><strong>Частота:</strong> {frequency_str}</div>
                    <div class="med-detail"><strong>Принято:</strong> {taken_count} из {total_count} дней</div>
                </div>
            </div>
            '''
        
        return f'''
        <div class="section">
            <h2>Приём лекарств</h2>
            {med_html}
        </div>
        '''
    
    def _generate_custom_states_section(self, entries):
        """Генерация раздела пользовательских состояний"""
        # Получение всех пользовательских состояний
        custom_states = self.db.get_user_custom_states(self.user_id)
        
        if not custom_states:
            return '<div class="section"><h2>Пользовательские состояния</h2><p class="no-data">Пользовательские состояния не добавлены</p></div>'
        
        # Создание карты значений
        states_map = {}
        for entry in entries:
            for state_value in entry.get('custom_states', []):
                state_id = state_value['state_id']
                state_name = state_value['name']
                if state_id not in states_map:
                    states_map[state_id] = {
                        'name': state_name,
                        'mark_type': state_value.get('mark_type', 'categorical'),
                        'values': []
                    }
                states_map[state_id]['values'].append({
                    'date': entry['entry_date'],
                    'value': state_value.get('value', '')
                })
        
        if not states_map:
            return '<div class="section"><h2>Пользовательские состояния</h2><p class="no-data">Нет данных о пользовательских состояниях за период</p></div>'
        
        # Генерация HTML
        states_html = ''
        for state_id, state_data in states_map.items():
            values_list = ', '.join([f"{v['date'].strftime('%d.%m')}: {v['value']}" for v in state_data['values'][:10]])
            if len(state_data['values']) > 10:
                values_list += f" ... (ещё {len(state_data['values']) - 10})"
            
            states_html += f'''
            <div class="custom-state-item">
                <h3>{state_data['name']}</h3>
                <div class="state-values">{values_list}</div>
            </div>
            '''
        
        return f'''
        <div class="section">
            <h2>Пользовательские состояния</h2>
            {states_html}
        </div>
        '''
    
    def _generate_notes_section(self, entries):
        """Генерация раздела заметок"""
        # Фильтрация заметок происходит здесь, а не в _get_entries_data
        # чтобы не терять другие данные записей
        notes_entries = [e for e in entries if e.get('notes')]
        
        if not notes_entries:
            return '<div class="section"><h2>Заметки</h2><p class="no-data">Нет заметок за период</p></div>'
        
        notes_html = ''
        for entry in notes_entries:
            date_str = entry['entry_date'].strftime('%d.%m.%Y')
            notes = entry.get('notes', '')
            # is_important может быть 0, 1 или None
            is_important = bool(entry.get('is_important', 0) or 0)
            important_badge = '<span class="important-badge">Важно</span>' if is_important else ''
            
            notes_html += f'''
            <div class="note-item">
                <div class="note-header">
                    <span class="note-date">{date_str}</span>
                    {important_badge}
                </div>
                <div class="note-content">{self._escape_html(notes)}</div>
            </div>
            '''
        
        return f'''
        <div class="section">
            <h2>Заметки</h2>
            <div class="notes-container">
                {notes_html}
            </div>
        </div>
        '''
    
    def _add_notes_section(self, story, entries, styles):
        """Добавление раздела заметок"""
        font_name = self._get_font_name()
        if not entries:
            heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
            story.append(Paragraph('Заметки', heading_style))
            story.append(Paragraph('Нет заметок за период', styles['Normal']))
            story.append(Spacer(1, 1*cm))
            return
        
        heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=16, spaceAfter=10, fontName=font_name)
        story.append(Paragraph('Заметки', heading_style))
        
        # Единый стиль для блока заметки (дата + текст в одном блоке)
        note_block_style = ParagraphStyle(
            'NoteBlock',
            parent=styles['Normal'],
            fontSize=10,
            leftIndent=10,
            rightIndent=10,
            spaceAfter=8,
            spaceBefore=0,
            backColor=HexColor('#F9FAFB'),
            borderColor=HexColor('#F59E0B'),
            borderWidth=1,
            borderPadding=12,
            fontName=font_name,
            leading=14
        )
        
        for entry in entries:
            date_str = entry['entry_date'].strftime('%d.%m.%Y')
            notes = entry.get('notes', '')
            
            # Объединяем дату и текст в один блок
            note_text = f'<b><font color="#4F46E5">Дата: {date_str}</font></b><br/>{self._escape_html(notes)}'
            story.append(Paragraph(note_text, note_block_style))
            
            # Отступ между заметками
            story.append(Spacer(1, 0.3*cm))
        
        story.append(Spacer(1, 0.5*cm))
    
    def _escape_html(self, text):
        """Экранирование HTML в тексте"""
        if not text:
            return ''
        return (text
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&#x27;'))
    
    def _add_footer(self, story, styles):
        """Добавление подвала"""
        font_name = self._get_font_name()
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=9,
            textColor=HexColor('#6B7280'),
            alignment=TA_CENTER,
            spaceBefore=20,
            fontName=font_name
        )
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph('Отчёт сгенерирован автоматически приложением "Affecta"', footer_style))
        story.append(Paragraph('Биполярный трекер для отслеживания состояния и настроения', footer_style))
    
    def _generate_css(self) -> str:
        """Генерация CSS стилей для PDF"""
        return '''
        @page {
            size: A4;
            margin: 2cm;
        }
        
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1F2937;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #4F46E5;
            page-break-after: avoid;
        }
        
        .header h1 {
            color: #4F46E5;
            font-size: 24pt;
            margin: 0 0 10px 0;
            font-weight: bold;
        }
        
        .header-info {
            font-size: 10pt;
            color: #6B7280;
        }
        
        .header-info p {
            margin: 5px 0;
        }
        
        .comment-box {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        
        .comment-box p {
            margin: 5px 0;
        }
        
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .section h2 {
            color: #1F2937;
            font-size: 16pt;
            font-weight: bold;
            margin: 20px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #E5E7EB;
            page-break-after: avoid;
        }
        
        .section h3 {
            color: #374151;
            font-size: 12pt;
            font-weight: bold;
            margin: 15px 0 10px 0;
        }
        
        .no-data {
            color: #6B7280;
            font-style: italic;
            padding: 20px;
            text-align: center;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .info-item {
            background-color: #F9FAFB;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #4F46E5;
        }
        
        .info-item .label {
            display: block;
            font-size: 9pt;
            color: #6B7280;
            margin-bottom: 5px;
        }
        
        .info-item .value {
            display: block;
            font-size: 14pt;
            font-weight: bold;
            color: #1F2937;
        }
        
        .phases-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-top: 15px;
        }
        
        .phase-card {
            background-color: #F9FAFB;
            padding: 20px;
            border-radius: 8px;
            border-left: 5px solid;
        }
        
        .phase-label {
            font-size: 9pt;
            color: #6B7280;
            margin-bottom: 8px;
        }
        
        .phase-value {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .phase-date {
            font-size: 9pt;
            color: #6B7280;
        }
        
        .phases-summary, .sleep-quality {
            margin-top: 15px;
        }
        
        .stat-item {
            padding: 8px 0;
            border-bottom: 1px solid #E5E7EB;
        }
        
        .stat-item span {
            color: #6B7280;
        }
        
        .stat-item strong {
            color: #1F2937;
        }
        
        .chart-container {
            margin: 20px 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .chart-image {
            max-width: 100%;
            height: auto;
        }
        
        .sleep-stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background-color: #F9FAFB;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            border-left: 4px solid #3B82F6;
        }
        
        .stat-label {
            font-size: 9pt;
            color: #6B7280;
            margin-bottom: 8px;
        }
        
        .stat-value {
            font-size: 16pt;
            font-weight: bold;
            color: #1F2937;
        }
        
        .medication-item {
            background-color: #F9FAFB;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            border-left: 4px solid #10B981;
        }
        
        .med-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .med-header h3 {
            margin: 0;
            font-size: 12pt;
            color: #1F2937;
        }
        
        .compliance {
            font-size: 9pt;
            color: #6B7280;
            font-weight: normal;
        }
        
        .med-details {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        
        .med-detail {
            font-size: 9pt;
            color: #374151;
        }
        
        .custom-state-item {
            background-color: #F9FAFB;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            border-left: 4px solid #9333EA;
        }
        
        .custom-state-item h3 {
            margin: 0 0 10px 0;
            font-size: 12pt;
            color: #1F2937;
        }
        
        .state-values {
            font-size: 9pt;
            color: #6B7280;
        }
        
        .notes-container {
            margin-top: 15px;
        }
        
        .note-item {
            background-color: #F9FAFB;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            border-left: 4px solid #F59E0B;
            page-break-inside: avoid;
        }
        
        .note-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .note-date {
            font-size: 10pt;
            font-weight: bold;
            color: #1F2937;
        }
        
        .important-badge {
            background-color: #DC2626;
            color: white;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 8pt;
            font-weight: bold;
        }
        
        .note-content {
            font-size: 10pt;
            color: #374151;
            line-height: 1.6;
            white-space: pre-wrap;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #E5E7EB;
            text-align: center;
            color: #6B7280;
            font-size: 9pt;
            page-break-inside: avoid;
        }
        
        .footer p {
            margin: 5px 0;
        }
        '''

