"""
Конфигурация и фикстуры для тестов
"""
import os
import sys
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Устанавливаем переменные окружения ДО импорта приложения
# Это важно, так как некоторые модули читают их при импорте
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("USE_OLLAMA", "false")
os.environ.setdefault("USE_WHISPER_CONTAINER", "false")
os.environ.setdefault("USE_WHISPER_API", "false")
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("OPENROUTER_API_KEY", "")
os.environ.setdefault("LLM_REQUEST_TIMEOUT", "120.0")
os.environ.setdefault("LLM_CONNECT_TIMEOUT", "30.0")
os.environ.setdefault("APP_URL", "http://localhost")

# Добавляем корневую директорию проекта в PYTHONPATH
# Это позволяет импортировать модули как 'backend.app...'
# __file__ = backend/tests/conftest.py
# backend_dir = backend/
# project_root = Copilot_app/ (корень проекта)
backend_dir = Path(__file__).parent.parent.resolve()  # backend/ (абсолютный путь)
project_root = backend_dir.parent.resolve()  # Copilot_app/ (абсолютный путь)

# Добавляем корень проекта, чтобы Python мог найти модуль 'backend'
project_root_str = str(project_root)
if project_root_str not in sys.path:
    sys.path.insert(0, project_root_str)

from backend.app.database.base import Base
from backend.app.database.connection import get_db
from backend.main import app


# Тестовая база данных в памяти
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Создает тестовую сессию БД для каждого теста
    
    После каждого теста:
    - Откатывает все незакоммиченные транзакции
    - Закрывает сессию
    - Удаляет все таблицы из БД
    """
    # Создаем все таблицы перед тестом
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        # Откатываем все незакоммиченные изменения
        db.rollback()
        # Закрываем сессию
        db.close()
        # Удаляем все таблицы (очистка БД)
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session, mock_env_vars):
    """Создает тестовый клиент FastAPI с переопределенной зависимостью БД"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Тестовые данные пользователя"""
    return {
        "email": "test@example.com",
        "password": "testpassword123",
        "name": "Test User",
        "company_name": "Test Company"
    }


@pytest.fixture
def test_user(db_session, test_user_data):
    """Создает тестового пользователя в БД"""
    from backend.app.models.user import User
    from backend.app.services.auth_service import get_password_hash
    
    user = User(
        email=test_user_data["email"],
        password_hash=get_password_hash(test_user_data["password"]),
        name=test_user_data["name"],
        company_name=test_user_data["company_name"],
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, test_user_data):
    """Получает токены авторизации для тестового пользователя"""
    # Регистрируем пользователя
    response = client.post("/api/auth/register", json=test_user_data)
    if response.status_code == 201:
        tokens = response.json()
        if "access_token" in tokens:
            return {"Authorization": f"Bearer {tokens['access_token']}"}
    
    # Если регистрация не удалась или пользователь уже существует, логинимся
    response = client.post("/api/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"]
    })
    if response.status_code == 200:
        tokens = response.json()
        if "access_token" in tokens:
            return {"Authorization": f"Bearer {tokens['access_token']}"}
    
    # Если ничего не сработало, создаем токен напрямую
    from backend.app.services.auth_service import create_access_token
    token = create_access_token(data={"sub": str(1)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def mock_env_vars(monkeypatch):
    """Мокирует переменные окружения для тестов"""
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-testing-only")
    monkeypatch.setenv("USE_OLLAMA", "false")
    monkeypatch.setenv("USE_WHISPER_CONTAINER", "false")
    monkeypatch.setenv("USE_WHISPER_API", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    monkeypatch.setenv("LLM_REQUEST_TIMEOUT", "120.0")
    monkeypatch.setenv("LLM_CONNECT_TIMEOUT", "30.0")
    monkeypatch.setenv("APP_URL", "http://localhost")


@pytest.fixture(scope="function", autouse=True)
def clear_cache():
    """Автоматически очищает кэш после каждого теста
    
    CacheService использует in-memory словарь, который автоматически
    очищается при завершении теста. Эта фикстура обеспечивает явную очистку.
    """
    yield
    
    # После теста: CacheService создается заново в каждом тесте,
    # поэтому его кэш автоматически очищается. Но если нужно явно
    # очистить глобальные экземпляры, это можно сделать здесь.


@pytest.fixture(scope="session", autouse=True)
def cleanup_after_all_tests():
    """Фикстура для финальной очистки после всех тестов
    
    Выполняется автоматически (autouse=True) после завершения всех тестов.
    Обеспечивает полную очистку всех ресурсов.
    """
    yield
    
    # После всех тестов выполняем финальную очистку:
    # 1. Удаляем все таблицы из БД (на всякий случай)
    try:
        Base.metadata.drop_all(bind=engine)
    except Exception:
        pass  # Игнорируем ошибки, если таблицы уже удалены
    
    # 2. Закрываем соединение с БД
    try:
        engine.dispose()
    except Exception:
        pass  # Игнорируем ошибки при закрытии
    
    # 3. Очищаем dependency overrides в app
    app.dependency_overrides.clear()
    
    print("\n✅ Все тесты завершены, данные очищены")
