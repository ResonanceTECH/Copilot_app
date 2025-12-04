from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base
import secrets


class User(Base):
    """Модель пользователя"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    
    # Дополнительные поля профиля
    avatar_url = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    
    # Реферальная система
    referral_code = Column(String(32), unique=True, nullable=True, index=True)
    referred_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    referrals_count = Column(Integer, default=0, nullable=False)
    
    # Метаданные
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    spaces = relationship("Space", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    
    # Реферальные связи
    referred_by = relationship("User", remote_side=[id], foreign_keys=[referred_by_id])

    def generate_referral_code(self):
        """Генерирует уникальный реферальный код"""
        if not self.referral_code:
            # Используем комбинацию ID и случайной строки для уникальности
            code = f"ref_{self.id}_{secrets.token_urlsafe(8)}"
            self.referral_code = code[:32]  # Ограничиваем длину
        return self.referral_code

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, name={self.name})>"

