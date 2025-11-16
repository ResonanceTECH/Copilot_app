from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from backend.app.database.base import Base


class SupportArticle(Base):
    """Модель справочной статьи"""
    __tablename__ = "support_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)  # 'getting_started', 'features', 'troubleshooting', etc.
    order = Column(Integer, default=0)  # Порядок отображения
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SupportArticle(id={self.id}, title={self.title})>"

