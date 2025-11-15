from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
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


class QuestionRequest(BaseModel):
    question: str


class QuestionResponse(BaseModel):
    success: bool
    response: dict = None
    error: str = None


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
    return {"message": "ML Business Assistant API"}


@router.post("/ask", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    try:
        user_question = request.question.strip()

        if not user_question:
            raise HTTPException(status_code=400, detail="Вопрос не может быть пустым")

        # Проверяем быстрые ответы
        quick_response = llm_service.get_quick_response(user_question)
        if quick_response:
            return QuestionResponse(
                success=True,
                response={
                    'raw_text': quick_response,
                    'formatted_html': f'<p class="response-text">{quick_response}</p>',
                    'timestamp': datetime.now().isoformat(),
                    'category': 'quick_response'
                }
            )

        # Проверяем кэш
        cached_response = cache_service.get(user_question)
        if cached_response:
            print(f"✅ Используем кэшированный ответ для: {user_question[:50]}...")
            return QuestionResponse(success=True, response=cached_response)

        print(f"📨 Отправляем запрос в LLM: {user_question}")

        # Получаем усиленный промпт
        enhanced_prompt, category, probabilities = get_enhanced_system_prompt(user_question)

        # Генерируем ответ
        ai_response = llm_service.generate_response(enhanced_prompt, user_question)

        # Форматируем ответ
        formatted_response = formatting_service.format_response(ai_response)

        # Подготавливаем данные для ответа
        response_data = {
            'raw_text': ai_response,
            'formatted_html': formatted_response,
            'timestamp': datetime.now().isoformat(),
            'category': category,
            'probabilities': probabilities
        }

        # Сохраняем в кэш
        cache_service.set(user_question, response_data)

        return QuestionResponse(success=True, response=response_data)

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return QuestionResponse(
            success=False,
            error="Временная ошибка сервера. Пожалуйста, попробуйте ещё раз."
        )


@router.get("/health")
async def health_check():
    """Проверка здоровья сервисов"""
    services_status = {
        "classifier": classifier_service.is_ready(),
        "llm": True,
        "cache": True,
        "formatting": True
    }

    return {
        "status": "healthy" if all(services_status.values()) else "degraded",
        "services": services_status
    }