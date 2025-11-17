from sqlalchemy.orm import Session
from backend.app.models.notification import Notification
from backend.app.models.notification_settings import NotificationSettings


def create_notification(
    db: Session,
    user_id: int,
    space_id: int,
    notification_type: str,
    title: str,
    message: str = None
) -> Notification:
    """
    Создать уведомление для пользователя
    
    Args:
        db: Сессия БД
        user_id: ID пользователя
        space_id: ID пространства
        notification_type: Тип уведомления ('new_message', 'new_note', 'new_file')
        title: Заголовок уведомления
        message: Текст уведомления (опционально)
    
    Returns:
        Созданное уведомление или None, если уведомления отключены
    """
    # Проверяем настройки уведомлений для пространства
    settings = db.query(NotificationSettings).filter(
        NotificationSettings.space_id == space_id
    ).first()
    
    # Проверяем, включены ли уведомления для данного типа
    if settings and settings.settings_json:
        setting_key = notification_type
        # Проверяем, включены ли уведомления для этого типа
        if setting_key in settings.settings_json and not settings.settings_json.get(setting_key, True):
            # Уведомления для этого типа отключены
            print(f"⚠️ Уведомления типа '{notification_type}' отключены для пространства {space_id}")
            return None
    
    # Создаем уведомление
    try:
        notification = Notification(
            user_id=user_id,
            space_id=space_id,
            notification_type=notification_type,
            title=title,
            message=message
        )
        
        db.add(notification)
        db.commit()
        db.refresh(notification)
        
        print(f"✅ Создано уведомление: {title} (user_id={user_id}, space_id={space_id})")
        return notification
    except Exception as e:
        print(f"❌ Ошибка создания уведомления: {e}")
        db.rollback()
        return None


def create_message_notification(
    db: Session,
    user_id: int,
    space_id: int,
    chat_title: str = None
) -> Notification:
    """Создать уведомление о новом сообщении"""
    title = "Новое сообщение"
    if chat_title:
        title = f"Новое сообщение в чате: {chat_title}"
    
    return create_notification(
        db=db,
        user_id=user_id,
        space_id=space_id,
        notification_type="new_message",
        title=title,
        message="У вас новое сообщение в чате"
    )


def create_note_notification(
    db: Session,
    user_id: int,
    space_id: int,
    note_title: str
) -> Notification:
    """Создать уведомление о новой заметке"""
    return create_notification(
        db=db,
        user_id=user_id,
        space_id=space_id,
        notification_type="new_note",
        title=f"Новая заметка: {note_title}",
        message=f"Создана новая заметка '{note_title}'"
    )

