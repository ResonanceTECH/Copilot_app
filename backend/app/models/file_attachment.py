from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.database.base import Base


class FileAttachment(Base):
    """Модель вложенных файлов (PDF, DOC, изображения)"""
    __tablename__ = "file_attachments"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=True, index=True)
    space_id = Column(Integer, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Информация о файле
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Путь в папке assets
    file_type = Column(String(50), nullable=False)  # pdf, doc, docx, image/png, image/jpeg и т.д.
    file_size = Column(BigInteger, nullable=False)  # Размер в байтах
    mime_type = Column(String(100), nullable=True)
    
    # Анализ файла
    extracted_text = Column(Text, nullable=True)  # Извлеченный текст из PDF/DOC
    analysis_result = Column(Text, nullable=True)  # Результат анализа через LLM (для изображений)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    message = relationship("Message", back_populates="file_attachments")
    chat = relationship("Chat", back_populates="file_attachments")
    space = relationship("Space", back_populates="file_attachments")
    user = relationship("User", back_populates="file_attachments")

    def __repr__(self):
        return f"<FileAttachment(id={self.id}, filename={self.filename}, file_type={self.file_type})>"

