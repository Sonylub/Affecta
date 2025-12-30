"""
Фабрика CRUD маршрутов для устранения дублирования кода
"""

from flask import request
from flask_login import current_user


def validate_required(data, required_fields):
    """Валидация обязательных полей"""
    for field in required_fields:
        if not data.get(field):
            if field == 'name':
                raise ValueError(f'Введите название')
            raise ValueError(f'Не указано обязательное поле: {field}')


def create_crud_routes(bp, resource_name, model_methods, required_fields, decorators=None):
    """
    Фабрика для создания CRUD маршрутов
    
    Args:
        bp: Flask Blueprint
        resource_name: Имя ресурса (например, 'medication', 'custom_state')
        model_methods: dict с методами {'create': func, 'update': func, 'delete': func}
        required_fields: list обязательных полей для создания/обновления
        decorators: list дополнительных декораторов (например, @api_route)
    
    Пример использования:
        create_crud_routes(bp, 'medication', {
            'create': lambda data: db.create_medication(current_user.id, **data),
            'update': lambda data: db.update_medication(data['id'], current_user.id, **data),
            'delete': lambda item_id: db.delete_medication(item_id, current_user.id)
        }, ['name'], decorators=[login_required, api_route])
    """
    
    decorators = decorators or []
    
    def apply_decorators(func):
        """Применить декораторы к функции"""
        for decorator in reversed(decorators):
            func = decorator(func)
        return func
    
    # Маршрут добавления
    @bp.route(f'/add_{resource_name}', methods=['POST'])
    @apply_decorators
    def add():
        data = request.json
        validate_required(data, required_fields)
        
        result = model_methods['create'](data)
        
        return {
            'message': f'{resource_name.capitalize()} добавлен',
            resource_name: result if isinstance(result, dict) else {'id': result, **data}
        }
    
    # Уникальные имена функций
    add.__name__ = f'add_{resource_name}'
    
    # Маршрут обновления
    @bp.route(f'/update_{resource_name}', methods=['POST'])
    @apply_decorators
    def update():
        data = request.json
        
        # Определяем ключ ID (может быть 'id', 'med_id', 'state_id' и т.д.)
        id_key = f'{resource_name}_id' if f'{resource_name}_id' in data else 'id'
        if id_key == 'id' and 'id' not in data:
            # Пробуем специфичные ключи
            for key in [f'{resource_name}_id', 'med_id', 'state_id', 'tracker_id']:
                if key in data:
                    id_key = key
                    break
        
        validate_required(data, required_fields + [id_key])
        
        model_methods['update'](data)
        
        return {
            'message': f'{resource_name.capitalize()} обновлен',
            resource_name: data
        }
    
    update.__name__ = f'update_{resource_name}'
    
    # Маршрут удаления
    @bp.route(f'/delete_{resource_name}', methods=['POST'])
    @apply_decorators
    def delete():
        data = request.json
        
        # Определяем ключ ID
        id_key = f'{resource_name}_id' if f'{resource_name}_id' in data else 'id'
        if id_key == 'id' and 'id' not in data:
            for key in [f'{resource_name}_id', 'med_id', 'state_id', 'tracker_id']:
                if key in data:
                    id_key = key
                    break
        
        if not data.get(id_key):
            raise ValueError(f'Не указан идентификатор {resource_name}')
        
        model_methods['delete'](data[id_key])
        
        return {'message': f'{resource_name.capitalize()} удален'}
    
    delete.__name__ = f'delete_{resource_name}'

