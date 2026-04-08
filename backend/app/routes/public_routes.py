from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from sqlalchemy import desc, or_, and_
from datetime import datetime, timezone
import re

from backend.app.database.connection import get_db
from backend.app.models.space import Space
from backend.app.models.chat import Chat
from backend.app.models.message import Message
from backend.app.models.note import Note
from backend.app.models.tag import Tag
from backend.app.models.user import User
from backend.app.models.file_attachment import FileAttachment
from backend.app.routes.chat_routes import _assistant_reply_pipeline
from backend.app.utils.message_display import format_message_content_for_display
from backend.app.routes.spaces_routes import SpaceFileAttachmentItem, SpaceFilesListResponse
from backend.ml.services.classifier_service import BusinessClassifierService
from backend.app.services.llm_service import LLMService
from backend.app.services.cache_service import CacheService
from backend.app.services.formatting_service import FormattingService
from backend.app.services.space_context_service import build_space_context_prompt_block

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
    files_count: int = 0

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


class PublicEditUserMessageRequest(BaseModel):
    message: str


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
    files_count = db.query(FileAttachment).outerjoin(
        Chat,
        Chat.id == FileAttachment.chat_id,
    ).filter(
        FileAttachment.user_id == space.user_id,
        or_(
            and_(
                FileAttachment.chat_id.isnot(None),
                Chat.space_id == space.id,
            ),
            and_(
                FileAttachment.chat_id.is_(None),
                FileAttachment.space_id == space.id,
            ),
        ),
    ).count()

    return PublicSpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        chats_count=chats_count,
        notes_count=notes_count,
        files_count=files_count,
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
            content=format_message_content_for_display(msg, db),
            created_at=msg.created_at.isoformat(),
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
        space_context_block = build_space_context_prompt_block(db, space.id, limit=30)

        print(f"📚 Используем историю из {len(conversation_history)} сообщений для контекста")

        # Получаем усиленный промпт
        enhanced_prompt, category, probabilities = get_enhanced_system_prompt(user_message)

        # Генерируем ответ с учетом всей истории чата и контекста пространства
        try:
            ai_response = llm_service.generate_response(
                system_prompt=enhanced_prompt,
                user_question=user_message,
                conversation_history=conversation_history,
                space_context=space_context_block,
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


@router.patch(
    "/spaces/{public_token}/chats/{chat_id}/messages/{message_id}/regenerate",
    response_model=PublicChatSendResponse,
)
async def public_edit_user_message_and_regenerate(
    public_token: str,
    chat_id: int,
    message_id: int,
    request: PublicEditUserMessageRequest,
    db: Session = Depends(get_db),
):
    """
    Редактирование сообщения пользователя в публичном чате и перегенерация ответа ассистента.
    Владельцем вложений считается владелец пространства.
    """
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")

    space = get_public_space(public_token, db)

    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.space_id == space.id,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    user_msg = (
        db.query(Message)
        .filter(
            Message.id == message_id,
            Message.chat_id == chat.id,
            Message.role == "user",
        )
        .first()
    )
    if not user_msg:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")

    owner = db.query(User).filter(User.id == space.user_id).first()
    if not owner:
        raise HTTPException(status_code=500, detail="Владелец пространства не найден")

    later = (
        db.query(Message)
        .filter(Message.chat_id == chat.id, Message.id > user_msg.id)
        .order_by(Message.id.asc())
        .all()
    )
    for m in later:
        db.delete(m)

    image_url = None
    file_urls: List[str] = []
    if "<img" in user_message and "src=" in user_message:
        img_matches = re.findall(r'src=["\']([^"\']*assets/[^"\']+)["\']', user_message)
        if img_matches:
            image_url = img_matches[0].lstrip("/")
            file_urls = [url.lstrip("/") for url in img_matches]
    if not file_urls and "<a href=" in user_message:
        href_matches = re.findall(r'href=["\']([^"\']*assets/[^"\']+)["\']', user_message)
        if href_matches:
            file_urls = [url.lstrip("/") for url in href_matches]
            if not image_url:
                image_url = file_urls[0]
    text_file_matches = re.findall(r"assets/[a-zA-Z0-9_\-\.]+", user_message)
    for match in text_file_matches:
        if match not in file_urls:
            file_urls.append(match)

    referenced = set(file_urls)
    linked = db.query(FileAttachment).filter(FileAttachment.message_id == user_msg.id).all()
    for fa in linked:
        if fa.file_path not in referenced:
            fa.message_id = None

    file_attachments: List[FileAttachment] = []
    for file_url in file_urls:
        attachment = (
            db.query(FileAttachment)
            .filter(
                FileAttachment.file_path == file_url,
                FileAttachment.user_id == owner.id,
            )
            .order_by(FileAttachment.created_at.desc())
            .first()
        )
        if attachment and attachment not in file_attachments:
            file_attachments.append(attachment)

    for file_attachment in file_attachments:
        if not file_attachment.message_id:
            file_attachment.message_id = user_msg.id

    user_msg.content = user_message
    user_msg.image_url = image_url

    db.flush()
    final_attachments = db.query(FileAttachment).filter(FileAttachment.message_id == user_msg.id).all()
    file_content_context = ""
    for file_attachment in final_attachments:
        if file_attachment.extracted_text:
            file_content_context += (
                f"\n\n[Содержимое файла {file_attachment.filename}]:\n"
                f"{file_attachment.extracted_text}"
            )
        elif file_attachment.analysis_result:
            file_content_context += (
                f"\n\n[Анализ изображения {file_attachment.filename}]:\n"
                f"{file_attachment.analysis_result}"
            )

    if file_content_context:
        user_message_with_file = user_message + file_content_context
    else:
        user_message_with_file = user_message

    db.commit()
    db.refresh(user_msg)

    result = await _assistant_reply_pipeline(
        db,
        chat,
        space,
        owner,
        user_message,
        user_message_with_file,
        file_content_context,
    )

    return PublicChatSendResponse(
        success=result.success,
        chat_id=result.chat_id,
        message_id=result.message_id,
        response=result.response,
        error=result.error,
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


def _public_space_files_query(db: Session, space: Space):
    return db.query(FileAttachment, Chat).outerjoin(
        Chat,
        Chat.id == FileAttachment.chat_id,
    ).filter(
        FileAttachment.user_id == space.user_id,
        or_(
            and_(
                FileAttachment.chat_id.isnot(None),
                Chat.space_id == space.id,
            ),
            and_(
                FileAttachment.chat_id.is_(None),
                FileAttachment.space_id == space.id,
            ),
        ),
    )


@router.get("/spaces/{public_token}/files", response_model=SpaceFilesListResponse)
async def get_public_space_files(
    public_token: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    file_type: Optional[str] = Query(None),
    origin: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    chat_id: Optional[int] = Query(None),
    attached_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Файлы пространства для гостей (без авторизации), только если пространство публичное."""
    space = get_public_space(public_token, db)
    space_id = space.id
    query = _public_space_files_query(db, space)

    if origin:
        o = origin.strip().lower()
        if o in ("all", "*"):
            pass
        elif o == "unattached":
            query = query.filter(FileAttachment.message_id.is_(None))
        elif o in ("user", "assistant"):
            query = query.join(Message, Message.id == FileAttachment.message_id).filter(Message.role == o)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный origin")

    if chat_id is not None:
        query = query.filter(FileAttachment.chat_id == chat_id)

    if attached_only:
        query = query.filter(FileAttachment.message_id.isnot(None))

    if file_type:
        ft = file_type.strip().lower()
        image_exts = ("png", "jpg", "jpeg", "gif", "webp", "bmp")
        if ft in ("image", "images"):
            query = query.filter(
                or_(
                    FileAttachment.mime_type.ilike("image/%"),
                    FileAttachment.file_type == "image",
                    FileAttachment.file_type.in_(image_exts),
                )
            )
        elif ft in ("document", "documents", "file", "files", "doc"):
            query = query.filter(
                or_(
                    FileAttachment.mime_type.is_(None),
                    ~FileAttachment.mime_type.ilike("image/%"),
                )
            ).filter(
                FileAttachment.file_type != "image"
            ).filter(
                ~FileAttachment.file_type.in_(image_exts)
            )
        else:
            query = query.filter(FileAttachment.file_type == file_type)

    if q:
        query = query.filter(FileAttachment.filename.ilike(f"%{q}%"))

    total = query.count()
    rows = query.order_by(desc(FileAttachment.created_at)).offset(offset).limit(limit).all()

    items: List[SpaceFileAttachmentItem] = []
    for fa, ch in rows:
        items.append(SpaceFileAttachmentItem(
            id=fa.id,
            space_id=ch.space_id if ch else fa.space_id,
            chat_id=fa.chat_id,
            chat_title=ch.title if ch else None,
            message_id=fa.message_id,
            user_id=fa.user_id,
            filename=fa.filename,
            file_path=fa.file_path,
            file_type=fa.file_type,
            file_size=int(fa.file_size),
            mime_type=fa.mime_type,
            created_at=fa.created_at.isoformat() if fa.created_at else datetime.now(timezone.utc).isoformat(),
        ))

    return SpaceFilesListResponse(files=items, total=total)

