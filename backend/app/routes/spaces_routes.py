from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from sqlalchemy import desc
import json
import zipfile
import io
from datetime import datetime

from backend.app.database.connection import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.models.space import Space
from backend.app.models.chat import Chat
from backend.app.models.message import Message
from backend.app.models.note import Note
from backend.app.models.tag import Tag
from backend.app.models.notification_settings import NotificationSettings

router = APIRouter()


# ========== Pydantic модели ==========

class SpaceCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class SpaceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class SpaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_archived: bool
    created_at: str
    updated_at: str
    chats_count: int = 0
    notes_count: int = 0
    tags_count: int = 0

    class Config:
        from_attributes = True


class SpaceListResponse(BaseModel):
    spaces: List[SpaceResponse]
    total: int


class TagCreateRequest(BaseModel):
    name: str
    color: Optional[str] = None
    tag_type: Optional[str] = None


class TagUpdateRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    tag_type: Optional[str] = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: Optional[str]
    tag_type: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class TagsListResponse(BaseModel):
    tags: List[TagResponse]
    total: int


class NotificationSettingsRequest(BaseModel):
    settings_json: Optional[Dict[str, Any]] = None


class NotificationSettingsResponse(BaseModel):
    id: int
    space_id: int
    settings_json: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


# ========== Базовый CRUD для пространств ==========

@router.get("", response_model=SpaceListResponse)
async def list_spaces(
    include_archived: bool = Query(False, description="Включить архивированные пространства"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список пространств пользователя"""
    query = db.query(Space).filter(Space.user_id == current_user.id)
    
    if not include_archived:
        query = query.filter(Space.is_archived == False)
    
    total = query.count()
    
    spaces = query.order_by(desc(Space.updated_at)).offset(offset).limit(limit).all()
    
    space_items = []
    for space in spaces:
        # Подсчитываем количество связанных объектов
        chats_count = db.query(Chat).filter(Chat.space_id == space.id).count()
        notes_count = db.query(Note).filter(Note.space_id == space.id).count()
        tags_count = db.query(Tag).filter(Tag.space_id == space.id).count()
        
        space_items.append(SpaceResponse(
            id=space.id,
            name=space.name,
            description=space.description,
            is_archived=space.is_archived,
            created_at=space.created_at.isoformat(),
            updated_at=space.updated_at.isoformat(),
            chats_count=chats_count,
            notes_count=notes_count,
            tags_count=tags_count
        ))
    
    return SpaceListResponse(spaces=space_items, total=total)


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
async def create_space(
    space_data: SpaceCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новое пространство"""
    if not space_data.name or not space_data.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название пространства не может быть пустым"
        )
    
    new_space = Space(
        user_id=current_user.id,
        name=space_data.name.strip(),
        description=space_data.description.strip() if space_data.description else None
    )
    
    db.add(new_space)
    db.commit()
    db.refresh(new_space)
    
    return SpaceResponse(
        id=new_space.id,
        name=new_space.name,
        description=new_space.description,
        is_archived=new_space.is_archived,
        created_at=new_space.created_at.isoformat(),
        updated_at=new_space.updated_at.isoformat(),
        chats_count=0,
        notes_count=0,
        tags_count=0
    )


@router.get("/{space_id}", response_model=SpaceResponse)
async def get_space(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить пространство по ID"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    chats_count = db.query(Chat).filter(Chat.space_id == space.id).count()
    notes_count = db.query(Note).filter(Note.space_id == space.id).count()
    tags_count = db.query(Tag).filter(Tag.space_id == space.id).count()
    
    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_archived=space.is_archived,
        created_at=space.created_at.isoformat(),
        updated_at=space.updated_at.isoformat(),
        chats_count=chats_count,
        notes_count=notes_count,
        tags_count=tags_count
    )


@router.put("/{space_id}", response_model=SpaceResponse)
async def update_space(
    space_id: int,
    space_data: SpaceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить пространство"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    if space_data.name is not None:
        if not space_data.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название пространства не может быть пустым"
            )
        space.name = space_data.name.strip()
    
    if space_data.description is not None:
        space.description = space_data.description.strip() if space_data.description else None
    
    db.commit()
    db.refresh(space)
    
    chats_count = db.query(Chat).filter(Chat.space_id == space.id).count()
    notes_count = db.query(Note).filter(Note.space_id == space.id).count()
    tags_count = db.query(Tag).filter(Tag.space_id == space.id).count()
    
    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_archived=space.is_archived,
        created_at=space.created_at.isoformat(),
        updated_at=space.updated_at.isoformat(),
        chats_count=chats_count,
        notes_count=notes_count,
        tags_count=tags_count
    )


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_space(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить пространство"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    db.delete(space)
    db.commit()
    
    return None


# ========== Архивация пространств ==========

@router.post("/{space_id}/archive", response_model=SpaceResponse)
async def archive_space(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Архивировать пространство"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    space.is_archived = True
    db.commit()
    db.refresh(space)
    
    chats_count = db.query(Chat).filter(Chat.space_id == space.id).count()
    notes_count = db.query(Note).filter(Note.space_id == space.id).count()
    tags_count = db.query(Tag).filter(Tag.space_id == space.id).count()
    
    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_archived=space.is_archived,
        created_at=space.created_at.isoformat(),
        updated_at=space.updated_at.isoformat(),
        chats_count=chats_count,
        notes_count=notes_count,
        tags_count=tags_count
    )


@router.post("/{space_id}/unarchive", response_model=SpaceResponse)
async def unarchive_space(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Разархивировать пространство"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    space.is_archived = False
    db.commit()
    db.refresh(space)
    
    chats_count = db.query(Chat).filter(Chat.space_id == space.id).count()
    notes_count = db.query(Note).filter(Note.space_id == space.id).count()
    tags_count = db.query(Tag).filter(Tag.space_id == space.id).count()
    
    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_archived=space.is_archived,
        created_at=space.created_at.isoformat(),
        updated_at=space.updated_at.isoformat(),
        chats_count=chats_count,
        notes_count=notes_count,
        tags_count=tags_count
    )


# ========== Настройки уведомлений ==========

@router.get("/{space_id}/notifications/settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки уведомлений для пространства"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    settings = db.query(NotificationSettings).filter(
        NotificationSettings.space_id == space_id
    ).first()
    
    if not settings:
        # Создаем дефолтные настройки
        settings = NotificationSettings(
            space_id=space_id,
            user_id=current_user.id,
            settings_json={
                "new_message": True,
                "new_note": True,
                "new_file": True
            }
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return NotificationSettingsResponse(
        id=settings.id,
        space_id=settings.space_id,
        settings_json=settings.settings_json
    )


@router.post("/{space_id}/notifications/settings", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    space_id: int,
    settings_data: NotificationSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить настройки уведомлений для пространства"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    settings = db.query(NotificationSettings).filter(
        NotificationSettings.space_id == space_id
    ).first()
    
    if not settings:
        settings = NotificationSettings(
            space_id=space_id,
            user_id=current_user.id,
            settings_json=settings_data.settings_json or {}
        )
        db.add(settings)
    else:
        if settings_data.settings_json is not None:
            settings.settings_json = settings_data.settings_json
    
    db.commit()
    db.refresh(settings)
    
    return NotificationSettingsResponse(
        id=settings.id,
        space_id=settings.space_id,
        settings_json=settings.settings_json
    )


# ========== Работа с тегами ==========

@router.post("/{space_id}/tags/create", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    space_id: int,
    tag_data: TagCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать тег в пространстве"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    if not tag_data.name or not tag_data.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название тега не может быть пустым"
        )
    
    # Проверяем, нет ли уже тега с таким именем в пространстве
    existing_tag = db.query(Tag).filter(
        Tag.space_id == space_id,
        Tag.name == tag_data.name.strip()
    ).first()
    
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тег с таким именем уже существует в этом пространстве"
        )
    
    new_tag = Tag(
        space_id=space_id,
        name=tag_data.name.strip(),
        color=tag_data.color,
        tag_type=tag_data.tag_type
    )
    
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return TagResponse(
        id=new_tag.id,
        name=new_tag.name,
        color=new_tag.color,
        tag_type=new_tag.tag_type,
        created_at=new_tag.created_at.isoformat()
    )


@router.get("/{space_id}/tags", response_model=TagsListResponse)
async def list_tags(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список тегов в пространстве"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    tags = db.query(Tag).filter(Tag.space_id == space_id).order_by(Tag.name).all()
    
    tag_items = [
        TagResponse(
            id=tag.id,
            name=tag.name,
            color=tag.color,
            tag_type=tag.tag_type,
            created_at=tag.created_at.isoformat()
        )
        for tag in tags
    ]
    
    return TagsListResponse(tags=tag_items, total=len(tag_items))


@router.put("/{space_id}/tags/{tag_id}", response_model=TagResponse)
async def update_tag(
    space_id: int,
    tag_id: int,
    tag_data: TagUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить тег"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.space_id == space_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тег не найден"
        )
    
    if tag_data.name is not None:
        if not tag_data.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название тега не может быть пустым"
            )
        # Проверяем уникальность имени
        existing_tag = db.query(Tag).filter(
            Tag.space_id == space_id,
            Tag.name == tag_data.name.strip(),
            Tag.id != tag_id
        ).first()
        if existing_tag:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Тег с таким именем уже существует в этом пространстве"
            )
        tag.name = tag_data.name.strip()
    
    if tag_data.color is not None:
        tag.color = tag_data.color
    
    if tag_data.tag_type is not None:
        tag.tag_type = tag_data.tag_type
    
    db.commit()
    db.refresh(tag)
    
    return TagResponse(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        tag_type=tag.tag_type,
        created_at=tag.created_at.isoformat()
    )


@router.delete("/{space_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    space_id: int,
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить тег"""
    space = db.query(Space).filter(
        Space.id == space_id,
        Space.user_id == current_user.id
    ).first()
    
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пространство не найдено"
        )
    
    tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.space_id == space_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тег не найден"
        )
    
    db.delete(tag)
    db.commit()
    
    return None


# ========== Экспорт/импорт пространств ==========

@router.post("/{space_id}/export")
async def export_space(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Экспорт всех данных пространства в JSON архив"""
    try:
        space = db.query(Space).filter(
            Space.id == space_id,
            Space.user_id == current_user.id
        ).first()
        
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пространство не найдено"
            )
        
        # Собираем все данные пространства
        export_data = {
            "space": {
                "id": space.id,
                "name": space.name,
                "description": space.description,
                "is_archived": space.is_archived,
                "created_at": space.created_at.isoformat(),
                "updated_at": space.updated_at.isoformat()
            },
            "chats": [],
            "messages": [],
            "notes": [],
            "tags": []
        }
        
        # Экспортируем чаты
        chats = db.query(Chat).filter(Chat.space_id == space_id).all()
        for chat in chats:
            export_data["chats"].append({
                "id": chat.id,
                "title": chat.title,
                "created_at": chat.created_at.isoformat(),
                "updated_at": chat.updated_at.isoformat()
            })
            
            # Экспортируем сообщения чата
            messages = db.query(Message).filter(Message.chat_id == chat.id).all()
            for msg in messages:
                export_data["messages"].append({
                    "chat_id": msg.chat_id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat()
                })
        
        # Экспортируем заметки
        notes = db.query(Note).filter(Note.space_id == space_id).all()
        for note in notes:
            note_data = {
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "created_at": note.created_at.isoformat(),
                "updated_at": note.updated_at.isoformat(),
                "tags": [{"id": tag.id, "name": tag.name} for tag in note.tags]
            }
            export_data["notes"].append(note_data)
        
        # Экспортируем теги
        tags = db.query(Tag).filter(Tag.space_id == space_id).all()
        for tag in tags:
            export_data["tags"].append({
                "id": tag.id,
                "name": tag.name,
                "color": tag.color,
                "tag_type": tag.tag_type,
                "created_at": tag.created_at.isoformat()
            })
        
        # Создаем JSON строку
        json_data = json.dumps(export_data, ensure_ascii=False, indent=2)
        
        # Создаем ZIP архив в памяти
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr(f"space_{space_id}_export.json", json_data.encode('utf-8'))
        
        zip_buffer.seek(0)
        
        # Экранируем имя файла для безопасной передачи в заголовке
        safe_filename = space.name.replace(' ', '_').replace('/', '_').replace('\\', '_')
        safe_filename = ''.join(c for c in safe_filename if c.isalnum() or c in ('_', '-', '.'))
        
        from fastapi.responses import Response
        
        print(f"✅ Экспорт пространства {space_id} ({space.name}): {len(export_data['chats'])} чатов, {len(export_data['messages'])} сообщений, {len(export_data['notes'])} заметок")
        
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="space_{space_id}_{safe_filename}_export.zip"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка экспорта пространства {space_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при экспорте пространства: {str(e)}"
        )


@router.post("/import")
async def import_space(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Импорт архива для восстановления пространства или миграции"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл должен быть ZIP архивом"
        )
    
    # Читаем файл
    file_content = await file.read()
    zip_buffer = io.BytesIO(file_content)
    
    try:
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            # Ищем JSON файл в архиве
            json_files = [f for f in zip_file.namelist() if f.endswith('.json')]
            if not json_files:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="В архиве не найден JSON файл"
                )
            
            # Читаем первый JSON файл
            json_data = zip_file.read(json_files[0])
            import_data = json.loads(json_data.decode('utf-8'))
            
            # Создаем новое пространство
            space_data = import_data.get("space", {})
            new_space = Space(
                user_id=current_user.id,
                name=f"{space_data.get('name', 'Импортированное пространство')} (импорт)",
                description=space_data.get("description"),
                is_archived=False
            )
            db.add(new_space)
            db.flush()  # Получаем ID нового пространства
            
            # Импортируем теги (сначала теги, чтобы потом связать с заметками)
            tag_id_mapping = {}  # Старый ID -> Новый ID
            for tag_data in import_data.get("tags", []):
                new_tag = Tag(
                    space_id=new_space.id,
                    name=tag_data.get("name"),
                    color=tag_data.get("color"),
                    tag_type=tag_data.get("tag_type")
                )
                db.add(new_tag)
                db.flush()
                tag_id_mapping[tag_data.get("id")] = new_tag.id
            
            # Импортируем чаты и сообщения
            chat_id_mapping = {}  # Старый ID -> Новый ID
            for chat_data in import_data.get("chats", []):
                new_chat = Chat(
                    space_id=new_space.id,
                    user_id=current_user.id,
                    title=chat_data.get("title")
                )
                db.add(new_chat)
                db.flush()
                chat_id_mapping[chat_data.get("id")] = new_chat.id
            
            # Импортируем сообщения
            for msg_data in import_data.get("messages", []):
                old_chat_id = msg_data.get("chat_id")
                new_chat_id = chat_id_mapping.get(old_chat_id)
                if new_chat_id:
                    new_msg = Message(
                        chat_id=new_chat_id,
                        role=msg_data.get("role"),
                        content=msg_data.get("content")
                    )
                    db.add(new_msg)
            
            # Импортируем заметки
            for note_data in import_data.get("notes", []):
                new_note = Note(
                    space_id=new_space.id,
                    user_id=current_user.id,
                    title=note_data.get("title"),
                    content=note_data.get("content")
                )
                db.add(new_note)
                db.flush()
                
                # Связываем теги с заметкой
                for old_tag_data in note_data.get("tags", []):
                    old_tag_id = old_tag_data.get("id")
                    new_tag_id = tag_id_mapping.get(old_tag_id)
                    if new_tag_id:
                        # Добавляем связь через промежуточную таблицу
                        from backend.app.models.note_tag import note_tags
                        db.execute(
                            note_tags.insert().values(
                                note_id=new_note.id,
                                tag_id=new_tag_id
                            )
                        )
            
            db.commit()
            db.refresh(new_space)
            
            return {
                "message": "Пространство успешно импортировано",
                "space_id": new_space.id,
                "space_name": new_space.name
            }
            
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный ZIP архив"
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный JSON файл в архиве"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при импорте: {str(e)}"
        )

