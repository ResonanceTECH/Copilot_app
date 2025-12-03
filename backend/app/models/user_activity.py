from sqlalchemy import Column, Integer, Date, DateTime, func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base


class UserActivity(Base):
    """Модель активности пользователя для аналитики эффективности"""
    __tablename__ = "user_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    activity_date = Column(Date, nullable=False, index=True)
    message_count = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<UserActivity(id={self.id}, user_id={self.user_id}, date={self.activity_date}, count={self.message_count})>"

