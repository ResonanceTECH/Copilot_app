from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base
import secrets


class Space(Base):
    """Модель рабочего пространства"""
    __tablename__ = "spaces"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, index=True)
    # Поля для публичного доступа
    is_public = Column(Boolean, default=False, index=True)
    public_token = Column(String(64), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="spaces")
    chats = relationship("Chat", back_populates="space", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="space", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="space", cascade="all, delete-orphan")
    notification_settings = relationship("NotificationSettings", back_populates="space", uselist=False, cascade="all, delete-orphan")

    def generate_public_token(self):
        """Генерирует уникальный токен для публичного доступа"""
        if not self.public_token:
            self.public_token = secrets.token_urlsafe(32)
        return self.public_token

    def __repr__(self):
        return f"<Space(id={self.id}, name={self.name}, user_id={self.user_id})>"

