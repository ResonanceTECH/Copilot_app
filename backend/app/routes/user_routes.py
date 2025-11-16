from fastapi import APIRouter, Depends, HTTPException, status
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

