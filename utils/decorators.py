"""
Декораторы для обработки API маршрутов
"""

from functools import wraps
from flask import jsonify


def api_route(f):
    """
    Декоратор для API маршрутов с автоматической обработкой ошибок
    
    Использование:
        @bp.route('/api/endpoint', methods=['POST'])
        @login_required
        @api_route
        def my_endpoint():
            # ... бизнес-логика ...
            return {'message': 'Успешно', 'data': result}
    
    Декоратор автоматически:
    - Оборачивает результат в jsonify с success: True
    - Обрабатывает ValueError (возвращает 400)
    - Обрабатывает все другие исключения (возвращает 500)
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            result = f(*args, **kwargs)
            
            # Если функция уже вернула Response объект, возвращаем как есть
            if hasattr(result, 'status_code'):
                return result
            
            # Если функция вернула dict, оборачиваем в jsonify с success: True
            if isinstance(result, dict):
                return jsonify({'success': True, **result})
            
            # Если функция вернула tuple (response, status_code), обрабатываем
            if isinstance(result, tuple):
                data, status_code = result
                if isinstance(data, dict):
                    return jsonify({'success': True, **data}), status_code
                return result
            
            # В остальных случаях возвращаем как есть
            return result
            
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    
    return decorated_function

