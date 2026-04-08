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
        # Получаем URL приложения из переменных окружения
        self.app_url = os.getenv("APP_URL", "http://localhost")
        # Увеличиваем таймауты для медленных соединений
        # Thinking режим отключен, поэтому таймауты можно уменьшить
        request_timeout = float(os.getenv("LLM_REQUEST_TIMEOUT", "120.0"))  # 2 минуты по умолчанию (thinking отключен)
        connect_timeout = float(os.getenv("LLM_CONNECT_TIMEOUT", "30.0"))  # 30 секунд на подключение
        timeout = httpx.Timeout(request_timeout, connect=connect_timeout)
        http_client = httpx.Client(timeout=timeout)
        self.http_client = http_client
        
        # Проверяем, использовать ли Ollama
        use_ollama = os.getenv("USE_OLLAMA", "true").lower() == "true"
        ollama_api_url = os.getenv("OLLAMA_API_URL", "http://ollama:11434")
        ollama_model = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")
        
        if use_ollama:
            # Использование Ollama (OpenAI-совместимый API)
            # Ollama предоставляет OpenAI-совместимый API на /v1/chat/completions
            ollama_base_url = f"{ollama_api_url}/v1" if not ollama_api_url.endswith("/v1") else ollama_api_url
            self.client = OpenAI(
                base_url=ollama_base_url,
                api_key="ollama",  # Ollama требует любой API ключ, но не проверяет его
                http_client=http_client
            )
            self.ollama_model = ollama_model
            print(f"✅ Используется Ollama (URL: {ollama_base_url}, модель: {ollama_model})")
        else:
            # Использование OpenRouter API
            self.client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=os.getenv("OPENROUTER_API_KEY"),
                http_client=http_client
            )
            self.ollama_model = None
            print("✅ Используется OpenRouter API")

        # OpenRouter endpoints (used for eligibility fallback on guardrails/data policy errors)
        self.openrouter_base_url = "https://openrouter.ai/api/v1"
        self.openrouter_models_url = f"{self.openrouter_base_url}/models/user"
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        
        # Настройка Whisper: контейнер, API или локальный
        # Приоритет: контейнер > API > локальный
        use_whisper_container = os.getenv("USE_WHISPER_CONTAINER", "false").lower() == "true"
        use_whisper_api = os.getenv("USE_WHISPER_API", "false").lower() == "true"
        
        self.local_whisper = None
        self.whisper_client = None
        
        if use_whisper_container:
            # Использование Whisper контейнера
            whisper_api_url = os.getenv("WHISPER_API_URL", "http://whisper:9000")
            whisper_timeout = httpx.Timeout(120.0, connect=30.0)  # 120 сек для транскрибации
            whisper_http_client = httpx.Client(timeout=whisper_timeout)
            self.whisper_client = OpenAI(
                base_url=whisper_api_url,
                api_key="not-needed",  # Локальный контейнер не требует API ключ
                http_client=whisper_http_client
            )
            print(f"✅ Используется Whisper контейнер (URL: {whisper_api_url})")
        elif use_whisper_api:
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
        
        if not use_whisper_container and not use_whisper_api:
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

    def _is_openrouter_guardrail_data_policy_404(self, exc: Exception) -> bool:
        """
        OpenRouter при слишком строгих guardrails/privacy возвращает:
        404 + "No endpoints available matching your guardrail restrictions and data policy"
        """
        s = str(exc).lower()
        return (
            "guardrail restrictions" in s
            and "data policy" in s
            and ("404" in s or "not found" in s or "no eligible endpoints" in s)
        )

    def _get_openrouter_eligible_models(self) -> List[Dict]:
        """
        Возвращает список моделей, которые реально доступны под текущие guardrails/privacy
        для вашего ключа.
        """
        if not self.openrouter_api_key:
            return []

        try:
            resp = self.http_client.get(
                self.openrouter_models_url,
                headers={"Authorization": f"Bearer {self.openrouter_api_key}"},
            )
            resp.raise_for_status()
            payload = resp.json()
            return payload.get("data") or []
        except Exception as e:
            print(f"⚠️ Не удалось получить eligible models OpenRouter: {e}")
            return []

    def _pick_openrouter_model(
        self,
        preferred_model: str,
        input_modality: Optional[str] = None,  # "text" | "image" | "file" | "audio" | ...
    ) -> str:
        """
        Выбирает модель из eligible моделей, учитывая input_modality.
        Если подходящей модели нет — вернёт preferred_model.
        """
        eligible_models = self._get_openrouter_eligible_models()
        if not eligible_models:
            return preferred_model

        # 1) Сначала пытаемся использовать preferred_model, если он есть среди eligible
        for m in eligible_models:
            if m.get("id") == preferred_model or m.get("canonical_slug") == preferred_model:
                return m.get("id") or preferred_model

        # 2) Если указали modality — выбираем первую подходящую
        if input_modality:
            for m in eligible_models:
                arch = m.get("architecture") or {}
                input_modalities = arch.get("input_modalities") or []
                if input_modality in input_modalities:
                    return m.get("id") or preferred_model

        # 3) Иначе — первая eligible
        first = eligible_models[0].get("id") or preferred_model
        return first

    def get_quick_response(self, question: str) -> Optional[str]:
        """Проверка быстрых ответов"""
        return self.quick_responses.get(question.lower().strip())

    def count_tokens(self, text: str) -> int:
        """Подсчет токенов в тексте"""
        if not self.encoding:
            return len(text.split())  # fallback
        return len(self.encoding.encode(text))

    @staticmethod
    def _collapse_adjacent_same_role(msgs: List[Dict]) -> List[Dict]:
        """Reka / строгие API: не должно быть двух user или двух assistant подряд."""
        if not msgs:
            return []
        out: List[Dict] = []
        for m in msgs:
            role = m.get("role")
            content = m.get("content") or ""
            if not out:
                out.append({"role": role, "content": content})
                continue
            if role == out[-1].get("role"):
                prev = out[-1].get("content") or ""
                sep = "\n\n" if prev.strip() and str(content).strip() else ""
                out[-1]["content"] = prev + sep + content
            else:
                out.append({"role": role, "content": content})
        return out

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

            # Текущий ход пользователя уже в БД и попал в историю; user_question передаётся отдельно
            # (часто с доп. контекстом файлов) — убираем дублирующий последний user, иначе Reka: 400.
            while history_messages and history_messages[-1].get("role") == "user":
                history_messages.pop()

            # После обрезки по токенам первым в окне может остаться assistant — недопустимо сразу после system
            while history_messages and history_messages[0].get("role") == "assistant":
                history_messages.pop(0)

            # Добавляем подготовленную историю
            messages.extend(history_messages)
            current_tokens += history_tokens

        # Добавляем текущий вопрос пользователя
        user_tokens = self.count_tokens(user_question)
        messages.append({"role": "user", "content": user_question})
        current_tokens += user_tokens

        # Страховка: схлопнуть подряд одинаковые роли (битая история / обрезка)
        if len(messages) > 2:
            messages = [messages[0]] + self._collapse_adjacent_same_role(messages[1:])

        print(
            f"📊 Токены: система={self.count_tokens(system_prompt)}, история={current_tokens - self.count_tokens(system_prompt) - user_tokens}, вопрос={user_tokens}, всего={current_tokens}")

        return messages

    def generate_response(
            self,
            system_prompt: str,
            user_question: str,
            conversation_history: List[Dict] = None,
            max_history_tokens: int = 3000,
            space_context: Optional[str] = None,
    ) -> str:
        """
        Генерация ответа через LLM с учетом истории сообщений

        Args:
            system_prompt: Системный промпт
            user_question: Вопрос пользователя
            conversation_history: История сообщений (из БД)
            max_history_tokens: Максимальное количество токенов для истории
            space_context: Доп. блок (контекст пространства), добавляется к system prompt

        Returns:
            Ответ от LLM или None в случае ошибки
        """
        try:
            full_system = system_prompt
            if space_context and space_context.strip():
                full_system = f"{system_prompt.rstrip()}\n\n{space_context.strip()}"

            # Подготавливаем сообщения с учетом ограничений по токенам
            messages = self.prepare_conversation_messages(
                full_system,
                user_question,
                conversation_history,
                max_history_tokens
            )

            # Определяем модель в зависимости от используемого API
            use_ollama = os.getenv("USE_OLLAMA", "false").lower() == "true"
            
            if use_ollama:
                # Использование Ollama
                model_name = self.ollama_model
                # Отключаем режим thinking для ускорения ответов
                # Пользователь использует точные промпты, поэтому thinking не нужен
                completion = self.client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.5,
                    max_tokens=1000,
                    extra_body={
                        "options": {
                            "thinking": False  # Отключаем режим thinking
                        }
                    }
                )
            else:
                # Использование OpenRouter API
                preferred_model_name = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-120b:free")
                model_name = preferred_model_name
                try:
                    completion = self.client.chat.completions.create(
                        extra_headers={
                            "HTTP-Referer": self.app_url,
                            "X-OpenRouter-Title": "Business Assistant",
                        },
                        model=model_name,
                        messages=messages,
                        temperature=0.5,
                        max_tokens=1000
                    )
                except Exception as e:
                    # Если guardrails/privacy отфильтровали все endpoints под выбранную модель,
                    # пробуем выбрать модель, которая реально eligible для вашего ключа.
                    if self._is_openrouter_guardrail_data_policy_404(e):
                        alt_model_name = self._pick_openrouter_model(
                            preferred_model_name,
                            input_modality="text",
                        )
                        if alt_model_name != model_name:
                            print(f"🔁 OpenRouter model fallback: {model_name} -> {alt_model_name}")
                            completion = self.client.chat.completions.create(
                                extra_headers={
                                    "HTTP-Referer": self.app_url,
                                    "X-OpenRouter-Title": "Business Assistant",
                                },
                                model=alt_model_name,
                                messages=messages,
                                temperature=0.5,
                                max_tokens=1000
                            )
                        else:
                            raise
                    else:
                        raise

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

            # Определяем модель в зависимости от используемого API
            use_ollama = os.getenv("USE_OLLAMA", "false").lower() == "true"
            
            if use_ollama:
                # Использование Ollama
                model_name = self.ollama_model
                # Отключаем режим thinking для ускорения ответов
                completion = self.client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "Ты помогаешь суммаризировать беседы."},
                        {"role": "user", "content": summary_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=300,
                    extra_body={
                        "options": {
                            "thinking": False  # Отключаем режим thinking
                        }
                    }
                )
            else:
                # Использование OpenRouter API
                preferred_model_name = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-120b:free")
                model_name = preferred_model_name
                try:
                    completion = self.client.chat.completions.create(
                        extra_headers={
                            "HTTP-Referer": self.app_url,
                            "X-OpenRouter-Title": "Business Assistant",
                        },
                        model=model_name,
                        messages=[
                            {"role": "system", "content": "Ты помогаешь суммаризировать беседы."},
                            {"role": "user", "content": summary_prompt}
                        ],
                        temperature=0.3,
                        max_tokens=300
                    )
                except Exception as e:
                    if self._is_openrouter_guardrail_data_policy_404(e):
                        alt_model_name = self._pick_openrouter_model(
                            preferred_model_name,
                            input_modality="text",
                        )
                        if alt_model_name != model_name:
                            print(f"🔁 OpenRouter summarization model fallback: {model_name} -> {alt_model_name}")
                            completion = self.client.chat.completions.create(
                                extra_headers={
                                    "HTTP-Referer": self.app_url,
                                    "X-OpenRouter-Title": "Business Assistant",
                                },
                                model=alt_model_name,
                                messages=[
                                    {"role": "system", "content": "Ты помогаешь суммаризировать беседы."},
                                    {"role": "user", "content": summary_prompt}
                                ],
                                temperature=0.3,
                                max_tokens=300
                            )
                        else:
                            raise
                    else:
                        raise

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
                # Модель загрузится автоматически при первом использовании в методе transcribe
                # Выполняем транскрибацию с таймаутом (включая время на загрузку модели)
                import threading
                
                result = [None]
                error = [None]
                
                def transcribe_with_timeout():
                    try:
                        # transcribe сам загрузит модель если нужно
                        result[0] = self.local_whisper.transcribe(audio_bytes, language=language)
                    except Exception as e:
                        error[0] = e
                
                thread = threading.Thread(target=transcribe_with_timeout, daemon=True)
                thread.start()
                # Увеличиваем таймаут до 300 секунд (5 минут) чтобы учесть время загрузки модели
                thread.join(timeout=300)
                
                if thread.is_alive():
                    print("⏱️ Транскрибация превысила таймаут (300 сек), переключаемся на API...")
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
                "Установите faster-whisper (pip install faster-whisper), "
                "используйте Whisper контейнер (USE_WHISPER_CONTAINER=true), "
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
                preferred_vision_model = os.getenv("OPENROUTER_VISION_MODEL", "openai/gpt-4o-mini")
                try:
                    completion = self.client.chat.completions.create(
                        extra_headers={
                            "HTTP-Referer": self.app_url,
                            "X-OpenRouter-Title": "Business Assistant",
                        },
                        # Модель должна поддерживать vision (input_modality="image")
                        model=preferred_vision_model,
                        messages=messages,
                        temperature=0.7,
                        max_tokens=1000
                    )
                except Exception as e:
                    if self._is_openrouter_guardrail_data_policy_404(e):
                        alt_model_name = self._pick_openrouter_model(
                            preferred_vision_model,
                            input_modality="image",
                        )
                        if alt_model_name != preferred_vision_model:
                            print(f"🔁 OpenRouter vision model fallback: {preferred_vision_model} -> {alt_model_name}")
                            completion = self.client.chat.completions.create(
                                extra_headers={
                                    "HTTP-Referer": self.app_url,
                                    "X-OpenRouter-Title": "Business Assistant",
                                },
                                model=alt_model_name,
                                messages=messages,
                                temperature=0.7,
                                max_tokens=1000
                            )
                        else:
                            raise
                    else:
                        raise
                
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