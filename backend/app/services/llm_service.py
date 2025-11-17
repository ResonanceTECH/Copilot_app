from openai import OpenAI
import os
from dotenv import load_dotenv
from typing import List, Dict, Optional
import tiktoken

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
        # Инициализация токенизатора для подсчета токенов
        try:
            self.encoding = tiktoken.get_encoding("cl100k_base")
        except:
            self.encoding = None

    def get_quick_response(self, question: str) -> Optional[str]:
        """Проверка быстрых ответов"""
        return self.quick_responses.get(question.lower().strip())

    def count_tokens(self, text: str) -> int:
        """Подсчет токенов в тексте"""
        if not self.encoding:
            return len(text.split())  # fallback
        return len(self.encoding.encode(text))

    def prepare_conversation_messages(
            self,
            system_prompt: str,
            user_question: str,
            conversation_history: List[Dict] = None,
            max_tokens: int = 3000
    ) -> List[Dict]:
        """
        Подготовка сообщений для LLM с учетом истории и ограничения по токенам
        """
        messages = [{"role": "system", "content": system_prompt}]
        current_tokens = self.count_tokens(system_prompt)

        # Добавляем историю сообщений (если есть)
        if conversation_history:
            # Идем от самых старых к новым, но ограничиваем по токенам
            history_messages = []
            history_tokens = 0

            for msg in reversed(conversation_history):  # начинаем с самых новых
                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                    # Если это SQLAlchemy объект
                    role = msg.role
                    content = msg.content
                elif isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    # Если это словарь
                    role = msg['role']
                    content = msg['content']
                else:
                    continue

                message_tokens = self.count_tokens(content)

                # Проверяем, не превысим ли лимит
                if current_tokens + history_tokens + message_tokens > max_tokens:
                    break

                history_messages.insert(0, {"role": role, "content": content})
                history_tokens += message_tokens

            # Добавляем подготовленную историю
            messages.extend(history_messages)
            current_tokens += history_tokens

        # Добавляем текущий вопрос пользователя
        user_tokens = self.count_tokens(user_question)
        messages.append({"role": "user", "content": user_question})
        current_tokens += user_tokens

        print(
            f"📊 Токены: система={self.count_tokens(system_prompt)}, история={current_tokens - self.count_tokens(system_prompt) - user_tokens}, вопрос={user_tokens}, всего={current_tokens}")

        return messages

    def generate_response(
            self,
            system_prompt: str,
            user_question: str,
            conversation_history: List[Dict] = None,
            max_history_tokens: int = 3000
    ) -> str:
        """
        Генерация ответа через LLM с учетом истории сообщений

        Args:
            system_prompt: Системный промпт
            user_question: Вопрос пользователя
            conversation_history: История сообщений (из БД)
            max_history_tokens: Максимальное количество токенов для истории

        Returns:
            Ответ от LLM или None в случае ошибки
        """
        try:
            # Подготавливаем сообщения с учетом ограничений по токенам
            messages = self.prepare_conversation_messages(
                system_prompt,
                user_question,
                conversation_history,
                max_history_tokens
            )

            completion = self.client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "http://localhost:5000",
                    "X-Title": "Business Assistant",
                },
                model="tngtech/deepseek-r1t2-chimera:free",
                messages=messages,
                temperature=0.5,
                max_tokens=1000  # Ограничение на ответ
            )

            if not completion.choices or len(completion.choices) == 0:
                raise ValueError("LLM вернул пустой ответ")

            response = completion.choices[0].message.content
            
            if not response:
                raise ValueError("LLM вернул пустое содержимое")

            return response

        except ValueError as e:
            raise
        except Exception as e:
            error_message = str(e)
            
            # Обработка ошибки 401 - неверный API ключ
            if "401" in error_message or "User not found" in error_message or "authentication" in error_message.lower():
                raise ValueError("Неверный API ключ OpenRouter. Проверьте переменную OPENROUTER_API_KEY.")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower() or "429" in error_message:
                raise ValueError("Превышен лимит запросов. Попробуйте позже.")
            elif "timeout" in error_message.lower():
                raise ValueError("Превышено время ожидания. Попробуйте ещё раз.")
            else:
                raise ValueError(f"Ошибка LLM: {error_message}")

    def generate_response_with_context(
            self,
            system_prompt: str,
            context_messages: List[Dict],
            user_question: str
    ) -> str:
        """
        Устаревший метод для обратной совместимости
        """
        return self.generate_response(system_prompt, user_question, context_messages)

    def summarize_conversation(self, conversation_history: List[Dict]) -> str:
        """
        Суммаризация длинной беседы для сохранения контекста

        Args:
            conversation_history: Полная история беседы

        Returns:
            Краткое содержание беседы
        """
        if not conversation_history or len(conversation_history) < 5:
            return ""

        try:
            summary_prompt = """
            Суммаризуй следующую беседу в 2-3 предложениях, выделив основные темы и решения.
            Сохрани контекст для будущих вопросов.

            Беседа:
            """

            # Берем только часть истории для суммаризации
            recent_history = conversation_history[-10:]  # последние 10 сообщений

            conversation_text = ""
            for msg in recent_history:
                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                    role = "Пользователь" if msg.role == "user" else "Ассистент"
                    conversation_text += f"{role}: {msg.content}\n"
                elif isinstance(msg, dict):
                    role = "Пользователь" if msg.get('role') == "user" else "Ассистент"
                    conversation_text += f"{role}: {msg.get('content', '')}\n"

            summary_prompt += conversation_text

            completion = self.client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "http://localhost:5000",
                    "X-Title": "Business Assistant",
                },
                model="tngtech/deepseek-r1t2-chimera:free",
                messages=[
                    {"role": "system", "content": "Ты помогаешь суммаризировать беседы."},
                    {"role": "user", "content": summary_prompt}
                ],
                temperature=0.3,
                max_tokens=300
            )

            return completion.choices[0].message.content

        except Exception as e:
            print(f"❌ Ошибка суммаризации: {e}")
            return ""

    def get_conversation_stats(self, conversation_history: List[Dict]) -> Dict:
        """
        Получение статистики по беседе

        Args:
            conversation_history: История сообщений

        Returns:
            Словарь со статистикой
        """
        total_messages = len(conversation_history)
        user_messages = 0
        assistant_messages = 0
        total_tokens = 0

        for msg in conversation_history:
            if hasattr(msg, 'role') and hasattr(msg, 'content'):
                role = msg.role
                content = msg.content
            elif isinstance(msg, dict):
                role = msg.get('role', '')
                content = msg.get('content', '')
            else:
                continue

            if role == 'user':
                user_messages += 1
            elif role == 'assistant':
                assistant_messages += 1

            total_tokens += self.count_tokens(content)

        return {
            'total_messages': total_messages,
            'user_messages': user_messages,
            'assistant_messages': assistant_messages,
            'estimated_tokens': total_tokens,
            'conversation_ratio': user_messages / total_messages if total_messages > 0 else 0
        }