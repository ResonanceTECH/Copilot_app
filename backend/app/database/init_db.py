"""
Скрипт для инициализации базы данных через SQL-скрипты.
Запуск: python -m backend.app.database.init_db
"""
from backend.app.database.connection import init_db

if __name__ == "__main__":
    print("🚀 Инициализация базы данных...")
    init_db()
    print("✅ Готово!")

