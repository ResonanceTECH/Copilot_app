from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base


class Feedback(Base):
    """Модель обратной связи/отзыва"""
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    email = Column(String(255), nullable=True)  # Email для неавторизованных пользователей
    name = Column(String(255), nullable=True)  # Имя для неавторизованных пользователей
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    feedback_type = Column(String(50), nullable=True)  # 'bug', 'feature', 'question', 'other'
    status = Column(String(20), default='new')  # 'new', 'read', 'resolved'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<Feedback(id={self.id}, subject={self.subject}, user_id={self.user_id})>"

