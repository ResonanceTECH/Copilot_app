from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base


class MessageFeedback(Base):
    """Модель обратной связи по сообщениям ассистента"""
    __tablename__ = "message_feedback"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Причины обратной связи (JSON массив строк)
    reasons = Column(JSON, nullable=False)  # ['inaccurate', 'wrong_context', 'too_short', etc.]
    
    # Дополнительный текст обратной связи
    feedback_text = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    message = relationship("Message", lazy="select")
    user = relationship("User", lazy="select")
    chat = relationship("Chat", lazy="select")

    def __repr__(self):
        return f"<MessageFeedback(id={self.id}, message_id={self.message_id}, reasons={self.reasons})>"

