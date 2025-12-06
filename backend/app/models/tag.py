from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base
from backend.app.models.note_tag import note_tags
from backend.app.models.message_tag import message_tags


class Tag(Base):
    """Модель тега"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    space_id = Column(Integer, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=True)  # HEX цвет, например #FF5733
    tag_type = Column(String(50), nullable=True)  # Тип тега (например, 'category', 'priority', etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    space = relationship("Space", back_populates="tags")
    notes = relationship("Note", secondary=note_tags, back_populates="tags")
    messages = relationship("Message", secondary=message_tags, back_populates="tags", lazy="select")

    def __repr__(self):
        return f"<Tag(id={self.id}, name={self.name}, space_id={self.space_id})>"

