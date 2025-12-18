/**
 * Основной JavaScript файл для приложения Affecta
 * Проект для защиты - студент 20 лет
 */

document.addEventListener('DOMContentLoaded', function() {
    setupSliders();
    setupForms();
    setupAutoHideMessages();
});

function setupSliders() {
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const valueDisplay = document.getElementById(slider.id + '-value');
        if (valueDisplay) {
            slider.addEventListener('input', function() {
                valueDisplay.textContent = this.value;
            });
            valueDisplay.textContent = slider.value;
        }
    });
}

function setupForms() {
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.classList.add('border-red-500');
                    isValid = false;
                } else {
                    field.classList.remove('border-red-500');
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                showMessage('Заполните все обязательные поля', 'error');
            }
        });
    });
}

function setupAutoHideMessages() {
    document.querySelectorAll('.alert').forEach(message => {
        setTimeout(() => {
            message.style.transition = 'opacity 0.5s ease-out';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 500);
        }, 5000);
    });
}

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    const color = type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue';
    messageDiv.className = `alert alert-${type} bg-${color}-100 border border-${color}-400 text-${color}-700 px-4 py-3 rounded mb-4`;
    messageDiv.innerHTML = `<span class="block sm:inline">${message}</span>`;
    
    const container = document.querySelector('main');
    if (container) {
        container.insertBefore(messageDiv, container.firstChild);
        setTimeout(() => {
            messageDiv.style.transition = 'opacity 0.5s ease-out';
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 500);
        }, 5000);
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getMoodColor(mood) {
    if (mood >= 7) return 'text-green-600';
    if (mood >= 4) return 'text-yellow-600';
    return 'text-red-600';
}

function getDayTypeColor(dayType) {
    const colors = {
        'depressive': 'bg-red-100 text-red-800',
        'normal': 'bg-green-100 text-green-800',
        'hypomanic': 'bg-yellow-100 text-yellow-800',
        'mixed': 'bg-purple-100 text-purple-800'
    };
    return colors[dayType] || 'bg-gray-100 text-gray-800';
}

function toggleElement(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = show ? 'block' : 'none';
}

function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        form.querySelectorAll('input[type="range"]').forEach(slider => {
            const valueDisplay = document.getElementById(slider.id + '-value');
            if (valueDisplay) valueDisplay.textContent = slider.value;
        });
    }
}

window.StabilUtils = {
    showMessage,
    formatDate,
    getMoodColor,
    getDayTypeColor,
    toggleElement,
    clearForm
};