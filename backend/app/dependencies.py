from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.database.connection import get_db
from backend.app.models.user import User
from backend.app.services.auth_service import verify_token

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency для получения текущего пользователя из JWT токена.
    Использование:
        @router.get("/protected")
        def protected_route(current_user: User = Depends(get_current_user)):
            ...
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверные учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = verify_token(token, token_type="access")
    
    if payload is None:
        raise credentials_exception
    
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # Преобразуем user_id в int, если это строка
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь неактивен"
        )
    
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Dependency для получения текущего пользователя (опционально).
    Не выбрасывает исключение, если токен отсутствует или неверен.
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = verify_token(token, token_type="access")
        
        if payload is None:
            return None
        
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        # Преобразуем user_id в int, если это строка
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            return None
        
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.is_active:
            return user
    except Exception:
        pass
    
    return None

