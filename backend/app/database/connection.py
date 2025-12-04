import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from dotenv import load_dotenv

from backend.app.database.base import Base

# Загружаем .env файл (но переменные из окружения имеют приоритет)
load_dotenv()

# Получаем DATABASE_URL из переменных окружения (приоритет у переменных окружения, не из .env)
# В Docker переменная DATABASE_URL задается в docker-compose.yml
DATABASE_URL = os.environ.get("DATABASE_URL")

# Если DATABASE_URL не задан в окружении, используем фиксированные значения для локальной разработки
if not DATABASE_URL:
    # Фиксированные значения для локальной разработки (без Docker)
    DATABASE_URL = "postgresql://copilot_user:copilot_pass@localhost:5431/copilot_db"

# Отладочный вывод
if DATABASE_URL:
    masked_url = DATABASE_URL.replace('copilot_pass', '***')
    print(f"🔍 DATABASE_URL: {masked_url}")
    # Проверяем имя базы данных
    if '/copilot_db' in DATABASE_URL:
        print("✅ Имя базы данных правильное: copilot_db")
    else:
        print(f"❌ ОШИБКА! В DATABASE_URL неправильное имя базы: {DATABASE_URL}")
else:
    print("❌ DATABASE_URL не задан!")

# Создаем движок SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Проверка соединения перед использованием
    pool_size=10,
    max_overflow=20,
    echo=os.getenv("SQL_ECHO", "False").lower() == "true"  # Логирование SQL запросов
)

# Создаем фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency для получения сессии БД в FastAPI эндпоинтах.
    Использование:
        @router.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Создание всех таблиц в БД через SQL-скрипты"""
    import os
    from pathlib import Path
    from sqlalchemy import text
    
    # Импортируем все модели, чтобы они были зарегистрированы в Base.metadata
    # Это нужно для fallback создания таблиц через SQLAlchemy
    from backend.app.models import (
        User, Space, Chat, Message, Note, Tag, NotificationSettings, Notification, note_tags,
        Feedback, SupportArticle, UserActivity
    )
    
    # Путь к SQL-скрипту
    sql_file = Path(__file__).parent / "init.sql"
    
    if not sql_file.exists():
        print(f"⚠️ SQL-скрипт не найден: {sql_file}")
        # Fallback: используем SQLAlchemy для создания таблиц
        Base.metadata.create_all(bind=engine)
        return
    
    # Читаем и выполняем SQL-скрипт
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_script = f.read()
    
    with engine.begin() as conn:
        # Выполняем весь скрипт целиком (DO $$ блоки должны выполняться целиком)
                try:
            conn.execute(text(sql_script))
                except Exception as e:
            # Игнорируем ошибки "уже существует" для CREATE TABLE IF NOT EXISTS и миграций
            error_str = str(e).lower()
            if ("already exists" in error_str or 
                "duplicate" in error_str or
                ("column" in error_str and "already exists" in error_str) or
                ("constraint" in error_str and "already exists" in error_str)):
                # Это нормально - миграция уже применена
                print(f"ℹ️  Миграции уже применены или частично применены")
            else:
                # Если это не ошибка "уже существует", пробуем выполнить по частям
                print(f"⚠️ Ошибка выполнения SQL целиком, пробуем по частям: {e}")
                # Разделяем на части по ; но сохраняем DO $$ блоки
                import re
                # Находим DO $$ блоки
                parts = []
                current_pos = 0
                for match in re.finditer(r'DO\s+\$\$.*?\$\$;', sql_script, re.DOTALL):
                    # Добавляем текст до блока
                    if match.start() > current_pos:
                        before = sql_script[current_pos:match.start()]
                        parts.extend([s.strip() for s in before.split(';') if s.strip()])
                    # Добавляем DO блок целиком
                    parts.append(match.group(0))
                    current_pos = match.end()
                # Добавляем оставшийся текст
                if current_pos < len(sql_script):
                    remaining = sql_script[current_pos:]
                    parts.extend([s.strip() for s in remaining.split(';') if s.strip()])
                
                # Выполняем каждую часть
                for part in parts:
                    if part:
                        try:
                            conn.execute(text(part))
                        except Exception as e2:
                            error_str2 = str(e2).lower()
                            if ("already exists" not in error_str2 and 
                                "duplicate" not in error_str2 and
                                "column" not in error_str2):
                                print(f"⚠️ Ошибка выполнения части SQL: {e2}")
    
    print("✅ База данных инициализирована через SQL-скрипты")


def drop_db():
    """Удаление всех таблиц из БД (осторожно!)"""
    from sqlalchemy import text
    
    with engine.begin() as conn:
        # Удаляем таблицы в правильном порядке (с учетом foreign keys)
        # Сначала удаляем зависимые таблицы
        conn.execute(text("DROP TABLE IF EXISTS note_tags CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS notifications CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS notification_settings CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS tags CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS notes CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS messages CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS chats CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS spaces CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.execute(text("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;"))
    
    print("⚠️ Все таблицы удалены из БД")

