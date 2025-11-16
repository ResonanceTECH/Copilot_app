from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base


class Chat(Base):
    """Модель чата"""
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    space_id = Column(Integer, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    space = relationship("Space", back_populates="chats")
    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan", order_by="Message.created_at")

    def __repr__(self):
        return f"<Chat(id={self.id}, title={self.title}, space_id={self.space_id})>"

