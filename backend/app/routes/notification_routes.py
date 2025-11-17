from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.app.database.connection import get_db
from backend.app.models.user import User
from backend.app.models.notification import Notification
from backend.app.models.notification_settings import NotificationSettings
from backend.app.dependencies import get_current_user

router = APIRouter()


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    space_id: Optional[int]
    notification_type: str
    title: str
    message: Optional[str]
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список уведомлений пользователя"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc())
    
    total = query.count()
    notifications = query.offset(offset).limit(limit).all()
    
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                user_id=n.user_id,
                space_id=n.space_id,
                notification_type=n.notification_type,
                title=n.title,
                message=n.message,
                is_read=n.is_read,
                created_at=n.created_at.isoformat() if n.created_at else ""
            )
            for n in notifications
        ],
        total=total,
        unread_count=unread_count
    )


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отметить уведомление как прочитанное"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Уведомление не найдено"
        )
    
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    
    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        space_id=notification.space_id,
        notification_type=notification.notification_type,
        title=notification.title,
        message=notification.message,
        is_read=notification.is_read,
        created_at=notification.created_at.isoformat() if notification.created_at else ""
    )


@router.put("/read-all", response_model=dict)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отметить все уведомления как прочитанные"""
    updated = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    
    return {"updated_count": updated}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить уведомление"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Уведомление не найдено"
        )
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Уведомление удалено"}


@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить количество непрочитанных уведомлений"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return {"unread_count": count}


@router.post("/test", response_model=NotificationResponse)
async def create_test_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать тестовое уведомление (для отладки)"""
    from backend.app.models.space import Space
    from backend.app.services.notification_service import create_notification
    
    # Получаем первое пространство пользователя или создаем дефолтное
    space = db.query(Space).filter(
        Space.user_id == current_user.id,
        Space.is_archived == False
    ).first()
    
    if not space:
        from backend.app.routes.chat_routes import get_or_create_default_space
        space = get_or_create_default_space(current_user, db)
    
    notification = create_notification(
        db=db,
        user_id=current_user.id,
        space_id=space.id,
        notification_type="new_note",
        title="Тестовое уведомление",
        message="Это тестовое уведомление для проверки системы"
    )
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать уведомление"
        )
    
    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        space_id=notification.space_id,
        notification_type=notification.notification_type,
        title=notification.title,
        message=notification.message,
        is_read=notification.is_read,
        created_at=notification.created_at.isoformat() if notification.created_at else ""
    )

