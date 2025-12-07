"""
Тесты для notification_service
"""
import pytest
from backend.app.services.notification_service import (
    create_notification,
    create_message_notification,
    create_note_notification
)
from backend.app.models.notification import Notification
from backend.app.models.notification_settings import NotificationSettings
from backend.app.models.space import Space


class TestNotificationService:
    """Тесты для сервиса уведомлений"""
    
    def test_create_notification_success(self, db_session, test_user):
        """Тест успешного создания уведомления"""
        space = Space(
            user_id=test_user.id,
            name="Test Space"
        )
        db_session.add(space)
        db_session.commit()
        
        notification = create_notification(
            db=db_session,
            user_id=test_user.id,
            space_id=space.id,
            notification_type="new_message",
            title="Test Notification",
            message="Test message"
        )
        
        assert notification is not None
        assert notification.user_id == test_user.id
        assert notification.space_id == space.id
        assert notification.notification_type == "new_message"
        assert notification.title == "Test Notification"
        assert notification.message == "Test message"
        assert notification.is_read == False
    
    def test_create_notification_without_message(self, db_session, test_user):
        """Тест создания уведомления без сообщения"""
        space = Space(
            user_id=test_user.id,
            name="Test Space"
        )
        db_session.add(space)
        db_session.commit()
        
        notification = create_notification(
            db=db_session,
            user_id=test_user.id,
            space_id=space.id,
            notification_type="new_note",
            title="Test Notification"
        )
        
        assert notification is not None
        assert notification.message is None
    
    def test_create_notification_disabled(self, db_session, test_user):
        """Тест что уведомление не создается если отключено в настройках"""
        space = Space(
            user_id=test_user.id,
            name="Test Space"
        )
        db_session.add(space)
        db_session.commit()
        
        # Создаем настройки с отключенными уведомлениями
        settings = NotificationSettings(
            space_id=space.id,
            user_id=test_user.id,
            settings_json={"new_message": False}
        )
        db_session.add(settings)
        db_session.commit()
        
        notification = create_notification(
            db=db_session,
            user_id=test_user.id,
            space_id=space.id,
            notification_type="new_message",
            title="Test Notification"
        )
        
        assert notification is None
    
    def test_create_notification_enabled_in_settings(self, db_session, test_user):
        """Тест что уведомление создается если включено в настройках"""
        space = Space(
            user_id=test_user.id,
            name="Test Space"
        )
        db_session.add(space)
        db_session.commit()
        
        # Создаем настройки с включенными уведомлениями
        settings = NotificationSettings(
            space_id=space.id,
            user_id=test_user.id,
            settings_json={"new_message": True}
        )
        db_session.add(settings)
        db_session.commit()
        
        notification = create_notification(
            db=db_session,
            user_id=test_user.id,
            space_id=space.id,
            notification_type="new_message",
            title="Test Notification"
        )
        
        assert notification is not None
    
    def test_create_message_notification(self, db_session, test_user):
        """Тест создания уведомления о сообщении"""
        space = Space(
            user_id=test_user.id,
            name="Test Space"
        )
        db_session.add(space)
        db_session.commit()
        
        notification = create_message_notification(
            db=db_session,
            user_id=test_user.id,
            space_id=space.id,
            chat_title="Test Chat"
        )
        
        assert notification is not None
        assert notification.notification_type == "new_message"
        assert "Test Chat" in notification.title
        assert notification.message == "У вас новое сообщение в чате"
    
    def test_create_message_notification_without_chat_title(self, db_session, test_user):
        """Тест создания уведомления о сообщении без названия чата"""
        space = Space(
            user_id=test_user.id,
            name="Test Space"
        )
        db_session.add(space)
        db_session.commit()
        
        notification = create_message_notification(
            db=db_session,
            user_id=test_user.id,
            space_id=space.id
        )
        
        assert notification is not None
        assert notification.title == "Новое сообщение"
    
    def test_create_note_notification(self, db_session, test_user):
        """Тест создания уведомления о заметке"""
        space = Space(
            user_id=test_user.id,
            name="Test Space"
        )
        db_session.add(space)
        db_session.commit()
        
        notification = create_note_notification(
            db=db_session,
            user_id=test_user.id,
            space_id=space.id,
            note_title="Test Note"
        )
        
        assert notification is not None
        assert notification.notification_type == "new_note"
        assert "Test Note" in notification.title
        assert "Создана новая заметка" in notification.message
