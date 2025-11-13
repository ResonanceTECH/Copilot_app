from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()


class LLMService:
    def __init__(self):
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )
        self.quick_responses = {
            'привет': 'Здравствуйте! Я ваш бизнес-помощник. Задавайте вопросы по маркетингу, финансам, юриспруденции или управлению бизнесом.',
            'спасибо': 'Пожалуйста! Обращайтесь, если понадобится ещё помощь.',
            'помощь': 'Я консультирую по вопросам бизнеса: маркетинг, финансы, юридические аспекты, управление. Задайте конкретный вопрос!',
        }

    def get_quick_response(self, question: str):
        """Проверка быстрых ответов"""
        return self.quick_responses.get(question.lower().strip())

    def generate_response(self, system_prompt: str, user_question: str):
        """Генерация ответа через LLM"""
        try:
            completion = self.client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "http://localhost:5000",
                    "X-Title": "Business Assistant",
                },
                model="tngtech/deepseek-r1t2-chimera:free",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_question}
                ],
                temperature=0.5,
            )

            return completion.choices[0].message.content
        except Exception as e:
            print(f"❌ Ошибка LLM: {e}")
            return "Извините, произошла ошибка при генерации ответа."