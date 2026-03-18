from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from sqlalchemy import desc
from datetime import datetime, timezone

from backend.app.database.connection import get_db
from backend.app.models.space import Space
from backend.app.models.chat import Chat
from backend.app.models.message import Message
from backend.app.models.note import Note
from backend.app.models.tag import Tag
from backend.ml.services.classifier_service import BusinessClassifierService
from backend.app.services.llm_service import LLMService
from backend.app.services.cache_service import CacheService
from backend.app.services.formatting_service import FormattingService

router = APIRouter()

# Инициализация сервисов
classifier_service = BusinessClassifierService()
llm_service = LLMService()
cache_service = CacheService()
formatting_service = FormattingService()

CATEGORY_PROMPTS = {
    'marketing': "Ты — эксперт по маркетингу и продвижению бизнеса. Отвечай кратко, практично и с фокусом на измеримые результаты.",
    'finance': "Ты — финансовый консультант для малого и среднего бизнеса. Будь точным в цифрах и расчетах.",
    'legal': "Ты — юридический консультант по бизнес-праву. Будь аккуратен в формулировках и указывай на риски.",
    'management': "Ты — эксперт по управлению бизнесом и командами. Давай практические, реализуемые советы.",
    'sales': "Ты — специалист по продажам и работе с клиентами. Предлагай конкретные техники и скрипты.",
    'general': "Ты — универсальный бизнес-консультант для малого бизнеса. Отвечай кратко, структурно и по делу."
}


def get_enhanced_system_prompt(user_question: str):
    """Получение усиленного промпта на основе категории"""
    category, probabilities = classifier_service.predict_category(user_question)
    confidence = probabilities.get(category, 0)

    print(f"🎯 Категория вопроса: {category} (уверенность: {confidence:.1%})")

    base_prompt = "Ты — бизнес-консультант для малого бизнеса. Отвечай кратко и по делу. Используй списки по 2-4 пункта. Будь конкретен и практичен."
    category_prompt = CATEGORY_PROMPTS.get(category, CATEGORY_PROMPTS['general'])

    enhanced_prompt = f"{base_prompt}\n\n{category_prompt}"
    enhanced_prompt += f"\n\n[Категория вопроса: {category}, уверенность: {confidence:.1%}]"

    return enhanced_prompt, category, probabilities


def get_conversation_history(chat_id: int, db: Session, max_messages: int = 10) -> List[Dict[str, str]]:
    """Получить историю сообщений для контекста LLM"""
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.desc()).limit(max_messages).all()

    # Преобразуем в формат для LLM
    history = []
    for msg in reversed(messages):
        history.append({
            "role": msg.role,
            "content": msg.content
        })
    
    return history


# Pydantic модели
class PublicSpaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    chats_count: int
    notes_count: int

class PublicChatItem(BaseModel):
    id: int
    title: Optional[str]
    created_at: str
    updated_at: str
    messages_count: int

class PublicChatsResponse(BaseModel):
    chats: List[PublicChatItem]
    total: int

class PublicMessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: str

class PublicMessagesResponse(BaseModel):
    messages: List[PublicMessageItem]
    total: int
    chat_id: int
    chat_title: Optional[str]

class PublicChatSendRequest(BaseModel):
    message: str
    chat_id: Optional[int] = None

class PublicChatSendResponse(BaseModel):
    success: bool
    chat_id: int
    message_id: int
    response: Optional[dict] = None
    error: Optional[str] = None

class PublicNoteItem(BaseModel):
    id: int
    title: str
    content: Optional[str]
    created_at: str
    updated_at: str
    tags: List[dict] = []

class PublicNotesResponse(BaseModel):
    notes: List[PublicNoteItem]
    total: int

class PublicTagItem(BaseModel):
    id: int
    name: str
    color: Optional[str]
    tag_type: Optional[str]
    created_at: str

class PublicTagsResponse(BaseModel):
    tags: List[PublicTagItem]
    total: int


# Dependency для получения публичного пространства
def get_public_space(public_token: str, db: Session) -> Space:
    """Получить публичное пространство по токену"""
    space = db.query(Space).filter(
        Space.public_token == public_token,
        Space.is_public == True,
        Space.is_archived == False
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Публичное пространство не найдено или недоступно"
        )
    
    return space


@router.get("/spaces/{public_token}", response_model=PublicSpaceResponse)
async def get_public_space_info(
    public_token: str,
    db: Session = Depends(get_db)
):
    """Получить информацию о публичном пространстве"""
    space = get_public_space(public_token, db)
    
    chats_count = db.query(Chat).filter(Chat.space_id == space.id).count()
    notes_count = db.query(Note).filter(Note.space_id == space.id).count()
    
    return PublicSpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        chats_count=chats_count,
        notes_count=notes_count
    )


@router.get("/spaces/{public_token}/chats", response_model=PublicChatsResponse)
async def get_public_space_chats(
    public_token: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить список чатов публичного пространства"""
    space = get_public_space(public_token, db)
    
    query = db.query(Chat).filter(Chat.space_id == space.id)
    total = query.count()
    
    chats = query.order_by(desc(Chat.updated_at)).offset(offset).limit(limit).all()
    
    chat_items = []
    for chat in chats:
        messages_count = db.query(Message).filter(Message.chat_id == chat.id).count()
        chat_items.append(PublicChatItem(
            id=chat.id,
            title=chat.title,
            created_at=chat.created_at.isoformat(),
            updated_at=chat.updated_at.isoformat(),
            messages_count=messages_count
        ))
    
    return PublicChatsResponse(chats=chat_items, total=total)


@router.get("/spaces/{public_token}/chats/{chat_id}/messages", response_model=PublicMessagesResponse)
async def get_public_chat_messages(
    public_token: str,
    chat_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить сообщения чата публичного пространства"""
    space = get_public_space(public_token, db)
    
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.space_id == space.id
    ).first()
    
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Чат не найден"
        )
    
    query = db.query(Message).filter(Message.chat_id == chat_id)
    total = query.count()
    
    messages = query.order_by(Message.created_at).offset(offset).limit(limit).all()
    
    message_items = [
        PublicMessageItem(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at.isoformat()
        )
        for msg in messages
    ]
    
    return PublicMessagesResponse(
        messages=message_items,
        total=total,
        chat_id=chat.id,
        chat_title=chat.title
    )


@router.post("/spaces/{public_token}/chat/send", response_model=PublicChatSendResponse)
async def send_public_message(
    public_token: str,
    request: PublicChatSendRequest,
    db: Session = Depends(get_db)
):
    """Отправка сообщения в чат публичного пространства (без авторизации)"""
    try:
        user_message = request.message.strip()
        
        if not user_message:
            raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")
        
        space = get_public_space(public_token, db)
        
        # Определяем чат
        if not request.chat_id:
            # Публичные пользователи могут пользоваться существующими чатами,
            # но не создавать новые.
            raise HTTPException(
                status_code=403,
                detail="Создание нового чата в публичном пространстве запрещено. Выберите существующий чат."
            )
        
        chat = db.query(Chat).filter(
            Chat.id == request.chat_id,
            Chat.space_id == space.id
        ).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")
        
        # Сохраняем сообщение пользователя
        user_msg = Message(
            chat_id=chat.id,
            role="user",
            content=user_message
        )
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)
        
        # Проверяем быстрые ответы
        quick_response = llm_service.get_quick_response(user_message)
        if quick_response:
            assistant_msg = Message(
                chat_id=chat.id,
                role="assistant",
                content=quick_response
            )
            db.add(assistant_msg)
            db.commit()
            db.refresh(assistant_msg)
            
            return PublicChatSendResponse(
                success=True,
                chat_id=chat.id,
                message_id=assistant_msg.id,
                response={
                    'raw_text': quick_response,
                    'formatted_html': f'<p class="response-text">{quick_response}</p>',
                    'timestamp': datetime.now().isoformat(),
                    'category': 'quick_response'
                }
            )
        
        # Проверяем кэш
        cached_response = cache_service.get(user_message)
        if cached_response:
            print(f"✅ Используем кэшированный ответ для: {user_message[:50]}...")
            assistant_content = cached_response.get('raw_text', '')
            
            assistant_msg = Message(
                chat_id=chat.id,
                role="assistant",
                content=assistant_content
            )
            db.add(assistant_msg)
            db.commit()
            db.refresh(assistant_msg)
            
            return PublicChatSendResponse(
                success=True,
                chat_id=chat.id,
                message_id=assistant_msg.id,
                response=cached_response
            )
        
        print(f"📨 Публичное сообщение в пространстве {space.id}, чат {chat.id}: {user_message}")
        
        # Получаем ВСЮ историю сообщений для контекста
        conversation_history = get_conversation_history(chat.id, db, max_messages=15)
        
        print(f"📚 Используем историю из {len(conversation_history)} сообщений для контекста")
        
        # Получаем усиленный промпт
        enhanced_prompt, category, probabilities = get_enhanced_system_prompt(user_message)
        
        # Генерируем ответ с учетом всей истории чата
        try:
            ai_response = llm_service.generate_response(
                system_prompt=enhanced_prompt,
                user_question=user_message,
                conversation_history=conversation_history
            )
        except ValueError as e:
            error_msg = str(e)
            print(f"❌ Ошибка генерации ответа: {error_msg}")
            return PublicChatSendResponse(
                success=False,
                chat_id=chat.id if chat else 0,
                message_id=0,
                error=error_msg
            )
        except Exception as e:
            error_msg = f"Ошибка при генерации ответа: {str(e)}"
            print(f"❌ Неожиданная ошибка LLM: {e}")
            import traceback
            traceback.print_exc()
            return PublicChatSendResponse(
                success=False,
                chat_id=chat.id if chat else 0,
                message_id=0,
                error="Не удалось получить ответ от AI. Попробуйте ещё раз."
            )
        
        # Форматируем ответ
        formatted_response = formatting_service.format_response(ai_response)
        
        # Сохраняем ответ ассистента
        assistant_msg = Message(
            chat_id=chat.id,
            role="assistant",
            content=ai_response
        )
        db.add(assistant_msg)
        chat.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(assistant_msg)
        
        # Подготавливаем данные для ответа
        response_data = {
            'raw_text': ai_response,
            'formatted_html': formatted_response,
            'timestamp': datetime.now().isoformat(),
            'category': category,
            'probabilities': probabilities,
            'history_count': len(conversation_history) + 1
        }
        
        # Сохраняем в кэш
        cache_service.set(user_message, response_data)
        
        print(f"✅ Успешно обработан публичный запрос. История: {len(conversation_history) + 1} сообщений")
        
        return PublicChatSendResponse(
            success=True,
            chat_id=chat.id,
            message_id=assistant_msg.id,
            response=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка при отправке публичного сообщения: {e}")
        import traceback
        traceback.print_exc()
        return PublicChatSendResponse(
            success=False,
            chat_id=0,
            message_id=0,
            error="Временная ошибка сервера. Пожалуйста, попробуйте ещё раз."
        )


@router.get("/spaces/{public_token}/notes", response_model=PublicNotesResponse)
async def get_public_space_notes(
    public_token: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить список заметок публичного пространства"""
    space = get_public_space(public_token, db)
    
    query = db.query(Note).filter(Note.space_id == space.id)
    total = query.count()
    
    notes = query.order_by(desc(Note.updated_at)).offset(offset).limit(limit).all()
    
    note_items = []
    for note in notes:
        note_items.append(PublicNoteItem(
            id=note.id,
            title=note.title,
            content=note.content,
            created_at=note.created_at.isoformat(),
            updated_at=note.updated_at.isoformat(),
            tags=[{"id": tag.id, "name": tag.name, "color": tag.color} for tag in note.tags]
        ))
    
    return PublicNotesResponse(notes=note_items, total=total)


@router.get("/spaces/{public_token}/tags", response_model=PublicTagsResponse)
async def get_public_space_tags(
    public_token: str,
    db: Session = Depends(get_db)
):
    """Получить список тегов публичного пространства"""
    space = get_public_space(public_token, db)
    
    tags = db.query(Tag).filter(Tag.space_id == space.id).order_by(Tag.name).all()
    
    tag_items = [
        PublicTagItem(
            id=tag.id,
            name=tag.name,
            color=tag.color,
            tag_type=tag.tag_type,
            created_at=tag.created_at.isoformat()
        )
        for tag in tags
    ]
    
    return PublicTagsResponse(tags=tag_items, total=len(tag_items))

