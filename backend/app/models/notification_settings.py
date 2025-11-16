from sqlalchemy import Column, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database.base import Base


class NotificationSettings(Base):
    """Модель настроек уведомлений для пространства"""
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    space_id = Column(Integer, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    settings_json = Column(JSON, nullable=True)  # JSON с настройками уведомлений

    # Relationships
    space = relationship("Space", back_populates="notification_settings")
    user = relationship("User")

    def __repr__(self):
        return f"<NotificationSettings(id={self.id}, space_id={self.space_id})>"

