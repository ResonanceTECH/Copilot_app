from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.models.space import Space
from backend.app.models.chat import Chat
from backend.app.models.message import Message
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


class ChatSendRequest(BaseModel):
    message: str
    chat_id: Optional[int] = None
    space_id: Optional[int] = None


class ChatSendResponse(BaseModel):
    success: bool
    chat_id: int
    message_id: int
    response: dict = None
    error: str = None


class ChatHistoryItem(BaseModel):
    id: int
    title: Optional[str]
    space_id: int
    space_name: str
    last_message: Optional[str]
    last_message_at: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    chats: List[ChatHistoryItem]
    total: int


class MessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


class ChatMessagesResponse(BaseModel):
    messages: List[MessageItem]
    total: int
    chat_id: int
    chat_title: Optional[str]


class ChatUpdateRequest(BaseModel):
    title: Optional[str] = None


class ChatCreateRequest(BaseModel):
    title: Optional[str] = None
    space_id: Optional[int] = None


def get_or_create_default_space(user: User, db: Session) -> Space:
    """Получить или создать дефолтное пространство для пользователя"""
    # Ищем дефолтное пространство
    default_space = db.query(Space).filter(
        Space.user_id == user.id,
        Space.name == "Моё рабочее пространство",
        Space.is_archived == False
    ).first()
    
    if not default_space:
        # Создаем дефолтное пространство
        default_space = Space(
            user_id=user.id,
            name="Моё рабочее пространство",
            description="Рабочее пространство по умолчанию"
        )
        db.add(default_space)
        db.commit()
        db.refresh(default_space)
    
    return default_space


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


@router.get("/")
async def root():
    return {"message": "Chat API"}


@router.post("/chat", response_model=ChatHistoryItem, status_code=201)
async def create_chat(
    chat_data: ChatCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый пустой чат"""
    # Определяем пространство
    if chat_data.space_id:
        space = db.query(Space).filter(
            Space.id == chat_data.space_id,
            Space.user_id == current_user.id,
            Space.is_archived == False
        ).first()
        if not space:
            raise HTTPException(status_code=404, detail="Пространство не найдено")
    else:
        space = get_or_create_default_space(current_user, db)
    
    # Создаем новый чат
    title = chat_data.title.strip() if chat_data.title and chat_data.title.strip() else "Новый чат"
    chat = Chat(
        space_id=space.id,
        user_id=current_user.id,
        title=title
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    
    return ChatHistoryItem(
        id=chat.id,
        title=chat.title,
        space_id=chat.space_id,
        space_name=chat.space.name if chat.space else "",
        last_message=None,
        last_message_at=None,
        created_at=chat.created_at.isoformat(),
        updated_at=chat.updated_at.isoformat()
    )


@router.post("/chat/send", response_model=ChatSendResponse)
async def send_message(
    request: ChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отправка сообщения в чат и получение ответа от LLM"""
    try:
        user_message = request.message.strip()

        if not user_message:
            raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")

        # Определяем пространство
        if request.space_id:
            space = db.query(Space).filter(
                Space.id == request.space_id,
                Space.user_id == current_user.id,
                Space.is_archived == False
            ).first()
            if not space:
                raise HTTPException(status_code=404, detail="Пространство не найдено")
        else:
            space = get_or_create_default_space(current_user, db)

        # Определяем чат
        if request.chat_id:
            chat = db.query(Chat).filter(
                Chat.id == request.chat_id,
                Chat.user_id == current_user.id,
                Chat.space_id == space.id
            ).first()
            if not chat:
                raise HTTPException(status_code=404, detail="Чат не найден")
        else:
            # Создаем новый чат
            chat = Chat(
                space_id=space.id,
                user_id=current_user.id,
                title=user_message[:50] if len(user_message) > 50 else user_message
            )
            db.add(chat)
            db.commit()
            db.refresh(chat)

        # Сохраняем сообщение пользователя
        user_msg = Message(
            chat_id=chat.id,
            role="user",
            content=user_message
        )
        db.add(user_msg)
        db.commit()

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
            
            return ChatSendResponse(
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
            
            return ChatSendResponse(
                success=True,
                chat_id=chat.id,
                message_id=assistant_msg.id,
                response=cached_response
            )

        print(f"📨 Отправляем запрос в LLM: {user_message}")

        # Получаем историю сообщений для контекста
        previous_messages = db.query(Message).filter(
            Message.chat_id == chat.id
        ).order_by(Message.created_at).all()

        # Формируем контекст из истории
        context_messages = []
        for msg in previous_messages[:-1]:  # Все кроме последнего (текущего)
            context_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        # Получаем усиленный промпт
        enhanced_prompt, category, probabilities = get_enhanced_system_prompt(user_message)

        # Генерируем ответ с учетом контекста
        if context_messages:
            # Если есть история, используем её для контекста
            ai_response = llm_service.generate_response_with_context(
                enhanced_prompt, context_messages, user_message
            )
        else:
            # Если истории нет, используем обычный метод
            ai_response = llm_service.generate_response(enhanced_prompt, user_message)

        # Форматируем ответ
        formatted_response = formatting_service.format_response(ai_response)

        # Сохраняем ответ ассистента
        assistant_msg = Message(
            chat_id=chat.id,
            role="assistant",
            content=ai_response
        )
        db.add(assistant_msg)
        # Обновляем updated_at чата явно, чтобы триггер сработал
        chat.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(assistant_msg)

        # Подготавливаем данные для ответа
        response_data = {
            'raw_text': ai_response,
            'formatted_html': formatted_response,
            'timestamp': datetime.now().isoformat(),
            'category': category,
            'probabilities': probabilities
        }

        # Сохраняем в кэш
        cache_service.set(user_message, response_data)

        return ChatSendResponse(
            success=True,
            chat_id=chat.id,
            message_id=assistant_msg.id,
            response=response_data
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return ChatSendResponse(
            success=False,
            chat_id=0,
            message_id=0,
            error="Временная ошибка сервера. Пожалуйста, попробуйте ещё раз."
        )


@router.get("/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    space_id: Optional[int] = Query(None, description="Фильтр по пространству"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить историю чатов пользователя"""
    query = db.query(Chat).filter(Chat.user_id == current_user.id)
    
    if space_id:
        query = query.filter(Chat.space_id == space_id)
    
    total = query.count()
    
    chats = query.order_by(desc(Chat.updated_at)).offset(offset).limit(limit).all()
    
    chat_items = []
    for chat in chats:
        # Получаем последнее сообщение
        last_message = db.query(Message).filter(
            Message.chat_id == chat.id
        ).order_by(desc(Message.created_at)).first()
        
        chat_items.append(ChatHistoryItem(
            id=chat.id,
            title=chat.title,
            space_id=chat.space_id,
            space_name=chat.space.name if chat.space else "",
            last_message=last_message.content[:100] if last_message else None,
            last_message_at=last_message.created_at.isoformat() if last_message else None,
            created_at=chat.created_at.isoformat(),
            updated_at=chat.updated_at.isoformat()
        ))
    
    return ChatHistoryResponse(chats=chat_items, total=total)


@router.get("/chat/{chat_id}/messages", response_model=ChatMessagesResponse)
async def get_chat_messages(
    chat_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все сообщения чата"""
    # Проверяем, что чат принадлежит пользователю
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    # Получаем сообщения
    total = db.query(Message).filter(Message.chat_id == chat_id).count()
    
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at).offset(offset).limit(limit).all()
    
    message_items = [
        MessageItem(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at.isoformat()
        )
        for msg in messages
    ]
    
    return ChatMessagesResponse(
        messages=message_items,
        total=total,
        chat_id=chat.id,
        chat_title=chat.title
    )


@router.put("/chat/{chat_id}", response_model=ChatHistoryItem)
async def update_chat(
    chat_id: int,
    chat_data: ChatUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить чат (переименовать)"""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(
            status_code=404,
            detail="Чат не найден"
        )
    
    if chat_data.title is not None:
        if not chat_data.title.strip():
            raise HTTPException(
                status_code=400,
                detail="Название чата не может быть пустым"
            )
        chat.title = chat_data.title.strip()
        chat.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(chat)
    
    # Получаем последнее сообщение для ответа
    last_message = db.query(Message).filter(
        Message.chat_id == chat.id
    ).order_by(desc(Message.created_at)).first()
    
    return ChatHistoryItem(
        id=chat.id,
        title=chat.title,
        space_id=chat.space_id,
        space_name=chat.space.name if chat.space else "",
        last_message=last_message.content[:100] if last_message else None,
        last_message_at=last_message.created_at.isoformat() if last_message else None,
        created_at=chat.created_at.isoformat(),
        updated_at=chat.updated_at.isoformat()
    )


@router.delete("/chat/{chat_id}", status_code=204)
async def delete_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить чат"""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(
            status_code=404,
            detail="Чат не найден"
        )
    
    # Удаляем все сообщения чата
    db.query(Message).filter(Message.chat_id == chat.id).delete()
    
    # Удаляем чат
    db.delete(chat)
    db.commit()
    
    return None


# Оставляем старый эндпоинт для обратной совместимости
@router.post("/ask", response_model=dict)
async def ask_question_legacy(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Старый эндпоинт для обратной совместимости - перенаправляет на /chat/send"""
    question = request.get("question", "")
    if not question:
        raise HTTPException(status_code=400, detail="Вопрос не может быть пустым")
    
    send_request = ChatSendRequest(message=question)
    response = await send_message(send_request, current_user, db)
    
    return {
        "success": response.success,
        "response": response.response,
        "error": response.error
    }
