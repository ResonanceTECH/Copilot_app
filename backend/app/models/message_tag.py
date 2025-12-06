from sqlalchemy import Column, Integer, ForeignKey, Table
from backend.app.database.base import Base

# Промежуточная таблица для many-to-many связи Message-Tag
message_tags = Table(
    "message_tags",
    Base.metadata,
    Column("message_id", Integer, ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

