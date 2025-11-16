import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json


class ConversationManager:
    def __init__(self, ttl_hours: int = 24):
        self.conversations: Dict[str, List[Dict]] = {}
        self.ttl = timedelta(hours=ttl_hours)

    def create_conversation(self, conversation_id: str = None) -> str:
        """Создает новую беседу или возвращает существующую"""
        if conversation_id is None:
            conversation_id = str(uuid.uuid4())

        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []

        return conversation_id

    def add_message(self, conversation_id: str, role: str, content: str):
        """Добавляет сообщение в историю беседы"""
        if conversation_id not in self.conversations:
            self.create_conversation(conversation_id)

        self.conversations[conversation_id].append({
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat()
        })

        # Ограничиваем историю последними 20 сообщениями
        if len(self.conversations[conversation_id]) > 20:
            self.conversations[conversation_id] = self.conversations[conversation_id][-20:]

    def get_conversation_history(self, conversation_id: str, max_messages: int = 10) -> List[Dict]:
        """Возвращает историю сообщений для беседы"""
        if conversation_id not in self.conversations:
            return []

        return self.conversations[conversation_id][-max_messages:]

    def get_full_conversation(self, conversation_id: str) -> List[Dict]:
        """Возвращает полную историю беседы"""
        return self.conversations.get(conversation_id, [])

    def cleanup_old_conversations(self):
        """Очищает старые беседы"""
        current_time = datetime.now()
        expired_conversations = []

        for conv_id, messages in self.conversations.items():
            if messages:
                last_message_time = datetime.fromisoformat(messages[-1]['timestamp'])
                if current_time - last_message_time > self.ttl:
                    expired_conversations.append(conv_id)

        for conv_id in expired_conversations:
            del self.conversations[conv_id]


# Глобальный экземпляр менеджера бесед
conversation_manager = ConversationManager()