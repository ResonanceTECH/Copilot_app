from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional, List
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.dependencies import get_current_user, get_optional_user
from backend.app.models.user import User
from backend.app.models.feedback import Feedback
from backend.app.models.support_article import SupportArticle

router = APIRouter()


class FeedbackRequest(BaseModel):
    subject: str
    message: str
    feedback_type: Optional[str] = None  # 'bug', 'feature', 'question', 'other'
    email: Optional[EmailStr] = None  # Для неавторизованных пользователей
    name: Optional[str] = None  # Для неавторизованных пользователей


class FeedbackResponse(BaseModel):
    id: int
    message: str
    created_at: str

    class Config:
        from_attributes = True


class SupportArticleResponse(BaseModel):
    id: int
    title: str
    content: str
    category: Optional[str]
    order: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class SupportArticlesListResponse(BaseModel):
    articles: List[SupportArticleResponse]
    total: int


@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    feedback_data: FeedbackRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Отправить отзыв или запрос в поддержку"""
    # Валидация
    if not feedback_data.subject or not feedback_data.subject.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тема сообщения не может быть пустой"
        )

    if not feedback_data.message or not feedback_data.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сообщение не может быть пустым"
        )

    # Если пользователь не авторизован, требуем email и name
    if not current_user:
        if not feedback_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email обязателен для неавторизованных пользователей"
            )
        if not feedback_data.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Имя обязательно для неавторизованных пользователей"
            )

    # Валидация feedback_type
    valid_types = ['bug', 'feature', 'question', 'other', None]
    if feedback_data.feedback_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Тип обратной связи должен быть одним из: {', '.join([t for t in valid_types if t])}"
        )

    # Создаем запись обратной связи
    new_feedback = Feedback(
        user_id=current_user.id if current_user else None,
        email=feedback_data.email if not current_user else None,
        name=feedback_data.name if not current_user else None,
        subject=feedback_data.subject.strip(),
        message=feedback_data.message.strip(),
        feedback_type=feedback_data.feedback_type,
        status='new'
    )

    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)

    # Здесь можно добавить отправку email администратору
    # Например: send_email_to_admin(new_feedback)

    return FeedbackResponse(
        id=new_feedback.id,
        message="Спасибо за ваш отзыв! Мы свяжемся с вами в ближайшее время.",
        created_at=new_feedback.created_at.isoformat()
    )


@router.get("/articles", response_model=SupportArticlesListResponse)
async def get_support_articles(
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить список справочных статей"""
    # Базовый запрос - только опубликованные статьи
    query = db.query(SupportArticle).filter(SupportArticle.is_published == True)

    # Фильтр по категории
    if category:
        query = query.filter(SupportArticle.category == category)

    # Получаем общее количество
    total = query.count()

    # Получаем статьи с пагинацией, сортировка по order и created_at
    articles = query.order_by(
        SupportArticle.order.asc(),
        desc(SupportArticle.created_at)
    ).offset(offset).limit(limit).all()

    article_items = [
        SupportArticleResponse(
            id=article.id,
            title=article.title,
            content=article.content,
            category=article.category,
            order=article.order,
            created_at=article.created_at.isoformat(),
            updated_at=article.updated_at.isoformat()
        )
        for article in articles
    ]

    return SupportArticlesListResponse(articles=article_items, total=total)


@router.get("/articles/{article_id}", response_model=SupportArticleResponse)
async def get_support_article(
    article_id: int,
    db: Session = Depends(get_db)
):
    """Получить справочную статью по ID"""
    article = db.query(SupportArticle).filter(
        SupportArticle.id == article_id,
        SupportArticle.is_published == True
    ).first()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Статья не найдена"
        )

    return SupportArticleResponse(
        id=article.id,
        title=article.title,
        content=article.content,
        category=article.category,
        order=article.order,
        created_at=article.created_at.isoformat(),
        updated_at=article.updated_at.isoformat()
    )

