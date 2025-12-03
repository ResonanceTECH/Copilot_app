from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict

from backend.app.database.connection import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.models.space import Space
from backend.app.models.chat import Chat
from backend.app.models.message import Message
from backend.app.models.note import Note
from backend.ml.models.business_classifier import EnhancedBusinessClassifier
from backend.app.services.llm_service import LLMService
from backend.app.services.cache_service import CacheService
from backend.app.services.formatting_service import FormattingService
from backend.ml.services.graphic_service import GraphicService

router = APIRouter()

# Инициализация сервисов
classifier_service = EnhancedBusinessClassifier()
classifier_service.load_model('backend/ml/models/business_classifier.pkl')
llm_service = LLMService()
cache_service = CacheService()
formatting_service = FormattingService()

# Инициализация сервиса для графиков
graphic_service = GraphicService(llm_service)

CATEGORY_PROMPTS = {
    'marketing': "Ты — эксперт по маркетингу и продвижению бизнеса. Отвечай кратко, практично и с фокусом на измеримые результаты.",
    'finance': "Ты — финансовый консультант для малого и среднего бизнеса. Будь точным в цифрах и расчетах.",
    'legal': "Ты — юридический консультант по бизнес-праву. Будь аккуратен в формулировках и указывай на риски.",
    'management': "Ты — эксперт по управлению бизнесом и командами. Давай практические, реализуемые советы.",
    'sales': "Ты — специалист по продажам и работе с клиентами. Предлагай конкретные техники и скрипты.",
    'general': "Ты — универсальный бизнес-консультант для малого бизнеса. Отвечай кратко, структурно и по делу.",
    'graphic': "Ты эксперт по визуализации данных. Пользователь просит создать график."
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
    image_url: Optional[str] = None
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
    space_id: Optional[int] = None


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


def get_conversation_history(chat_id: int, db: Session, max_messages: int = 10) -> List[Dict[str, str]]:
    """Получить историю сообщений для контекста LLM"""
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.asc()).limit(max_messages).all()  # Уже в хронологическом порядке

    # Преобразуем в список словарей
    formatted_history = []
    for msg in messages:
        formatted_history.append({
            'role': msg.role,
            'content': msg.content
        })

    return formatted_history


async def process_graphic_request(user_query: str, current_user: User, db: Session, space_id: int) -> dict:
    """
    Обработка запроса на график.
    Возвращает ответ с base64 изображением и создает заметку с ссылкой на картинку.
    """
    try:
        print(f"📊 Обработка графического запроса: {user_query}")

        # Обрабатываем запрос через GraphicService
        result = graphic_service.process_graphic_request(user_query)

        if result["success"]:
            saved_image_path = result.get('saved_image_path')
            
            # Создаем заметку с ссылкой на картинку
            if saved_image_path:
                try:
                    # Получаем пространство
                    space = db.query(Space).filter(
                        Space.id == space_id,
                        Space.user_id == current_user.id
                    ).first()
                    
                    if space:
                        # Создаем заметку
                        new_note = Note(
                            space_id=space.id,
                            user_id=current_user.id,
                            title=f"График: {user_query[:50]}",
                            content=f"График создан по запросу: {user_query}",
                            image_url=saved_image_path
                        )
                        db.add(new_note)
                        db.commit()
                        db.refresh(new_note)
                        print(f"✅ Заметка создана с ID {new_note.id}, image_url: {saved_image_path}")
                    else:
                        print(f"⚠️ Пространство {space_id} не найдено, заметка не создана")
                except Exception as e:
                    print(f"❌ Ошибка при создании заметки: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Формируем HTML с изображением из assets
            # Используем сохраненный путь, если есть, иначе fallback на base64
            image_src = None
            if saved_image_path:
                # Формируем URL к файлу (путь уже в формате assets/graph_xxx.png)
                image_src = f"/{saved_image_path}"
            elif result.get('image_base64'):
                # Fallback на base64, если путь не сохранился
                image_src = f"data:image/png;base64,{result['image_base64']}"
            
            if image_src:
                image_html = f'''
                <div class="graphic-container" style="
                    background: white;
                    border-radius: 10px;
                    padding: 15px;
                    margin: 15px 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                ">
                    <div class="graphic-header" style="
                        margin-bottom: 10px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #eee;
                    ">
                        <h4 style="margin: 0; color: #333;">📈 Сгенерированный график</h4>
                    </div>
                    <div class="graphic-image" style="text-align: center;">
                        <img src="{image_src}" 
                             alt="Сгенерированный график" 
                             style="
                                max-width: 100%;
                                height: auto;
                                border-radius: 5px;
                             ">
                    </div>
                    <div class="graphic-note" style="
                        margin-top: 10px;
                        font-size: 12px;
                        color: #666;
                        text-align: center;
                    ">
                        Запрос: "{user_query}"
                    </div>
                </div>
                '''
            else:
                image_html = f'''
                <div class="graphic-container" style="
                    background: #fff5f5;
                    border-left: 4px solid #f44336;
                    padding: 15px;
                    margin: 15px 0;
                    border-radius: 5px;
                ">
                    <p style="margin: 0; color: #d32f2f;">⚠️ График создан, но изображение недоступно</p>
                </div>
                '''

            return {
                'raw_text': f"Создан график по запросу: {user_query}",
                'formatted_html': image_html,
                'timestamp': datetime.now().isoformat(),
                'category': 'graphic',
                'graphic_data': {
                    'success': True,
                    'has_image': True,
                    'mime_type': result.get('mime_type', 'image/png'),
                    'saved_image_path': saved_image_path
                }
            }
        else:
            error_msg = result.get('error', 'Неизвестная ошибка')
            stderr = result.get('stderr', '')

            error_html = f'''
            <div class="error-container" style="
                background: #fff5f5;
                border-left: 4px solid #f44336;
                padding: 15px;
                margin: 15px 0;
                border-radius: 5px;
            ">
                <h4 style="margin: 0 0 10px 0; color: #d32f2f;">❌ Ошибка создания графика</h4>
                <p style="margin: 0 0 10px 0;">{error_msg}</p>
            '''

            if stderr:
                error_html += f'''
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #666; font-size: 12px;">Подробности ошибки</summary>
                    <pre style="
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 5px;
                        font-size: 11px;
                        overflow-x: auto;
                        margin-top: 5px;
                    ">{stderr[:500]}</pre>
                </details>
                '''

            error_html += '</div>'

            return {
                'raw_text': f"Ошибка создания графика: {error_msg}",
                'formatted_html': error_html,
                'timestamp': datetime.now().isoformat(),
                'category': 'graphic',
                'graphic_data': {
                    'success': False,
                    'error': error_msg,
                    'stderr': stderr[:500] if stderr else ''
                }
            }

    except Exception as e:
        print(f"❌ Исключение при обработке графического запроса: {e}")
        import traceback
        traceback.print_exc()

        error_html = f'''
        <div class="error-container" style="
            background: #fff5f5;
            border-left: 4px solid #f44336;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        ">
            <h4 style="margin: 0 0 10px 0; color: #d32f2f;">❌ Ошибка обработки запроса</h4>
            <p style="margin: 0;">{str(e)}</p>
        </div>
        '''

        return {
            'raw_text': f"Ошибка обработки запроса на график: {str(e)}",
            'formatted_html': error_html,
            'timestamp': datetime.now().isoformat(),
            'category': 'graphic',
            'graphic_data': {
                'success': False,
                'error': str(e)
            }
        }


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
    """Отправка сообщения в чат и получение ответа от LLM с учетом всей истории"""
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
                title=user_message[:50] + "..." if len(user_message) > 50 else user_message
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

        # Получаем усиленный промпт и категорию
        enhanced_prompt, category, probabilities = get_enhanced_system_prompt(user_message)

        # Если категория 'graphic', обрабатываем специальным образом
        if category == 'graphic':
            # Обрабатываем графический запрос
            response_data = await process_graphic_request(user_message, current_user, db, space.id)

            # Сохраняем ответ ассистента в базу
            # Для графиков сохраняем также image_url
            saved_image_path = response_data.get('graphic_data', {}).get('saved_image_path')
            assistant_msg = Message(
                chat_id=chat.id,
                role="assistant",
                content=response_data['raw_text'],
                image_url=saved_image_path
            )
            db.add(assistant_msg)
            chat.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(assistant_msg)

            return ChatSendResponse(
                success=True,
                chat_id=chat.id,
                message_id=assistant_msg.id,
                response=response_data
            )

        # Для остальных категорий - проверяем кэш
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

        # Получаем ВСЮ историю сообщений для контекста
        conversation_history = get_conversation_history(chat.id, db, max_messages=15)

        print(f"📚 Используем историю из {len(conversation_history)} сообщений для контекста")

        # Генерируем ответ с учетом всей истории чата
        try:
            ai_response = llm_service.generate_response(
                system_prompt=enhanced_prompt,
                user_question=user_message,
                conversation_history=conversation_history
            )
        except ValueError as e:
            # Ошибка валидации или конфигурации LLM
            error_msg = str(e)
            print(f"❌ Ошибка генерации ответа: {error_msg}")
            return ChatSendResponse(
                success=False,
                chat_id=chat.id if chat else 0,
                message_id=0,
                error=error_msg
            )
        except Exception as e:
            # Другие ошибки LLM
            error_msg = f"Ошибка при генерации ответа: {str(e)}"
            print(f"❌ Неожиданная ошибка LLM: {e}")
            import traceback
            traceback.print_exc()
            return ChatSendResponse(
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
            'probabilities': probabilities,
            'history_count': len(conversation_history) + 1  # +1 для текущего сообщения
        }

        # Сохраняем в кэш
        cache_service.set(user_message, response_data)

        print(f"✅ Успешно обработан запрос. История: {len(conversation_history) + 1} сообщений")

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


@router.get("/test-graph")
async def test_graph():
    """Тестовый эндпоинт для проверки графиков"""
    test_code = """
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(10, 6))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Тестовый график синуса')
plt.grid(True)
plt.savefig('graph_output.png', dpi=100, bbox_inches='tight')
plt.close()
"""

    from backend.ml.core.code_executor import SafeCodeExecutor
    executor = SafeCodeExecutor(timeout=30)
    result = executor.execute_python_code(test_code)

    if result["success"] and result.get("image_base64"):
        html = f'<img src="data:image/png;base64,{result["image_base64"]}">'
        return {"success": True, "html": html}

    return {"success": False, "error": result.get("error")}

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
            last_message=last_message.content[:100] + "..." if last_message and len(
                last_message.content) > 100 else last_message.content if last_message else None,
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

    message_items = []
    for msg in messages:
        # Если есть image_url, регенерируем HTML для отображения графика
        content = msg.content
        if msg.image_url and msg.role == 'assistant':
            # Регенерируем HTML с изображением
            image_src = f"/{msg.image_url}"
            content = f'''
            <div class="graphic-container" style="
                background: white;
                border-radius: 10px;
                padding: 15px;
                margin: 15px 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <div class="graphic-header" style="
                    margin-bottom: 10px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #eee;
                ">
                    <h4 style="margin: 0; color: #333;">📈 Сгенерированный график</h4>
                </div>
                <div class="graphic-image" style="text-align: center;">
                    <img src="{image_src}" 
                         alt="Сгенерированный график" 
                         style="
                            max-width: 100%;
                            height: auto;
                            border-radius: 5px;
                         ">
                </div>
                <div class="graphic-note" style="
                    margin-top: 10px;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                ">
                    {msg.content}
                </div>
            </div>
            '''
        
        message_items.append(MessageItem(
            id=msg.id,
            role=msg.role,
            content=content,
            image_url=msg.image_url,
            created_at=msg.created_at.isoformat()
        ))

    return ChatMessagesResponse(
        messages=message_items,
        total=total,
        chat_id=chat.id,
        chat_title=chat.title
    )


@router.get("/chat/{chat_id}/context")
async def get_chat_context(
        chat_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Получить информацию о контексте чата (для отладки)"""
    # Проверяем, что чат принадлежит пользователю
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    # Получаем историю для контекста
    conversation_history = get_conversation_history(chat_id, db, max_messages=15)

    return {
        "chat_id": chat_id,
        "chat_title": chat.title,
        "total_messages": len(conversation_history),
        "context_messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content_preview": msg.content[:100] + "..." if len(msg.content) > 100 else msg.content,
                "created_at": msg.created_at.isoformat()
            }
            for msg in conversation_history
        ]
    }


@router.put("/chat/{chat_id}", response_model=ChatHistoryItem)
async def update_chat(
        chat_id: int,
        chat_data: ChatUpdateRequest,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Обновить чат (переименовать или изменить пространство)"""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()

    if not chat:
        raise HTTPException(
            status_code=404,
            detail="Чат не найден"
        )

    update_data = {}

    if chat_data.title is not None:
        if not chat_data.title.strip():
            raise HTTPException(
                status_code=400,
                detail="Название чата не может быть пустым"
            )
        update_data["title"] = chat_data.title.strip()

    # Обновление пространства
    if chat_data.space_id is not None:
        if chat_data.space_id != chat.space_id:
            space = db.query(Space).filter(
                Space.id == chat_data.space_id,
                Space.user_id == current_user.id,
                Space.is_archived == False
            ).first()
            if not space:
                raise HTTPException(
                    status_code=404,
                    detail="Пространство не найдено или недоступно"
                )
            update_data["space_id"] = chat_data.space_id

    # Применяем обновления
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        db.query(Chat).filter(Chat.id == chat_id).update(update_data)
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