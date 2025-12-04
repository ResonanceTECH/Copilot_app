from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.database.connection import get_db
from backend.app.models.user import User
from backend.app.dependencies import get_current_user

router = APIRouter()


class UserProfileResponse(BaseModel):
    id: int
    email: str
    name: str
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    """Получение профиля текущего пользователя"""
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        phone=current_user.phone,
        company_name=current_user.company_name,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else ""
    )


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление профиля пользователя"""
    # Обновляем только переданные поля
    if profile_data.name is not None:
        current_user.name = profile_data.name
    if profile_data.avatar_url is not None:
        current_user.avatar_url = profile_data.avatar_url
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone
    if profile_data.company_name is not None:
        current_user.company_name = profile_data.company_name
    
    db.commit()
    db.refresh(current_user)
    
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        phone=current_user.phone,
        company_name=current_user.company_name,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else ""
    )


class ReferralInfoResponse(BaseModel):
    referral_code: str
    referral_link: str
    referrals_count: int


class ReferrerInfoResponse(BaseModel):
    name: str
    referral_code: str


@router.get("/referral", response_model=ReferralInfoResponse)
async def get_referral_info(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение реферальной информации текущего пользователя"""
    # Убеждаемся, что у пользователя есть реферальный код
    if not current_user.referral_code:
        print(f"Генерируем реферальный код для пользователя {current_user.id}")
        current_user.generate_referral_code()
        db.commit()
        db.refresh(current_user)
        print(f"Сгенерирован код: {current_user.referral_code}")
    
    if not current_user.referral_code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сгенерировать реферальный код"
        )
    
    # Формируем реферальную ссылку используя текущий домен
    # Получаем схему и хост из запроса
    scheme = request.url.scheme
    host = request.headers.get("host", "localhost:3000")
    # Если это API запрос, заменяем порт на фронтенд порт
    if ":8000" in host or "api" in host:
        # В dev режиме фронтенд обычно на 3000
        host = host.replace(":8000", ":3000").replace("api", "localhost:3000")
    
    base_url = f"{scheme}://{host}"
    referral_link = f"{base_url}/register?ref={current_user.referral_code}"
    
    print(f"Возвращаем реферальную информацию: код={current_user.referral_code}, ссылка={referral_link}")
    
    return ReferralInfoResponse(
        referral_code=current_user.referral_code,
        referral_link=referral_link,
        referrals_count=current_user.referrals_count or 0
    )


@router.get("/referral/check/{referral_code}", response_model=ReferrerInfoResponse)
async def check_referral_code(
    referral_code: str,
    db: Session = Depends(get_db)
):
    """Проверка реферального кода и получение информации о пригласившем"""
    referrer = db.query(User).filter(User.referral_code == referral_code).first()
    
    if not referrer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Реферальный код не найден"
        )
    
    return ReferrerInfoResponse(
        name=referrer.name,
        referral_code=referrer.referral_code
    )
