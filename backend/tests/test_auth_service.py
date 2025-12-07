"""
Тесты для auth_service
"""
import pytest
from datetime import timedelta
from backend.app.services.auth_service import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_token
)


class TestPasswordHashing:
    """Тесты для хеширования паролей"""
    
    def test_get_password_hash(self):
        """Тест создания хеша пароля"""
        password = "test_password_123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        # Хеш должен быть одинаковым для одного пароля
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex digest length
        assert isinstance(hash1, str)
    
    def test_verify_password_correct(self):
        """Тест проверки правильного пароля"""
        password = "test_password_123"
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """Тест проверки неправильного пароля"""
        password = "test_password_123"
        wrong_password = "wrong_password"
        hashed = get_password_hash(password)
        
        assert verify_password(wrong_password, hashed) is False
    
    def test_verify_password_empty(self):
        """Тест проверки пустого пароля"""
        password = ""
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True
        assert verify_password("not_empty", hashed) is False


class TestJWTTokens:
    """Тесты для JWT токенов"""
    
    def test_create_access_token(self, mock_env_vars):
        """Тест создания access токена"""
        data = {"sub": "123"}
        token = create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_create_refresh_token(self, mock_env_vars):
        """Тест создания refresh токена"""
        data = {"sub": "123"}
        token = create_refresh_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_decode_token_valid(self, mock_env_vars):
        """Тест декодирования валидного токена"""
        data = {"sub": "123", "test": "value"}
        token = create_access_token(data)
        
        payload = decode_token(token)
        
        assert payload is not None
        assert payload["sub"] == "123"
        assert payload["test"] == "value"
        assert "exp" in payload
        assert payload["type"] == "access"
    
    def test_decode_token_invalid(self, mock_env_vars):
        """Тест декодирования невалидного токена"""
        invalid_token = "invalid.token.here"
        
        payload = decode_token(invalid_token)
        
        assert payload is None
    
    def test_decode_token_empty(self, mock_env_vars):
        """Тест декодирования пустого токена"""
        payload = decode_token("")
        
        assert payload is None
    
    def test_verify_token_access(self, mock_env_vars):
        """Тест проверки access токена"""
        data = {"sub": "123"}
        token = create_access_token(data)
        
        payload = verify_token(token, token_type="access")
        
        assert payload is not None
        assert payload["sub"] == "123"
        assert payload["type"] == "access"
    
    def test_verify_token_refresh(self, mock_env_vars):
        """Тест проверки refresh токена"""
        data = {"sub": "123"}
        token = create_refresh_token(data)
        
        payload = verify_token(token, token_type="refresh")
        
        assert payload is not None
        assert payload["sub"] == "123"
        assert payload["type"] == "refresh"
    
    def test_verify_token_wrong_type(self, mock_env_vars):
        """Тест проверки токена с неправильным типом"""
        data = {"sub": "123"}
        access_token = create_access_token(data)
        
        # Пытаемся проверить access токен как refresh
        payload = verify_token(access_token, token_type="refresh")
        
        assert payload is None
    
    def test_verify_token_empty(self, mock_env_vars):
        """Тест проверки пустого токена"""
        payload = verify_token("", token_type="access")
        
        assert payload is None
    
    def test_token_expiration(self, mock_env_vars):
        """Тест истечения срока действия токена"""
        import time
        from datetime import timedelta
        
        data = {"sub": "123"}
        # Создаем токен с очень коротким сроком действия
        token = create_access_token(data, expires_delta=timedelta(seconds=1))
        
        # Токен должен быть валидным сразу
        payload = verify_token(token, token_type="access")
        assert payload is not None
        
        # Ждем истечения срока
        time.sleep(2)
        
        # Токен должен быть невалидным
        payload = decode_token(token)
        assert payload is None  # decode_token вернет None для истекшего токена
