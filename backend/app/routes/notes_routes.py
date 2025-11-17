from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.models.space import Space
from backend.app.models.note import Note
from backend.app.routes.chat_routes import get_or_create_default_space
from backend.app.services.notification_service import create_note_notification

router = APIRouter()


class NoteCreateRequest(BaseModel):
    title: str
    content: Optional[str] = None
    space_id: Optional[int] = None


class NoteUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    space_id: Optional[int] = None


class NoteResponse(BaseModel):
    id: int
    space_id: int
    space_name: str
    user_id: int
    title: str
    content: Optional[str]
    created_at: str
    updated_at: str
    tags: List[dict] = []

    class Config:
        from_attributes = True


class NoteListItem(BaseModel):
    id: int
    space_id: int
    space_name: str
    title: str
    content_preview: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    notes: List[NoteListItem]
    total: int


@router.post("/create", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: NoteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание новой заметки"""
    # Валидация title
    if not note_data.title or not note_data.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название заметки не может быть пустым"
        )

    # Определяем пространство
    if note_data.space_id:
        space = db.query(Space).filter(
            Space.id == note_data.space_id,
            Space.user_id == current_user.id,
            Space.is_archived == False
        ).first()
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пространство не найдено или недоступно"
            )
    else:
        # Используем дефолтное пространство
        space = get_or_create_default_space(current_user, db)

    # Создаем заметку
    new_note = Note(
        space_id=space.id,
        user_id=current_user.id,
        title=note_data.title.strip(),
        content=note_data.content.strip() if note_data.content else None
    )

    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    # Создаем уведомление о новой заметке
    # ВАЖНО: В реальном приложении уведомления должны приходить когда:
    # - Кто-то другой создает заметку в общем пространстве
    # - Система автоматически создает что-то
    # - Происходит важное событие
    # Здесь создаем для тестирования системы уведомлений
    notification = create_note_notification(
        db=db,
        user_id=current_user.id,
        space_id=space.id,
        note_title=new_note.title
    )
    if notification:
        print(f"✅ Уведомление создано: {notification.id}")
    else:
        print(f"⚠️ Уведомление не создано (возможно, отключено в настройках)")

    # Загружаем связанные данные
    db.refresh(new_note)
    space = db.query(Space).filter(Space.id == new_note.space_id).first()

    return NoteResponse(
        id=new_note.id,
        space_id=new_note.space_id,
        space_name=space.name if space else "",
        user_id=new_note.user_id,
        title=new_note.title,
        content=new_note.content,
        created_at=new_note.created_at.isoformat(),
        updated_at=new_note.updated_at.isoformat(),
        tags=[{"id": tag.id, "name": tag.name, "color": tag.color} for tag in new_note.tags]
    )


@router.get("/list", response_model=NoteListResponse)
async def list_notes(
    space_id: Optional[int] = Query(None, description="Фильтр по пространству"),
    limit: int = Query(50, ge=1, le=100, description="Количество заметок на странице"),
    offset: int = Query(0, ge=0, description="Смещение для пагинации"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех заметок пользователя"""
    # Базовый запрос - только заметки пользователя
    query = db.query(Note).filter(Note.user_id == current_user.id)

    # Фильтр по пространству
    if space_id:
        # Проверяем, что пространство принадлежит пользователю
        space = db.query(Space).filter(
            Space.id == space_id,
            Space.user_id == current_user.id,
            Space.is_archived == False
        ).first()
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пространство не найдено или недоступно"
            )
        query = query.filter(Note.space_id == space_id)

    # Получаем общее количество
    total = query.count()

    # Получаем заметки с пагинацией, сортировка по дате обновления (новые сначала)
    notes = query.order_by(desc(Note.updated_at)).offset(offset).limit(limit).all()

    # Формируем ответ
    note_items = []
    for note in notes:
        # Получаем название пространства
        space = db.query(Space).filter(Space.id == note.space_id).first()
        
        # Обрезаем контент для превью (первые 200 символов)
        content_preview = None
        if note.content:
            content_preview = note.content[:200] + "..." if len(note.content) > 200 else note.content

        note_items.append(NoteListItem(
            id=note.id,
            space_id=note.space_id,
            space_name=space.name if space else "",
            title=note.title,
            content_preview=content_preview,
            created_at=note.created_at.isoformat(),
            updated_at=note.updated_at.isoformat()
        ))

    return NoteListResponse(notes=note_items, total=total)


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить заметку по ID"""
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == current_user.id
    ).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заметка не найдена"
        )

    # Получаем связанные данные
    space = db.query(Space).filter(Space.id == note.space_id).first()

    return NoteResponse(
        id=note.id,
        space_id=note.space_id,
        space_name=space.name if space else "",
        user_id=note.user_id,
        title=note.title,
        content=note.content,
        created_at=note.created_at.isoformat(),
        updated_at=note.updated_at.isoformat(),
        tags=[{"id": tag.id, "name": tag.name, "color": tag.color} for tag in note.tags]
    )


@router.put("/update/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление заметки"""
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == current_user.id
    ).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заметка не найдена"
        )

    # Обновляем поля
    if note_data.title is not None:
        if not note_data.title.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название заметки не может быть пустым"
            )
        note.title = note_data.title.strip()

    if note_data.content is not None:
        note.content = note_data.content.strip() if note_data.content else None

    # Если указано новое пространство, проверяем доступ
    if note_data.space_id is not None and note_data.space_id != note.space_id:
        space = db.query(Space).filter(
            Space.id == note_data.space_id,
            Space.user_id == current_user.id,
            Space.is_archived == False
        ).first()
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пространство не найдено или недоступно"
            )
        note.space_id = note_data.space_id

    db.commit()
    db.refresh(note)

    # Получаем связанные данные
    space = db.query(Space).filter(Space.id == note.space_id).first()

    return NoteResponse(
        id=note.id,
        space_id=note.space_id,
        space_name=space.name if space else "",
        user_id=note.user_id,
        title=note.title,
        content=note.content,
        created_at=note.created_at.isoformat(),
        updated_at=note.updated_at.isoformat(),
        tags=[{"id": tag.id, "name": tag.name, "color": tag.color} for tag in note.tags]
    )


@router.delete("/delete/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление заметки"""
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == current_user.id
    ).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заметка не найдена"
        )

    db.delete(note)
    db.commit()

    return None

