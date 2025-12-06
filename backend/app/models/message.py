from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base
from backend.app.models.message_tag import message_tags


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
    file_attachments = relationship("FileAttachment", back_populates="message", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=message_tags, back_populates="messages", lazy="select")

    def __repr__(self):
        return f"<Message(id={self.id}, role={self.role}, chat_id={self.chat_id})>"

