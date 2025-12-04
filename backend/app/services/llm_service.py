from openai import OpenAI
import os
from dotenv import load_dotenv
from typing import List, Dict, Optional
import tiktoken
import httpx
import io

load_dotenv()


class LLMService:
    def __init__(self):
        # Увеличиваем таймауты для медленных соединений
        timeout = httpx.Timeout(60.0, connect=30.0)  # 60 сек на запрос, 30 сек на подключение
        http_client = httpx.Client(timeout=timeout)
        
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            http_client=http_client
        )
        
        # Настройка Whisper: локальный или API
        # По умолчанию используем локальный Whisper, если установлен USE_WHISPER_API=true - используем API
        use_whisper_api = os.getenv("USE_WHISPER_API", "false").lower() == "true"
        
        self.local_whisper = None
        self.whisper_client = None
        
        if use_whisper_api:
            # Использование Whisper API через OpenAI
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if openai_api_key:
                whisper_timeout = httpx.Timeout(120.0, connect=30.0)  # 120 сек для транскрибации
                whisper_http_client = httpx.Client(timeout=whisper_timeout)
                self.whisper_client = OpenAI(
                    api_key=openai_api_key,
                    http_client=whisper_http_client
                )
                print("✅ Используется Whisper API (OpenAI)")
            else:
                print("⚠️ USE_WHISPER_API=true, но OPENAI_API_KEY не установлен. Переключаюсь на локальный Whisper.")
                use_whisper_api = False
        
        if not use_whisper_api:
            # Использование локального Whisper
            try:
                from backend.ml.services.whisper_service import LocalWhisperService
                
                # Параметры из переменных окружения
                model_size = os.getenv("WHISPER_MODEL_SIZE", "base")  # tiny, base, small, medium, large-v2, large-v3
                device = os.getenv("WHISPER_DEVICE", "cpu")  # cpu или cuda
                compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")  # int8, int8_float16, float16, float32
                download_root = os.getenv("WHISPER_DOWNLOAD_ROOT")  # Путь для сохранения моделей
                
                self.local_whisper = LocalWhisperService(
                    model_size=model_size,
                    device=device,
                    compute_type=compute_type,
                    download_root=download_root
                )
                print(f"✅ Используется локальный Whisper (модель: {model_size}, устройство: {device})")
                # Модель загружается при создании LocalWhisperService
            except ImportError as e:
                print(f"⚠️ faster-whisper не установлен: {e}")
                print("⚠️ Попытка использовать Whisper API...")
                self.local_whisper = None
                # Fallback на API если локальный не доступен
                openai_api_key = os.getenv("OPENAI_API_KEY")
                if openai_api_key:
                    whisper_timeout = httpx.Timeout(120.0, connect=30.0)
                    whisper_http_client = httpx.Client(timeout=whisper_timeout)
                    self.whisper_client = OpenAI(
                        api_key=openai_api_key,
                        http_client=whisper_http_client
                    )
                    print("✅ Используется Whisper API (fallback)")
                else:
                    print("❌ Whisper недоступен: нет локальной модели и нет OPENAI_API_KEY")
            except Exception as e:
                print(f"⚠️ Ошибка инициализации локального Whisper: {e}")
                import traceback
                traceback.print_exc()
                self.local_whisper = None
                # Fallback на API если локальный не доступен
                openai_api_key = os.getenv("OPENAI_API_KEY")
                if openai_api_key:
                    whisper_timeout = httpx.Timeout(120.0, connect=30.0)
                    whisper_http_client = httpx.Client(timeout=whisper_timeout)
                    self.whisper_client = OpenAI(
                        api_key=openai_api_key,
                        http_client=whisper_http_client
                    )
                    print("✅ Используется Whisper API (fallback)")
                else:
                    print("❌ Whisper недоступен: ошибка локальной модели и нет OPENAI_API_KEY")
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

    def transcribe_audio(self, audio_bytes: bytes, filename: str = "audio.webm", language: str = "ru") -> str:
        """
        Транскрибация аудио в текст через локальный Whisper или API
        
        Args:
            audio_bytes: Байты аудио файла
            filename: Имя файла (нужно для определения формата)
            language: Язык аудио (ru, en, etc.)
            
        Returns:
            Распознанный текст
        """
        # Используем локальный Whisper если доступен
        if self.local_whisper:
            try:
                # Модель загрузится автоматически при первом использовании
                # Добавляем таймаут для транскрибации (максимум 60 секунд)
                import threading
                
                result = [None]
                error = [None]
                
                def transcribe_with_timeout():
                    try:
                        result[0] = self.local_whisper.transcribe(audio_bytes, language=language)
                    except Exception as e:
                        error[0] = e
                
                thread = threading.Thread(target=transcribe_with_timeout, daemon=True)
                thread.start()
                thread.join(timeout=60)  # Таймаут 60 секунд
                
                if thread.is_alive():
                    print("⏱️ Транскрибация превысила таймаут (60 сек), переключаемся на API...")
                    raise TimeoutError("Транскрибация превысила таймаут")
                
                if error[0]:
                    raise error[0]
                
                if result[0] is None:
                    raise ValueError("Транскрибация не вернула результат")
                
                return result[0]
                
            except (TimeoutError, ValueError, Exception) as e:
                print(f"❌ Ошибка локальной транскрибации: {e}")
                import traceback
                traceback.print_exc()
                # Fallback на API если локальный не сработал
                if self.whisper_client:
                    print("🔄 Переключение на Whisper API...")
                    try:
                        audio_file = io.BytesIO(audio_bytes)
                        audio_file.name = filename
                        transcript = self.whisper_client.audio.transcriptions.create(
                            model="whisper-1",
                            file=audio_file,
                            language=language
                        )
                        print("✅ Транскрибация через Whisper API успешна")
                        return transcript.text
                    except Exception as api_error:
                        print(f"❌ Ошибка Whisper API: {api_error}")
                        raise ValueError(f"Ошибка распознавания речи: {str(e)}. API также не сработал: {str(api_error)}")
                else:
                    raise ValueError(f"Ошибка распознавания речи: {str(e)}")
        
        # Используем Whisper API если локальный недоступен
        if self.whisper_client:
            # Создаем файловый объект из байтов
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = filename
            
            try:
                # Отправляем в Whisper API
                transcript = self.whisper_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language=language
                )
                
                return transcript.text
            except Exception as e:
                print(f"❌ Ошибка транскрибации Whisper API: {e}")
                raise ValueError(f"Ошибка распознавания речи: {str(e)}")
        else:
            raise ValueError(
                "Whisper недоступен. "
                "Установите faster-whisper (pip install faster-whisper) "
                "или установите OPENAI_API_KEY для использования API"
            )

    def analyze_image(self, image_base64: str, prompt: str, mime_type: str = "image/jpeg") -> str:
        """
        Анализирует изображение через LLM с поддержкой vision
        
        Args:
            image_base64: Изображение в формате base64 (без префикса data:)
            prompt: Промпт для анализа изображения
            mime_type: MIME тип изображения (image/jpeg, image/png и т.д.)
            
        Returns:
            Результат анализа изображения
        """
        try:
            # Формируем data URL для изображения
            image_data_url = f"data:{mime_type};base64,{image_base64}"
            
            system_prompt = "Ты — эксперт по анализу изображений. Описывай содержимое изображений подробно и точно. Если на изображении есть текст, извлеки его полностью. Если это график или диаграмма, опиши данные."
            
            # Используем формат для vision API: content как массив объектов
            messages = [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_url
                            }
                        }
                    ]
                }
            ]
            
            # Пробуем использовать vision-модель через OpenRouter
            # Многие модели на OpenRouter поддерживают vision, например:
            # - openai/gpt-4-vision-preview
            # - google/gemini-pro-vision
            # - anthropic/claude-3-opus
            # - qwen/qwen-vl-plus
            
            # Сначала пробуем через OpenRouter с vision-моделью
            try:
                completion = self.client.chat.completions.create(
                    extra_headers={
                        "HTTP-Referer": "http://localhost:5000",
                        "X-Title": "Business Assistant",
                    },
                    # Используем модель с поддержкой vision
                    # Если модель не поддерживает vision, попробуем OpenAI API
                    model="openai/gpt-4o-mini",  # GPT-4o-mini поддерживает vision
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1000
                )
                
                if completion.choices and len(completion.choices) > 0:
                    result = completion.choices[0].message.content
                    if result:
                        print(f"✅ Изображение проанализировано через OpenRouter")
                        return result
            except Exception as e:
                print(f"⚠️ Ошибка анализа через OpenRouter vision: {e}")
                # Fallback на OpenAI API если доступен
                pass
            
            # Fallback: используем OpenAI API напрямую, если доступен
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if openai_api_key:
                try:
                    openai_timeout = httpx.Timeout(60.0, connect=30.0)
                    openai_http_client = httpx.Client(timeout=openai_timeout)
                    openai_client = OpenAI(
                        api_key=openai_api_key,
                        http_client=openai_http_client
                    )
                    
                    completion = openai_client.chat.completions.create(
                        model="gpt-4o-mini",  # GPT-4o-mini поддерживает vision
                        messages=messages,
                        temperature=0.7,
                        max_tokens=1000
                    )
                    
                    if completion.choices and len(completion.choices) > 0:
                        result = completion.choices[0].message.content
                        if result:
                            print(f"✅ Изображение проанализировано через OpenAI API")
                            return result
                except Exception as e:
                    print(f"⚠️ Ошибка анализа через OpenAI API: {e}")
            
            # Если ничего не сработало, возвращаем сообщение об ошибке
            return "Не удалось проанализировать изображение. Убедитесь, что настроен OPENAI_API_KEY или используется модель с поддержкой vision."
            
        except Exception as e:
            print(f"❌ Ошибка анализа изображения: {e}")
            import traceback
            traceback.print_exc()
            return f"Ошибка анализа изображения: {str(e)}"