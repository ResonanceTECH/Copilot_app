import hashlib
from datetime import datetime, timedelta


class CacheService:
    def __init__(self, max_size: int = 100, ttl_hours: int = 24):
        self.cache = {}
        self.max_size = max_size
        self.ttl = timedelta(hours=ttl_hours)

    def get_cache_key(self, question: str):
        """Генерация ключа кэша"""
        return hashlib.md5(question.lower().encode()).hexdigest()

    def get(self, question: str):
        """Получение из кэша"""
        key = self.get_cache_key(question)
        if key in self.cache:
            cached_data = self.cache[key]
            if datetime.now() - cached_data['timestamp'] < self.ttl:
                return cached_data['data']
            else:
                del self.cache[key]
        return None

    def set(self, question: str, data):
        """Сохранение в кэш"""
        key = self.get_cache_key(question)

        if len(self.cache) >= self.max_size:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]

        self.cache[key] = {
            'data': data,
            'timestamp': datetime.now()
        }

    def clear(self):
        """Очистка кэша"""
        self.cache.clear()