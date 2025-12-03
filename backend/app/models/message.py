from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base


class Message(Base):
    """Модель сообщения в чате"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user' или 'assistant'
    content = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)  # Ссылка на изображение для графиков
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    chat = relationship("Chat", back_populates="messages")

    def __repr__(self):
        return f"<Message(id={self.id}, role={self.role}, chat_id={self.chat_id})>"

