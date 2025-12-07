"""
Тесты для conversation_manager
"""
import pytest
from datetime import datetime, timedelta
from backend.app.services.conversation_manager import ConversationManager


class TestConversationManager:
    """Тесты для менеджера бесед"""
    
    def test_create_conversation(self):
        """Тест создания новой беседы"""
        manager = ConversationManager()
        
        conv_id = manager.create_conversation()
        
        assert conv_id is not None
        assert isinstance(conv_id, str)
        assert len(conv_id) > 0
    
    def test_create_conversation_with_id(self):
        """Тест создания беседы с указанным ID"""
        manager = ConversationManager()
        
        custom_id = "custom-conversation-id"
        conv_id = manager.create_conversation(custom_id)
        
        assert conv_id == custom_id
    
    def test_add_message(self):
        """Тест добавления сообщения"""
        manager = ConversationManager()
        
        conv_id = manager.create_conversation()
        manager.add_message(conv_id, "user", "Hello")
        
        history = manager.get_conversation_history(conv_id)
        
        assert len(history) == 1
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello"
        assert "timestamp" in history[0]
    
    def test_get_conversation_history(self):
        """Тест получения истории беседы"""
        manager = ConversationManager()
        
        conv_id = manager.create_conversation()
        
        # Добавляем несколько сообщений
        manager.add_message(conv_id, "user", "Hello")
        manager.add_message(conv_id, "assistant", "Hi there!")
        manager.add_message(conv_id, "user", "How are you?")
        
        history = manager.get_conversation_history(conv_id)
        
        assert len(history) == 3
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello"
        assert history[1]["role"] == "assistant"
        assert history[1]["content"] == "Hi there!"
        assert history[2]["role"] == "user"
        assert history[2]["content"] == "How are you?"
    
    def test_get_conversation_history_max_messages(self):
        """Тест ограничения количества сообщений в истории"""
        manager = ConversationManager()
        
        conv_id = manager.create_conversation()
        
        # Добавляем 15 сообщений
        for i in range(15):
            manager.add_message(conv_id, "user", f"Message {i}")
        
        # Запрашиваем только 10 последних
        history = manager.get_conversation_history(conv_id, max_messages=10)
        
        assert len(history) == 10
        # Должны быть последние 10 (с 5 по 14)
        assert history[0]["content"] == "Message 5"
        assert history[-1]["content"] == "Message 14"
    
    def test_get_full_conversation(self):
        """Тест получения полной истории беседы"""
        manager = ConversationManager()
        
        conv_id = manager.create_conversation()
        
        # Добавляем сообщения
        for i in range(5):
            manager.add_message(conv_id, "user", f"Message {i}")
        
        full_history = manager.get_full_conversation(conv_id)
        
        assert len(full_history) == 5
    
    def test_get_conversation_history_empty(self):
        """Тест получения истории несуществующей беседы"""
        manager = ConversationManager()
        
        history = manager.get_conversation_history("non-existent-id")
        
        assert history == []
    
    def test_message_history_limit(self):
        """Тест ограничения истории 20 сообщениями"""
        manager = ConversationManager()
        
        conv_id = manager.create_conversation()
        
        # Добавляем 25 сообщений
        for i in range(25):
            manager.add_message(conv_id, "user", f"Message {i}")
        
        # История должна быть ограничена 20 сообщениями
        full_history = manager.get_full_conversation(conv_id)
        assert len(full_history) == 20
        # Должны быть последние 20 (с 5 по 24)
        assert full_history[0]["content"] == "Message 5"
        assert full_history[-1]["content"] == "Message 24"
    
    def test_cleanup_old_conversations(self):
        """Тест очистки старых бесед"""
        import time
        
        # Создаем менеджер с очень коротким TTL (1 секунда)
        manager = ConversationManager(ttl_hours=0.000278)  # ~1 секунда
        
        conv_id1 = manager.create_conversation()
        conv_id2 = manager.create_conversation()
        
        # Добавляем сообщения
        manager.add_message(conv_id1, "user", "Old message")
        manager.add_message(conv_id2, "user", "Recent message")
        
        # Ждем истечения TTL
        time.sleep(2)
        
        # Добавляем новое сообщение во вторую беседу (обновляет timestamp)
        manager.add_message(conv_id2, "user", "Another message")
        
        # Очищаем старые беседы
        manager.cleanup_old_conversations()
        
        # Первая беседа должна быть удалена
        assert manager.get_full_conversation(conv_id1) == []
        
        # Вторая беседа должна остаться
        assert len(manager.get_full_conversation(conv_id2)) > 0
    
    def test_multiple_conversations(self):
        """Тест работы с несколькими беседами"""
        manager = ConversationManager()
        
        conv_id1 = manager.create_conversation()
        conv_id2 = manager.create_conversation()
        
        manager.add_message(conv_id1, "user", "Message 1")
        manager.add_message(conv_id2, "user", "Message 2")
        
        history1 = manager.get_conversation_history(conv_id1)
        history2 = manager.get_conversation_history(conv_id2)
        
        assert len(history1) == 1
        assert len(history2) == 1
        assert history1[0]["content"] == "Message 1"
        assert history2[0]["content"] == "Message 2"
