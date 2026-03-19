from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict
from pathlib import Path
import uuid

from backend.app.database.connection import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.models.space import Space
from backend.app.models.chat import Chat
from backend.app.models.message import Message
from backend.app.models.note import Note
from backend.app.models.file_attachment import FileAttachment
from backend.ml.services.file_analysis_service import FileAnalysisService
from backend.ml.models.business_classifier import EnhancedBusinessClassifier
from backend.app.models.user_activity import UserActivity
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
    tags: List[dict] = []

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
    """Получить историю сообщений для контекста LLM, включая содержимое файлов"""
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.asc()).limit(max_messages).all()  # Уже в хронологическом порядке

    # Преобразуем в список словарей
    formatted_history = []
    for msg in messages:
        content = msg.content
        
        # Если у сообщения есть связанные файлы, добавляем их содержимое
        file_attachments = db.query(FileAttachment).filter(
            FileAttachment.message_id == msg.id
        ).all()
        
        for file_attachment in file_attachments:
            if file_attachment.extracted_text:
                # Для PDF/DOC файлов добавляем извлеченный текст
                content += f"\n\n[Содержимое файла {file_attachment.filename}]:\n{file_attachment.extracted_text}"
            elif file_attachment.analysis_result:
                # Для изображений добавляем результат анализа
                content += f"\n\n[Анализ изображения {file_attachment.filename}]:\n{file_attachment.analysis_result}"
        
        formatted_history.append({
            'role': msg.role,
            'content': content
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
        
        print(f"📨 Получено сообщение пользователя:")
        print(f"   - Длина: {len(user_message)} символов")
        print(f"   - Первые 200 символов: {user_message[:200]}...")
        print(f"   - Содержит HTML: {'<div' in user_message or '<img' in user_message or '<a href' in user_message}")

        if not user_message:
            raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")

        # Определяем чат и пространство.
        # Важно: если chat_id передан, пространство берем из самого чата,
        # иначе после перемещения чата в другое пространство поиск ломается.
        if request.chat_id:
            chat = db.query(Chat).filter(
                Chat.id == request.chat_id,
                Chat.user_id == current_user.id
            ).first()
            if not chat:
                raise HTTPException(status_code=404, detail="Чат не найден")
            if request.space_id and chat.space_id != request.space_id:
                raise HTTPException(status_code=404, detail="Чат не найден")
            space = chat.space

            # Если это первое сообщение в чате, обновляем заголовок
            # на основе запроса пользователя.
            has_messages = db.query(Message.id).filter(
                Message.chat_id == chat.id
            ).first() is not None
            if not has_messages:
                new_title = user_message[:50] + "..." if len(user_message) > 50 else user_message
                chat.title = new_title
        else:
            # Для нового чата пространство определяем явно или через дефолтное.
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

            # Создаем новый чат
            chat = Chat(
                space_id=space.id,
                user_id=current_user.id,
                title=user_message[:50] + "..." if len(user_message) > 50 else user_message
            )
            db.add(chat)
            db.commit()
            db.refresh(chat)

        # Извлекаем file_url из HTML, если есть файл (изображение или документ)
        image_url = None
        file_urls = []  # Список всех найденных файлов
        import re
        from datetime import timedelta
        
        # Ищем изображения: src="/assets/..." или src="assets/..."
        if '<img' in user_message and 'src=' in user_message:
            img_matches = re.findall(r'src=["\']([^"\']*assets/[^"\']+)["\']', user_message)
            if img_matches:
                image_url = img_matches[0].lstrip('/')  # Первое изображение для image_url
                file_urls = [url.lstrip('/') for url in img_matches]
                print(f"📷 Извлечены image_url из сообщения: {file_urls}")
        
        # Ищем ссылки на файлы: href="/assets/..." или href="assets/..."
        if not file_urls and '<a href=' in user_message:
            href_matches = re.findall(r'href=["\']([^"\']*assets/[^"\']+)["\']', user_message)
            if href_matches:
                file_urls = [url.lstrip('/') for url in href_matches]
                if not image_url:
                    image_url = file_urls[0]
                print(f"📎 Извлечены file_url из сообщения: {file_urls}")
        
        # Также ищем упоминания файлов в тексте (для случаев, когда файл уже загружен)
        # Ищем паттерны типа "assets/file_xxx.pdf" в тексте
        text_file_matches = re.findall(r'assets/[a-zA-Z0-9_\-\.]+', user_message)
        for match in text_file_matches:
            if match not in file_urls:
                file_urls.append(match)
        
        # Сохраняем сообщение пользователя
        user_msg = Message(
            chat_id=chat.id,
            role="user",
            content=user_message,
            image_url=image_url
        )
        db.add(user_msg)
        db.flush()  # Получаем ID сообщения для связи с FileAttachment
        
        # Ищем FileAttachment по нескольким критериям
        file_attachments = []
        
        # 1. Ищем по file_path из сообщения
        if file_urls:
            for file_url in file_urls:
                attachment = db.query(FileAttachment).filter(
                    FileAttachment.file_path == file_url,
                    FileAttachment.user_id == current_user.id
                ).order_by(FileAttachment.created_at.desc()).first()
                if attachment and attachment not in file_attachments:
                    file_attachments.append(attachment)
        
        # 2. Ищем файлы, загруженные в этом чате (если chat_id был указан при загрузке)
        chat_attachments = db.query(FileAttachment).filter(
            FileAttachment.chat_id == chat.id,
            FileAttachment.user_id == current_user.id,
            FileAttachment.message_id.is_(None)  # Еще не связанные с сообщением
        ).order_by(FileAttachment.created_at.desc()).limit(5).all()
        
        for attachment in chat_attachments:
            if attachment not in file_attachments:
                file_attachments.append(attachment)
        
        # 3. Ищем недавно загруженные файлы пользователя (за последние 10 минут)
        recent_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        recent_attachments = db.query(FileAttachment).filter(
            FileAttachment.user_id == current_user.id,
            FileAttachment.message_id.is_(None),
            FileAttachment.created_at >= recent_time
        ).order_by(FileAttachment.created_at.desc()).limit(5).all()
        
        for attachment in recent_attachments:
            if attachment not in file_attachments:
                file_attachments.append(attachment)
        
        # Связываем найденные файлы с сообщением
        for file_attachment in file_attachments:
            if not file_attachment.message_id:
                file_attachment.message_id = user_msg.id
                print(f"✅ Связан FileAttachment {file_attachment.id} ({file_attachment.filename}) с сообщением {user_msg.id}")
        
        db.flush()  # Сохраняем связи в БД
        
        # Собираем содержимое всех файлов для контекста
        file_content_context = ""
        for file_attachment in file_attachments:
            if file_attachment.extracted_text:
                # Для PDF/DOC файлов добавляем извлеченный текст
                file_content_context += f"\n\n[Содержимое файла {file_attachment.filename}]:\n{file_attachment.extracted_text}"
                print(f"📄 Добавлен текст из файла {file_attachment.filename}: {len(file_attachment.extracted_text)} символов")
            elif file_attachment.analysis_result:
                # Для изображений добавляем результат анализа
                file_content_context += f"\n\n[Анализ изображения {file_attachment.filename}]:\n{file_attachment.analysis_result}"
                print(f"🖼️ Добавлен анализ изображения {file_attachment.filename}: {len(file_attachment.analysis_result)} символов")
        
        # Добавляем содержимое файла к сообщению пользователя для LLM
        if file_content_context:
            user_message_with_file = user_message + file_content_context
        else:
            user_message_with_file = user_message

        # Сохраняем активность пользователя для аналитики эффективности
        today = datetime.now(timezone.utc).date()
        activity = db.query(UserActivity).filter(
            UserActivity.user_id == current_user.id,
            UserActivity.activity_date == today
        ).first()

        if activity:
            activity.message_count += 1
            activity.updated_at = datetime.now(timezone.utc)
        else:
            activity = UserActivity(
                user_id=current_user.id,
                activity_date=today,
                message_count=1
            )
            db.add(activity)

        db.commit()
        db.refresh(user_msg)

        # Проверяем быстрые ответы (только для простых сообщений без файлов)
        if not file_content_context:
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

        # Извлекаем чистый текст из HTML для классификации
        # Убираем HTML-теги и оставляем только текст для классификатора
        import re
        text_for_classification = user_message_with_file
        
        # Убираем HTML-теги, оставляем только текст
        text_for_classification = re.sub(r'<[^>]+>', ' ', text_for_classification)
        # Убираем лишние пробелы
        text_for_classification = ' '.join(text_for_classification.split())
        
        # Если после удаления HTML остался только пробел или пусто, используем содержимое файла
        if not text_for_classification.strip() and file_content_context:
            # Используем только содержимое файла для классификации
            text_for_classification = file_content_context.replace('[Содержимое файла', '').replace(']:', ':').strip()
            # Берем первые 500 символов для классификации
            text_for_classification = text_for_classification[:500]
        
        # Если все еще пусто, используем оригинальное сообщение
        if not text_for_classification.strip():
            text_for_classification = user_message
        
        print(f"🔍 Текст для классификации ({len(text_for_classification)} символов): {text_for_classification[:200]}...")
        
        # Получаем усиленный промпт и категорию (используем очищенный текст)
        enhanced_prompt, category, probabilities = get_enhanced_system_prompt(text_for_classification)

        # Если категория 'graphic', обрабатываем специальным образом
        # НО только если в сообщении есть явный запрос на график (не просто файл)
        if category == 'graphic':
            # Проверяем, есть ли в сообщении явный запрос на график
            graphic_keywords = ['график', 'диаграмма', 'chart', 'plot', 'график по', 'построй', 'создай график', 'визуализ']
            has_graphic_request = any(keyword in text_for_classification.lower() for keyword in graphic_keywords)
            
            if has_graphic_request:
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
            else:
                # Если категория определилась как graphic, но нет явного запроса,
                # вероятно это ложное срабатывание из-за HTML или содержимого файла
                # Переопределяем категорию на general и продолжаем обычную обработку
                print(f"⚠️ Категория 'graphic' определена, но нет явного запроса на график. Переопределяем на 'general'")
                category = 'general'
                base_prompt = "Ты — бизнес-консультант для малого бизнеса. Отвечай кратко и по делу. Используй списки по 2-4 пункта. Будь конкретен и практичен."
                enhanced_prompt = f"{base_prompt}\n\n{CATEGORY_PROMPTS['general']}"
                enhanced_prompt += f"\n\n[Категория вопроса: general]"
                probabilities = {'general': 1.0}
                # Продолжаем обычную обработку ниже

        # Для остальных категорий - проверяем кэш (используем оригинальное сообщение без файла для кэша)
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

        print(f"📨 Отправляем запрос в LLM: {user_message[:200]}...")
        if file_content_context:
            print(f"📎 Включено содержимое файла в контекст")

        # Получаем ВСЮ историю сообщений для контекста
        conversation_history = get_conversation_history(chat.id, db, max_messages=15)

        print(f"📚 Используем историю из {len(conversation_history)} сообщений для контекста")

        # Генерируем ответ с учетом всей истории чата (используем сообщение с содержимым файла)
        try:
            ai_response = llm_service.generate_response(
                system_prompt=enhanced_prompt,
                user_question=user_message_with_file,
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
    try:
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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке истории чатов: {str(e)}")


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
        # Регенерируем HTML для отображения файлов (изображения или документы)
        content = msg.content
        # Проверяем, есть ли файл (image_url может быть и для документов)
        if msg.image_url:
            image_src = f"/{msg.image_url}"
            if msg.role == 'assistant':
                # Регенерируем HTML с изображением для ассистента (графики)
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
            elif msg.role == 'user':
                # Для пользователя: если в content уже есть HTML с файлом, оставляем как есть
                # Иначе формируем HTML с файлом
                if '<img' not in content and '<div class="uploaded-file' not in content and '<a href=' not in content:
                    # Получаем информацию о файле из FileAttachment
                    file_attachment = db.query(FileAttachment).filter(
                        FileAttachment.message_id == msg.id
                    ).first()
                    
                    if file_attachment:
                        filename = file_attachment.filename
                        file_path = file_attachment.file_path
                        file_type = file_attachment.file_type
                        
                        # Для изображений показываем само изображение
                        if file_type == 'image':
                            analysis_html = ''
                            if file_attachment.analysis_result:
                                analysis_html = f'''
                                <details class="uploaded-file-analysis" style="margin-top: 12px;">
                                    <summary style="cursor: pointer; color: var(--color-primary); font-weight: 500; user-select: none;">🔍 Показать анализ изображения</summary>
                                    <div style="margin-top: 8px; padding: 12px; background: var(--color-hover); border-radius: 8px; font-size: 14px; line-height: 1.6;">
                                        {file_attachment.analysis_result}
                                    </div>
                                </details>
                                '''
                            content = f'''
                            <div class="uploaded-file-container">
                                <div class="uploaded-file-header" style="margin-bottom: 8px; font-weight: 500;">
                                    📎 {filename}
                                </div>
                                <div class="uploaded-file-image">
                                    <img src="/{file_path}" alt="{filename}" style="max-width: 100%; max-height: 500px; border-radius: 8px; object-fit: contain;" />
                                </div>
                                {analysis_html}
                            </div>
                            '''
                        else:
                            # Для PDF/DOC файлов показываем только ссылку на файл, без извлеченного текста
                            content = f'''
                            <div class="uploaded-file-container">
                                <div class="uploaded-file-header" style="margin-bottom: 8px; font-weight: 500;">
                                    📎 <a href="/{file_path}" target="_blank" style="color: var(--color-primary); text-decoration: none;">{filename}</a>
                                </div>
                            </div>
                            '''
                    else:
                        # Fallback: если FileAttachment не найден, используем image_url
                        filename = msg.image_url.split('/')[-1] if '/' in msg.image_url else msg.image_url
                        content = f'''
                        <div class="uploaded-file-container">
                            <div class="uploaded-file-header" style="margin-bottom: 8px; font-weight: 500;">
                                📎 <a href="{image_src}" target="_blank" style="color: var(--color-primary); text-decoration: none;">{filename}</a>
                            </div>
                        </div>
                        '''

        message_items.append(MessageItem(
            id=msg.id,
            role=msg.role,
            content=content,
            image_url=msg.image_url,
            created_at=msg.created_at.isoformat(),
            tags=[{"id": tag.id, "name": tag.name, "color": tag.color} for tag in msg.tags]
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


class ActivityRecord(BaseModel):
    date: str  # ISO date string (YYYY-MM-DD)
    count: int

    class Config:
        from_attributes = True


class EfficiencyResponse(BaseModel):
    activities: List[ActivityRecord]
    total: int
    average: float


@router.get("/activity/efficiency", response_model=EfficiencyResponse)
async def get_efficiency_data(
    period: str = Query("year", description="Период: day, week, month, year"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить данные эффективности пользователя"""
    from datetime import timedelta

    today = datetime.now(timezone.utc).date()

    # Определяем диапазон дат в зависимости от периода
    if period == "day":
        start_date = today
        end_date = today
    elif period == "week":
        start_date = today - timedelta(days=6)
        end_date = today
    elif period == "month":
        start_date = today - timedelta(days=29)
        end_date = today
    else:  # year
        start_date = today - timedelta(days=365)
        end_date = today

    # Получаем активность за период
    activities = db.query(UserActivity).filter(
        UserActivity.user_id == current_user.id,
        UserActivity.activity_date >= start_date,
        UserActivity.activity_date <= end_date
    ).order_by(UserActivity.activity_date).all()

    # Преобразуем в формат для фронтенда
    activity_records = [
        ActivityRecord(
            date=activity.activity_date.isoformat(),
            count=activity.message_count
        )
        for activity in activities
    ]

    total = sum(a.count for a in activity_records)
    average = total / len(activity_records) if activity_records else 0

    return EfficiencyResponse(
        activities=activity_records,
        total=total,
        average=round(average, 2)
    )


class HourlyActivityRecord(BaseModel):
    hour: int  # 0-23
    count: int


class HourlyActivityResponse(BaseModel):
    hourly_data: List[HourlyActivityRecord]
    peak_hour: int
    peak_count: int


@router.get("/activity/hourly", response_model=HourlyActivityResponse)
async def get_hourly_activity(
    days: int = Query(7, ge=1, le=30, description="Количество дней для анализа"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить данные активности по часам за последние N дней"""
    from datetime import timedelta
    from sqlalchemy import func, extract

    today = datetime.now(timezone.utc)
    start_date = today - timedelta(days=days)

    # Получаем сообщения пользователя за период и группируем по часам
    hourly_stats = db.query(
        extract('hour', Message.created_at).label('hour'),
        func.count(Message.id).label('count')
    ).join(
        Chat, Message.chat_id == Chat.id
    ).filter(
        Chat.user_id == current_user.id,
        Message.role == 'user',  # Только сообщения пользователя
        Message.created_at >= start_date
    ).group_by(
        extract('hour', Message.created_at)
    ).order_by(
        extract('hour', Message.created_at)
    ).all()

    # Создаем массив для всех 24 часов
    hourly_data_dict = {i: 0 for i in range(24)}
    for stat in hourly_stats:
        hour = int(stat.hour)
        hourly_data_dict[hour] = stat.count

    # Преобразуем в список
    hourly_records = [
        HourlyActivityRecord(hour=hour, count=count)
        for hour, count in sorted(hourly_data_dict.items())
    ]

    # Находим пиковый час
    peak_hour = max(hourly_records, key=lambda x: x.count).hour
    peak_count = max(hourly_records, key=lambda x: x.count).count

    return HourlyActivityResponse(
        hourly_data=hourly_records,
        peak_hour=peak_hour,
        peak_count=peak_count
    )


class TranscribeResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    audio_url: Optional[str] = None  # URL сохраненного аудио файла
    error: Optional[str] = None


@router.post("/chat/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Транскрибация аудио в текст через Whisper API"""
    try:
        # Проверяем формат файла
        if not audio.content_type or not audio.content_type.startswith('audio/'):
            # Разрешаем webm и другие форматы
            if not audio.filename or not any(audio.filename.endswith(ext) for ext in ['.webm', '.mp3', '.wav', '.m4a', '.ogg']):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Файл должен быть аудио форматом (webm, mp3, wav, m4a, ogg)"
                )
        
        # Читаем аудио файл
        audio_bytes = await audio.read()
        
        print(f"📥 Получен аудио файл:")
        print(f"   - Размер: {len(audio_bytes)} байт ({len(audio_bytes) / 1024:.2f} KB)")
        print(f"   - Content-Type: {audio.content_type}")
        print(f"   - Имя файла: {audio.filename}")
        
        if len(audio_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Аудио файл пустой"
            )
        
        # Проверяем минимальный размер (например, 1KB для очень коротких записей)
        if len(audio_bytes) < 1024:
            print(f"⚠️ Аудио файл очень маленький ({len(audio_bytes)} байт), возможно запись слишком короткая")
        
        # Определяем язык (можно сделать параметром)
        language = "ru"  # По умолчанию русский
        
        # Сохраняем аудио файл в папку assets
        import uuid
        from pathlib import Path
        
        # Определяем путь к папке assets (как в main.py)
        # В Docker контейнере структура: /app/backend/assets
        backend_dir = Path(__file__).parent.parent.parent  # backend/
        assets_dir = backend_dir / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем уникальное имя файла
        file_extension = Path(audio.filename or "recording.webm").suffix or ".webm"
        unique_filename = f"audio_{uuid.uuid4().hex[:12]}{file_extension}"
        saved_audio_path = assets_dir / unique_filename
        
        # Сохраняем файл
        with open(saved_audio_path, 'wb') as f:
            f.write(audio_bytes)
        
        # Формируем относительный путь для URL
        audio_url = f"assets/{unique_filename}"
        print(f"💾 Аудио файл сохранен: {audio_url} ({len(audio_bytes)} байт)")
        
        # Используем LLMService для транскрибации
        filename = audio.filename or "recording.webm"
        print(f"🔄 Начинаем транскрибацию...")
        text = None
        error_message = None
        try:
            text = llm_service.transcribe_audio(audio_bytes, filename, language)
            if text:
                print(f"✅ Транскрибация завершена, распознано: '{text}'")
            else:
                error_message = "Транскрибация не вернула результат"
                print(f"⚠️ {error_message}, но аудио файл сохранен")
        except TimeoutError as e:
            error_message = f"Транскрибация превысила таймаут: {str(e)}"
            print(f"⏱️ {error_message}, но аудио файл сохранен")
        except ValueError as e:
            error_message = str(e)
            print(f"⚠️ Ошибка транскрибации: {error_message}, но аудио файл сохранен")
        except Exception as e:
            error_message = f"Неожиданная ошибка транскрибации: {str(e)}"
            print(f"❌ {error_message}, но аудио файл сохранен")
            import traceback
            traceback.print_exc()
        
        # Возвращаем ответ: успех если есть текст, иначе ошибка (но файл сохранен)
        if text:
            return TranscribeResponse(
                success=True,
                text=text,
                audio_url=audio_url
            )
        else:
            return TranscribeResponse(
                success=False,
                text=None,
                audio_url=audio_url,
                error=error_message or "Не удалось распознать речь"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Критическая ошибка транскрибации: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки аудио: {str(e)}"
        )


class FileUploadResponse(BaseModel):
    success: bool
    file_id: Optional[int] = None
    file_url: Optional[str] = None
    filename: Optional[str] = None
    file_type: Optional[str] = None
    extracted_text: Optional[str] = None
    analysis_result: Optional[str] = None
    error: Optional[str] = None


@router.post("/chat/upload-file", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    chat_id: Optional[int] = Query(None),
    space_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Загрузка файла (PDF, DOC/DOCX, изображения) с анализом содержимого
    """
    try:
        # Проверяем формат файла
        allowed_extensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
        allowed_mime_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'
        ]
        
        file_ext = Path(file.filename or "").suffix.lower()
        mime_type = file.content_type or ""
        
        if file_ext not in allowed_extensions and mime_type not in allowed_mime_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Неподдерживаемый формат файла. Разрешены: {', '.join(allowed_extensions)}"
            )
        
        # Читаем файл
        file_bytes = await file.read()
        
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Файл пустой"
            )
        
        # Проверяем максимальный размер (50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if len(file_bytes) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Файл слишком большой. Максимальный размер: 50MB"
            )
        
        print(f"📥 Получен файл:")
        print(f"   - Имя: {file.filename}")
        print(f"   - Размер: {len(file_bytes)} байт ({len(file_bytes) / 1024:.2f} KB)")
        print(f"   - MIME type: {mime_type}")
        print(f"   - Расширение: {file_ext}")
        
        # Определяем путь к папке assets
        backend_dir = Path(__file__).parent.parent.parent
        assets_dir = backend_dir / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем уникальное имя файла
        unique_filename = f"file_{uuid.uuid4().hex[:12]}{file_ext}"
        saved_file_path = assets_dir / unique_filename
        
        # Сохраняем файл
        with open(saved_file_path, 'wb') as f:
            f.write(file_bytes)
        
        # Формируем относительный путь для URL
        file_url = f"assets/{unique_filename}"
        print(f"💾 Файл сохранен: {file_url}")
        
        # Анализируем файл
        analysis_result = None
        extracted_text = None
        file_type = file_ext[1:] if file_ext else "unknown"
        
        try:
            file_analysis = FileAnalysisService.analyze_file(
                file_bytes=file_bytes,
                filename=file.filename or unique_filename,
                mime_type=mime_type,
                llm_service=llm_service
            )
            
            extracted_text = file_analysis.get("extracted_text")
            analysis_result = file_analysis.get("analysis_result")
            file_type = file_analysis.get("file_type", file_type)
            
            if extracted_text:
                print(f"✅ Извлечен текст из {file.filename}: {len(extracted_text)} символов")
                # Убеждаемся, что текст не пустой
                if not extracted_text.strip():
                    print(f"⚠️ Извлеченный текст пустой, устанавливаем в None")
                    extracted_text = None
            else:
                print(f"ℹ️ Текст не извлечен из {file.filename} (возможно, это изображение или файл без текста)")
                
            if analysis_result:
                print(f"✅ Результат анализа изображения {file.filename}: {len(analysis_result)} символов")
                
        except Exception as e:
            print(f"⚠️ Ошибка анализа файла: {e}")
            import traceback
            traceback.print_exc()
            # Продолжаем выполнение, даже если анализ не удался
            # extracted_text и analysis_result остаются None
        
        # Определяем chat_id и space_id если не указаны
        if not chat_id and not space_id:
            # Создаем или получаем дефолтное пространство
            default_space = get_or_create_default_space(current_user, db)
            space_id = default_space.id
        
        # Создаем запись в БД
        file_attachment = FileAttachment(
            chat_id=chat_id,
            space_id=space_id,
            user_id=current_user.id,
            filename=file.filename or unique_filename,
            file_path=file_url,
            file_type=file_type,
            file_size=len(file_bytes),
            mime_type=mime_type,
            extracted_text=extracted_text,  # Сохраняем извлеченный текст в БД
            analysis_result=analysis_result  # Сохраняем результат анализа в БД
        )
        
        db.add(file_attachment)
        db.commit()
        db.refresh(file_attachment)
        
        print(f"✅ Файл загружен и сохранен в БД (ID: {file_attachment.id})")
        if extracted_text:
            print(f"   📄 Текст сохранен в БД: {len(extracted_text)} символов")
        if analysis_result:
            print(f"   🖼️ Анализ сохранен в БД: {len(analysis_result)} символов")
        
        return FileUploadResponse(
            success=True,
            file_id=file_attachment.id,
            file_url=file_url,
            filename=file.filename or unique_filename,
            file_type=file_attachment.file_type,
            extracted_text=extracted_text,
            analysis_result=analysis_result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка загрузки файла: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка загрузки файла: {str(e)}"
        )


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


class MessageFeedbackRequest(BaseModel):
    message_id: int
    reasons: List[str]
    feedback_text: Optional[str] = None


class MessageFeedbackResponse(BaseModel):
    success: bool
    message: str
    feedback_id: Optional[int] = None


@router.post("/message/feedback", response_model=MessageFeedbackResponse, status_code=201)
async def submit_message_feedback(
    request: MessageFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отправка обратной связи по сообщению ассистента"""
    from backend.app.models.message_feedback import MessageFeedback
    try:
        # Проверяем, что сообщение существует
        message = db.query(Message).filter(Message.id == request.message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Сообщение не найдено")
        
        # Проверяем, что сообщение принадлежит ассистенту
        if message.role != 'assistant':
            raise HTTPException(status_code=400, detail="Обратная связь можно оставить только для сообщений ассистента")
        
        # Проверяем, что чат принадлежит пользователю
        chat = db.query(Chat).filter(Chat.id == message.chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")
        
        if chat.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")
        
        # Проверяем, что reasons не пустой
        if not request.reasons or len(request.reasons) == 0:
            raise HTTPException(status_code=400, detail="Необходимо указать хотя бы одну причину")
        
        # Создаем запись обратной связи
        feedback = MessageFeedback(
            message_id=request.message_id,
            user_id=current_user.id,
            chat_id=message.chat_id,
            reasons=request.reasons,
            feedback_text=request.feedback_text
        )
        
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        
        return MessageFeedbackResponse(
            success=True,
            message="Обратная связь успешно отправлена",
            feedback_id=feedback.id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении обратной связи: {str(e)}")


# ========== Работа с тегами сообщений ==========

class MessageTagAssignRequest(BaseModel):
    tag_ids: List[int]


class MessageTagAssignResponse(BaseModel):
    success: bool
    message: str
    tags: List[dict]


@router.post("/message/{message_id}/tags/assign", response_model=MessageTagAssignResponse, status_code=200)
async def assign_tags_to_message(
    message_id: int,
    request: MessageTagAssignRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Присвоить теги сообщению"""
    try:
        from backend.app.models.tag import Tag
        
        # Проверяем, что сообщение существует
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Сообщение не найдено")
        
        # Проверяем, что чат принадлежит пользователю
        chat = db.query(Chat).filter(Chat.id == message.chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")
        
        if chat.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")
        
        # Получаем пространство чата
        space = db.query(Space).filter(Space.id == chat.space_id).first()
        if not space:
            raise HTTPException(status_code=404, detail="Пространство не найдено")
        
        # Проверяем, что все теги существуют и принадлежат пространству
        tags = db.query(Tag).filter(
            Tag.id.in_(request.tag_ids),
            Tag.space_id == space.id
        ).all()
        
        if len(tags) != len(request.tag_ids):
            raise HTTPException(status_code=400, detail="Один или несколько тегов не найдены или не принадлежат пространству")
        
        # Присваиваем теги сообщению (заменяем существующие)
        message.tags = tags
        db.commit()
        db.refresh(message)
        
        return MessageTagAssignResponse(
            success=True,
            message="Теги успешно присвоены сообщению",
            tags=[{"id": tag.id, "name": tag.name, "color": tag.color} for tag in message.tags]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при присвоении тегов: {str(e)}")


@router.delete("/message/{message_id}/tags/remove/{tag_id}", response_model=dict, status_code=200)
async def remove_tag_from_message(
    message_id: int,
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить тег из сообщения"""
    try:
        from sqlalchemy import func, select
        from backend.app.models.message_tag import message_tags
        from backend.app.models.note_tag import note_tags
        from backend.app.models.tag import Tag

        # Проверяем, что сообщение существует
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Сообщение не найдено")
        
        # Проверяем, что чат принадлежит пользователю
        chat = db.query(Chat).filter(Chat.id == message.chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")
        
        if chat.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чату")

        # Получаем пространство чата
        space = db.query(Space).filter(Space.id == chat.space_id).first()
        if not space:
            raise HTTPException(status_code=404, detail="Пространство не найдено")
        
        # Удаляем тег из сообщения
        tag_to_remove = None
        for tag in message.tags:
            if tag.id == tag_id:
                tag_to_remove = tag
                break
        
        if tag_to_remove:
            message.tags.remove(tag_to_remove)
            db.commit()
            
            # Если тег больше нигде не используется (ни в сообщениях, ни в заметках) в этом пространстве,
            # удаляем сам объект тега из пространства.
            message_usage = db.execute(
                select(func.count()).select_from(message_tags).where(message_tags.c.tag_id == tag_id)
            ).scalar_one()
            note_usage = db.execute(
                select(func.count()).select_from(note_tags).where(note_tags.c.tag_id == tag_id)
            ).scalar_one()

            if message_usage == 0 and note_usage == 0:
                tag_entity = db.query(Tag).filter(
                    Tag.id == tag_id,
                    Tag.space_id == space.id
                ).first()
                if tag_entity:
                    db.delete(tag_entity)
                    db.commit()

            return {"success": True, "message": "Тег успешно удален из сообщения"}
        else:
            raise HTTPException(status_code=404, detail="Тег не найден в сообщении")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении тега: {str(e)}")