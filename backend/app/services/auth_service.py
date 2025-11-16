import os
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

# JWT настройки
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


def get_password_hash(password: str) -> str:
    """Простое хеширование пароля через SHA256"""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    return get_password_hash(plain_password) == hashed_password


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Создание JWT токена доступа"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"✅ Создан access токен для user_id={data.get('sub')}, expires={expire}")
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Создание refresh токена"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"✅ Создан refresh токен для user_id={data.get('sub')}, expires={expire}")
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Декодирование JWT токена"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        # Логируем ошибку для отладки
        print(f"❌ JWT Error: {type(e).__name__}: {str(e)}")
        return None


def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """Проверка токена и его типа"""
    if not token:
        print("❌ Токен пустой")
        return None
    
    payload = decode_token(token)
    if payload is None:
        print(f"❌ Не удалось декодировать токен (тип: {token_type})")
        return None
    
    token_type_in_payload = payload.get("type")
    if token_type_in_payload != token_type:
        print(f"❌ Неверный тип токена: ожидается '{token_type}', получен '{token_type_in_payload}'")
        return None
    
    print(f"✅ Токен валидный (тип: {token_type}, user_id: {payload.get('sub')})")
    return payload

