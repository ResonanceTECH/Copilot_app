"""
Тесты для cache_service
"""
import pytest
from datetime import datetime, timedelta
from backend.app.services.cache_service import CacheService


class TestCacheService:
    """Тесты для сервиса кэширования"""
    
    def test_get_cache_key(self):
        """Тест генерации ключа кэша"""
        cache = CacheService()
        
        key1 = cache.get_cache_key("test question")
        key2 = cache.get_cache_key("test question")
        key3 = cache.get_cache_key("Test Question")  # Должен быть тот же ключ (lowercase)
        key4 = cache.get_cache_key("different question")
        
        assert key1 == key2
        assert key1 == key3  # Регистр не важен
        assert key1 != key4
        assert len(key1) == 32  # MD5 hex digest length
    
    def test_set_and_get(self):
        """Тест сохранения и получения из кэша"""
        cache = CacheService()
        
        question = "What is Python?"
        answer = {"raw_text": "Python is a programming language"}
        
        # Сначала кэша нет
        assert cache.get(question) is None
        
        # Сохраняем в кэш
        cache.set(question, answer)
        
        # Получаем из кэша
        cached = cache.get(question)
        assert cached == answer
    
    def test_cache_expiration(self):
        """Тест истечения срока действия кэша"""
        import time
        
        # Создаем кэш с очень коротким TTL (1 секунда)
        cache = CacheService(ttl_hours=0.000278)  # ~1 секунда
        
        question = "test question"
        answer = {"raw_text": "test answer"}
        
        cache.set(question, answer)
        
        # Сразу должен быть в кэше
        assert cache.get(question) == answer
        
        # Ждем истечения
        time.sleep(2)
        
        # Теперь должен быть None
        assert cache.get(question) is None
    
    def test_cache_max_size(self):
        """Тест ограничения размера кэша"""
        cache = CacheService(max_size=3)
        
        # Добавляем больше элементов, чем max_size
        for i in range(5):
            cache.set(f"question {i}", {"answer": f"answer {i}"})
        
        # Должно остаться только последние 3
        assert cache.get("question 0") is None  # Первый удален
        assert cache.get("question 1") is None  # Второй удален
        assert cache.get("question 2") is not None
        assert cache.get("question 3") is not None
        assert cache.get("question 4") is not None
    
    def test_clear_cache(self):
        """Тест очистки кэша"""
        cache = CacheService()
        
        # Добавляем несколько элементов
        cache.set("question 1", {"answer": "answer 1"})
        cache.set("question 2", {"answer": "answer 2"})
        
        assert cache.get("question 1") is not None
        assert cache.get("question 2") is not None
        
        # Очищаем кэш
        cache.clear()
        
        assert cache.get("question 1") is None
        assert cache.get("question 2") is None
    
    def test_case_insensitive_cache_key(self):
        """Тест нечувствительности к регистру ключа кэша"""
        cache = CacheService()
        
        question1 = "What is Python?"
        question2 = "WHAT IS PYTHON?"
        question3 = "what is python?"
        
        answer = {"raw_text": "Python is a language"}
        
        cache.set(question1, answer)
        
        # Все варианты должны вернуть один и тот же результат
        assert cache.get(question1) == answer
        assert cache.get(question2) == answer
        assert cache.get(question3) == answer
    
    def test_different_questions_different_keys(self):
        """Тест что разные вопросы имеют разные ключи"""
        cache = CacheService()
        
        question1 = "What is Python?"
        question2 = "What is JavaScript?"
        
        answer1 = {"raw_text": "Python answer"}
        answer2 = {"raw_text": "JavaScript answer"}
        
        cache.set(question1, answer1)
        cache.set(question2, answer2)
        
        assert cache.get(question1) == answer1
        assert cache.get(question2) == answer2
        assert cache.get(question1) != answer2
