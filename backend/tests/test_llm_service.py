"""
Тесты для llm_service
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from backend.app.services.llm_service import LLMService


class TestLLMService:
    """Тесты для сервиса LLM"""
    
    @pytest.fixture
    def llm_service(self, mock_env_vars):
        """Создает экземпляр LLMService для тестов"""
        with patch('backend.app.services.llm_service.OpenAI'):
            service = LLMService()
            return service
    
    def test_get_quick_response(self, llm_service):
        """Тест получения быстрого ответа"""
        assert llm_service.get_quick_response("привет") is not None
        assert llm_service.get_quick_response("спасибо") is not None
        assert llm_service.get_quick_response("помощь") is not None
        assert llm_service.get_quick_response("неизвестный вопрос") is None
    
    def test_get_quick_response_case_insensitive(self, llm_service):
        """Тест что быстрые ответы нечувствительны к регистру"""
        response1 = llm_service.get_quick_response("Привет")
        response2 = llm_service.get_quick_response("ПРИВЕТ")
        response3 = llm_service.get_quick_response("привет")
        
        assert response1 == response2 == response3
    
    def test_get_quick_response_with_spaces(self, llm_service):
        """Тест что пробелы не влияют на быстрые ответы"""
        response1 = llm_service.get_quick_response("привет")
        response2 = llm_service.get_quick_response("  привет  ")
        
        assert response1 == response2
    
    def test_count_tokens(self, llm_service):
        """Тест подсчета токенов"""
        text = "Это тестовый текст для подсчета токенов"
        
        # Если encoding доступен, должен вернуть количество токенов
        # Если нет - вернет количество слов
        tokens = llm_service.count_tokens(text)
        
        assert tokens > 0
        assert isinstance(tokens, int)
    
    def test_count_tokens_empty(self, llm_service):
        """Тест подсчета токенов пустого текста"""
        tokens = llm_service.count_tokens("")
        
        assert tokens == 0
    
    def test_prepare_conversation_messages(self, llm_service):
        """Тест подготовки сообщений для LLM"""
        system_prompt = "Ты помощник"
        user_question = "Привет"
        
        messages = llm_service.prepare_conversation_messages(
            system_prompt,
            user_question
        )
        
        assert len(messages) >= 2
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == system_prompt
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"] == user_question
    
    def test_prepare_conversation_messages_with_history(self, llm_service):
        """Тест подготовки сообщений с историей"""
        system_prompt = "Ты помощник"
        user_question = "Вопрос"
        history = [
            {"role": "user", "content": "Предыдущий вопрос"},
            {"role": "assistant", "content": "Предыдущий ответ"}
        ]
        
        messages = llm_service.prepare_conversation_messages(
            system_prompt,
            user_question,
            conversation_history=history
        )
        
        assert len(messages) >= 4  # system + 2 history + user
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert messages[2]["role"] == "assistant"
        assert messages[3]["role"] == "user"
    
    def test_prepare_conversation_messages_max_tokens(self, llm_service):
        """Тест ограничения истории по токенам"""
        system_prompt = "Ты помощник"
        user_question = "Вопрос"
        # Создаем очень длинную историю
        history = [
            {"role": "user", "content": "Очень длинный текст " * 100},
            {"role": "assistant", "content": "Очень длинный ответ " * 100},
        ]
        
        messages = llm_service.prepare_conversation_messages(
            system_prompt,
            user_question,
            conversation_history=history,
            max_tokens=100  # Очень маленький лимит
        )
        
        # Должны остаться только system prompt и текущий вопрос
        # История может быть обрезана или полностью исключена
        assert len(messages) >= 2
        assert messages[0]["role"] == "system"
        assert messages[-1]["role"] == "user"
    
    @patch('backend.app.services.llm_service.OpenAI')
    def test_generate_response_success(self, mock_openai, mock_env_vars):
        """Тест успешной генерации ответа"""
        # Мокаем OpenAI клиент
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = "Тестовый ответ"
        mock_client.chat.completions.create.return_value = mock_completion
        mock_openai.return_value = mock_client
        
        service = LLMService()
        service.client = mock_client
        
        response = service.generate_response(
            system_prompt="Ты помощник",
            user_question="Привет"
        )
        
        assert response == "Тестовый ответ"
        mock_client.chat.completions.create.assert_called_once()
    
    @patch('backend.app.services.llm_service.OpenAI')
    def test_generate_response_empty(self, mock_openai, mock_env_vars):
        """Тест обработки пустого ответа от LLM"""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = []
        mock_client.chat.completions.create.return_value = mock_completion
        mock_openai.return_value = mock_client
        
        service = LLMService()
        service.client = mock_client
        
        with pytest.raises(ValueError, match="LLM вернул пустой ответ"):
            service.generate_response(
                system_prompt="Ты помощник",
                user_question="Привет"
            )
    
    def test_get_conversation_stats(self, llm_service):
        """Тест получения статистики беседы"""
        history = [
            {"role": "user", "content": "Вопрос 1"},
            {"role": "assistant", "content": "Ответ 1"},
            {"role": "user", "content": "Вопрос 2"},
        ]
        
        stats = llm_service.get_conversation_stats(history)
        
        assert stats["total_messages"] == 3
        assert stats["user_messages"] == 2
        assert stats["assistant_messages"] == 1
        assert stats["estimated_tokens"] > 0
        assert stats["conversation_ratio"] > 0
    
    def test_get_conversation_stats_empty(self, llm_service):
        """Тест статистики пустой беседы"""
        stats = llm_service.get_conversation_stats([])
        
        assert stats["total_messages"] == 0
        assert stats["user_messages"] == 0
        assert stats["assistant_messages"] == 0
        assert stats["estimated_tokens"] == 0
        assert stats["conversation_ratio"] == 0
    
    def test_summarize_conversation_short(self, llm_service):
        """Тест суммаризации короткой беседы"""
        history = [
            {"role": "user", "content": "Вопрос"},
            {"role": "assistant", "content": "Ответ"},
        ]
        
        summary = llm_service.summarize_conversation(history)
        
        # Для коротких бесед должна вернуться пустая строка
        assert summary == ""
    
    def test_summarize_conversation_empty(self, llm_service):
        """Тест суммаризации пустой беседы"""
        summary = llm_service.summarize_conversation([])
        
        assert summary == ""
    
    @patch('backend.app.services.llm_service.OpenAI')
    def test_transcribe_audio_with_whisper_client(self, mock_openai, mock_env_vars):
        """Тест транскрибации аудио через Whisper API"""
        mock_client = MagicMock()
        mock_transcript = MagicMock()
        mock_transcript.text = "Распознанный текст"
        mock_client.audio.transcriptions.create.return_value = mock_transcript
        mock_openai.return_value = mock_client
        
        service = LLMService()
        service.whisper_client = mock_client
        service.local_whisper = None
        
        audio_bytes = b"fake audio data"
        result = service.transcribe_audio(audio_bytes, filename="test.webm", language="ru")
        
        assert result == "Распознанный текст"
        mock_client.audio.transcriptions.create.assert_called_once()
    
    @patch('backend.app.services.llm_service.OpenAI')
    def test_transcribe_audio_with_local_whisper(self, mock_openai, mock_env_vars):
        """Тест транскрибации аудио через локальный Whisper"""
        mock_local_whisper = MagicMock()
        mock_local_whisper.transcribe.return_value = "Локальный текст"
        
        service = LLMService()
        service.local_whisper = mock_local_whisper
        service.whisper_client = None
        
        audio_bytes = b"fake audio data"
        result = service.transcribe_audio(audio_bytes, filename="test.webm", language="ru")
        
        assert result == "Локальный текст"
        mock_local_whisper.transcribe.assert_called_once()
    
    @patch('backend.app.services.llm_service.OpenAI')
    def test_transcribe_audio_no_whisper(self, mock_openai, mock_env_vars):
        """Тест транскрибации когда Whisper недоступен"""
        service = LLMService()
        service.local_whisper = None
        service.whisper_client = None
        
        audio_bytes = b"fake audio data"
        
        with pytest.raises(ValueError, match="Whisper недоступен"):
            service.transcribe_audio(audio_bytes, filename="test.webm", language="ru")
    
    @patch('backend.app.services.llm_service.OpenAI')
    def test_analyze_image_success(self, mock_openai, mock_env_vars):
        """Тест анализа изображения"""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = "Описание изображения"
        mock_client.chat.completions.create.return_value = mock_completion
        mock_openai.return_value = mock_client
        
        service = LLMService()
        service.client = mock_client
        
        image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        result = service.analyze_image(image_base64, "Опиши это изображение")
        
        assert "Описание изображения" in result
        mock_client.chat.completions.create.assert_called()
    
    @patch('backend.app.services.llm_service.OpenAI')
    @patch('os.getenv')
    def test_analyze_image_fallback_openai(self, mock_getenv, mock_openai, mock_env_vars):
        """Тест анализа изображения с fallback на OpenAI API"""
        # Мокаем getenv для разных ключей
        def getenv_side_effect(key, default=None):
            if key == "OPENAI_API_KEY":
                return "test-key"
            elif key == "LLM_REQUEST_TIMEOUT":
                return "120.0"
            elif key == "LLM_CONNECT_TIMEOUT":
                return "30.0"
            elif key == "USE_OLLAMA":
                return "false"
            elif key == "APP_URL":
                return "http://localhost"
            else:
                return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        mock_openrouter_client = MagicMock()
        mock_openrouter_completion = MagicMock()
        mock_openrouter_completion.choices = []
        mock_openrouter_client.chat.completions.create.return_value = mock_openrouter_completion
        
        mock_openai_client = MagicMock()
        mock_openai_completion = MagicMock()
        mock_openai_completion.choices = [MagicMock()]
        mock_openai_completion.choices[0].message.content = "OpenAI описание"
        mock_openai_client.chat.completions.create.return_value = mock_openai_completion
        
        # Мокаем два вызова OpenAI - для OpenRouter и для OpenAI API
        mock_openai.side_effect = [mock_openrouter_client, mock_openai_client]
        
        service = LLMService()
        service.client = mock_openrouter_client
        
        image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        result = service.analyze_image(image_base64, "Опиши")
        
        assert "OpenAI описание" in result or "описание" in result.lower()
    
    @patch('backend.app.services.llm_service.OpenAI')
    def test_analyze_image_error(self, mock_openai, mock_env_vars):
        """Тест обработки ошибки при анализе изображения"""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        mock_openai.return_value = mock_client
        
        service = LLMService()
        service.client = mock_client
        
        image_base64 = "invalid_base64"
        result = service.analyze_image(image_base64, "Опиши")
        
        assert "Ошибка" in result or "не удалось" in result.lower()
    
    def test_generate_response_with_context(self, llm_service):
        """Тест устаревшего метода generate_response_with_context"""
        # Этот метод просто вызывает generate_response
        # Тестируем что он существует и работает
        with patch.object(llm_service, 'generate_response') as mock_gen:
            mock_gen.return_value = "Test response"
            
            result = llm_service.generate_response_with_context(
                system_prompt="Test",
                context_messages=[{"role": "user", "content": "Test"}],
                user_question="Question"
            )
            
            assert result == "Test response"
            mock_gen.assert_called_once()
