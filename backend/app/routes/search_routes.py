from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import Optional, List, Literal
from datetime import datetime

from backend.app.database.connection import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.models.space import Space
from backend.app.models.chat import Chat
from backend.app.models.message import Message
from backend.app.models.note import Note

router = APIRouter()


# ========== Pydantic модели ==========

class SearchChatItem(BaseModel):
    id: int
    title: Optional[str]
    space_id: int
    space_name: str
    created_at: str
    updated_at: str
    snippet: Optional[str] = None  # Фрагмент с совпадением

    class Config:
        from_attributes = True


class SearchNoteItem(BaseModel):
    id: int
    title: str
    space_id: int
    space_name: str
    created_at: str
    updated_at: str
    snippet: Optional[str] = None  # Фрагмент с совпадением

    class Config:
        from_attributes = True


class SearchMessageItem(BaseModel):
    id: int
    chat_id: int
    chat_title: Optional[str]
    space_id: int
    space_name: str
    role: str
    content: str
    created_at: str
    snippet: Optional[str] = None  # Фрагмент с совпадением

    class Config:
        from_attributes = True


class SearchResults(BaseModel):
    query: str
    total: int
    results: dict  # Статистика по типам
    chats: List[SearchChatItem]
    notes: List[SearchNoteItem]
    messages: List[SearchMessageItem]
    
    class Config:
        from_attributes = True


# ========== Вспомогательные функции ==========

def highlight_match(text: str, query: str, max_length: int = 200) -> Optional[str]:
    """Выделяет совпадение в тексте и возвращает фрагмент"""
    if not text or not query:
        return None
    
    text_lower = text.lower()
    query_lower = query.lower()
    
    # Ищем первое вхождение
    index = text_lower.find(query_lower)
    if index == -1:
        return None
    
    # Вычисляем начало и конец фрагмента (с учетом max_length)
    context_size = min(50, (max_length - len(query)) // 2)
    start = max(0, index - context_size)
    end = min(len(text), index + len(query) + context_size)
    
    # Ограничиваем длину фрагмента
    if end - start > max_length:
        if index - start < max_length // 2:
            start = 0
            end = max_length
        else:
            end = start + max_length
    
    snippet = text[start:end]
    
    # Выделяем совпадение
    snippet_lower = snippet.lower()
    match_index = snippet_lower.find(query_lower)
    if match_index != -1:
        before = snippet[:match_index]
        match = snippet[match_index:match_index + len(query)]
        after = snippet[match_index + len(query):]
        snippet = f"{before}<mark>{match}</mark>{after}"
    
    # Добавляем многоточие если нужно
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    
    return snippet


# ========== Эндпоинт поиска ==========

@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(..., description="Поисковый запрос", min_length=1),
    type: Optional[Literal["all", "chats", "notes", "messages"]] = Query("all", description="Тип поиска"),
    space_id: Optional[int] = Query(None, description="Фильтр по пространству"),
    limit: int = Query(20, ge=1, le=100, description="Количество результатов на тип"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Универсальный поиск по чатам, заметкам и сообщениям пользователя
    
    - **q**: Поисковый запрос (минимум 1 символ)
    - **type**: Тип поиска (all, chats, notes, messages)
    - **space_id**: Фильтр по пространству (опционально)
    - **limit**: Количество результатов на каждый тип
    """
    if not q or not q.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поисковый запрос не может быть пустым"
        )
    
    query = q.strip()
    search_pattern = f"%{query}%"
    
    results = {
        "chats": [],
        "notes": [],
        "messages": []
    }
    
    total = 0
    
    # Проверяем доступ к пространству, если указано
    space = None
    if space_id:
        space = db.query(Space).filter(
            Space.id == space_id,
            Space.user_id == current_user.id
        ).first()
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пространство не найдено"
            )
    
    # ========== Поиск по чатам ==========
    if type in ["all", "chats"]:
        chat_query = db.query(Chat).join(Space).filter(
            Chat.user_id == current_user.id,
            or_(
                Chat.title.ilike(search_pattern)
            )
        )
        
        if space_id:
            chat_query = chat_query.filter(Chat.space_id == space_id)
        
        chats = chat_query.order_by(Chat.updated_at.desc()).limit(limit).all()
        
        for chat in chats:
            space = db.query(Space).filter(Space.id == chat.space_id).first()
            snippet = highlight_match(chat.title or "", query) if chat.title else None
            
            results["chats"].append(SearchChatItem(
                id=chat.id,
                title=chat.title,
                space_id=chat.space_id,
                space_name=space.name if space else "",
                created_at=chat.created_at.isoformat(),
                updated_at=chat.updated_at.isoformat(),
                snippet=snippet
            ))
        
        total += len(results["chats"])
    
    # ========== Поиск по заметкам ==========
    if type in ["all", "notes"]:
        note_query = db.query(Note).join(Space).filter(
            Note.user_id == current_user.id,
            or_(
                Note.title.ilike(search_pattern),
                Note.content.ilike(search_pattern)
            )
        )
        
        if space_id:
            note_query = note_query.filter(Note.space_id == space_id)
        
        notes = note_query.order_by(Note.updated_at.desc()).limit(limit).all()
        
        for note in notes:
            space = db.query(Space).filter(Space.id == note.space_id).first()
            # Ищем совпадение в title или content
            snippet = highlight_match(note.title, query) or highlight_match(note.content or "", query)
            
            results["notes"].append(SearchNoteItem(
                id=note.id,
                title=note.title,
                space_id=note.space_id,
                space_name=space.name if space else "",
                created_at=note.created_at.isoformat(),
                updated_at=note.updated_at.isoformat(),
                snippet=snippet
            ))
        
        total += len(results["notes"])
    
    # ========== Поиск по сообщениям ==========
    if type in ["all", "messages"]:
        # Сначала находим чаты пользователя
        user_chats_query = db.query(Chat.id).filter(Chat.user_id == current_user.id)
        if space_id:
            user_chats_query = user_chats_query.filter(Chat.space_id == space_id)
        user_chat_ids = [chat_id[0] for chat_id in user_chats_query.all()]
        
        if user_chat_ids:
            message_query = db.query(Message).join(Chat).join(Space).filter(
                Message.chat_id.in_(user_chat_ids),
                Message.content.ilike(search_pattern)
            )
            
            messages = message_query.order_by(Message.created_at.desc()).limit(limit).all()
            
            for msg in messages:
                chat = db.query(Chat).filter(Chat.id == msg.chat_id).first()
                space = db.query(Space).filter(Space.id == chat.space_id).first() if chat else None
                snippet = highlight_match(msg.content, query)
                
                results["messages"].append(SearchMessageItem(
                    id=msg.id,
                    chat_id=msg.chat_id,
                    chat_title=chat.title if chat else None,
                    space_id=chat.space_id if chat else 0,
                    space_name=space.name if space else "",
                    role=msg.role,
                    content=msg.content,
                    created_at=msg.created_at.isoformat(),
                    snippet=snippet
                ))
        
        total += len(results["messages"])
    
    return SearchResults(
        query=query,
        total=total,
        results={
            "chats_count": len(results["chats"]),
            "notes_count": len(results["notes"]),
            "messages_count": len(results["messages"])
        },
        chats=results["chats"],
        notes=results["notes"],
        messages=results["messages"]
    )

