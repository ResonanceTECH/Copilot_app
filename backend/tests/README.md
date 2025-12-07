# Тесты для Backend

Этот каталог содержит unit-тесты для backend приложения.

## Важно: Контейнеры НЕ требуются

Это позволяет запускать тесты быстро и независимо от инфраструктуры.

## Структура

```
tests/
├── __init__.py
├── conftest.py                    # Фикстуры и конфигурация pytest
├── test_auth_service.py           # Тесты для auth_service
├── test_cache_service.py          # Тесты для cache_service
├── test_conversation_manager.py   # Тесты для conversation_manager
├── test_formatting_service.py     # Тесты для formatting_service
├── test_llm_service.py            # Тесты для llm_service
└── test_notification_service.py   # Тесты для notification_service
```

## Запуск тестов

### Важно: Путь к проекту
Вы можете запускать тесты из директории `backend`:

По идее сначала нужно прописать из директории backend:
```shell
pip install -r requirements.txt
```

### Все тесты
```bash
cd backend
python -m pytest
# или просто (у меня просто не стоит виртуальное окружение)
pytest
```

### Конкретный файл
```bash
cd backend
python -m pytest tests/test_auth_service.py
```

### Конкретный тест
```bash
cd backend
python -m pytest tests/test_auth_service.py::TestPasswordHashing::test_get_password_hash
```

### С подробным выводом
```bash
cd backend
python -m pytest -v
```

## Покрытие

Тесты покрывают (70+ тестовых функций):

### Сервисы
- ✅ **auth_service**: JWT токены, хеширование паролей
- ✅ **cache_service**: Кэширование ответов
- ✅ **conversation_manager**: Управление беседами
- ✅ **formatting_service**: Форматирование текста в HTML
- ✅ **llm_service**: Работа с LLM, транскрибация, анализ изображений (с моками)
- ✅ **notification_service**: Создание и управление уведомлениями

## Зависимости

Для запуска тестов по идее можно обойтись и этими зависимостями:
- `pytest>=7.4.0`
- `pytest-asyncio>=0.21.0`
- `fastapi`
- `unittest.mock`
