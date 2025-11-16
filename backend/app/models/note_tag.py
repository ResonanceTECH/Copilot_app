from sqlalchemy import Column, Integer, ForeignKey, Table
from backend.app.database.base import Base

# Промежуточная таблица для many-to-many связи Note-Tag
note_tags = Table(
    "note_tags",
    Base.metadata,
    Column("note_id", Integer, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

