import os
from backend.ml.models.business_classifier import EnhancedBusinessClassifier


class BusinessClassifierService:
    def __init__(self, model_path: str = None):
        # Определяем путь к модели относительно структуры проекта
        if model_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            # Текущий файл: backend/ml/services/classifier_service.py
            # Модель должна быть в: backend/ml/models/business_classifier.pkl
            ml_dir = os.path.dirname(current_dir)
            model_path = os.path.join(ml_dir, "models", "business_classifier.pkl")
        
        self.model_path = model_path
        self.classifier = None
        self.load_model()

    def load_model(self):
        """Загрузка обученной модели классификатора"""
        try:
            if os.path.exists(self.model_path):
                self.classifier = EnhancedBusinessClassifier()
                self.classifier.load_model(self.model_path)
                print("✅ Классификатор загружен успешно")
            else:
                print("⚠️  Обученная модель не найдена. Запустите train_classifier.py")
                print("📁 Используется фиктивный классификатор")
                self.classifier = None

        except Exception as e:
            print(f"❌ Ошибка загрузки классификатора: {e}")
            self.classifier = None

    def predict_category(self, text: str):
        """Предсказание категории вопроса"""
        if not self.classifier:
            # Фиктивное предсказание если модель не загружена
            return self._dummy_prediction(text)

        try:
            category, probabilities = self.classifier.predict(text)
            print(f"🎯 Предсказание: '{text}' -> {category}")
            return category, probabilities
        except Exception as e:
            print(f"❌ Ошибка предсказания: {e}")
            return self._dummy_prediction(text)

    def _dummy_prediction(self, text: str):
        """Фиктивное предсказание для тестирования"""
        text_lower = text.lower()

        # Простая логика на ключевых словах
        if any(word in text_lower for word in ['маркетинг', 'реклама', 'продвижен']):
            return 'marketing', {'marketing': 0.8, 'general': 0.2}
        elif any(word in text_lower for word in ['финанс', 'бюджет', 'налог', 'деньг']):
            return 'finance', {'finance': 0.8, 'general': 0.2}
        elif any(word in text_lower for word in ['юридич', 'договор', 'закон', 'прав']):
            return 'legal', {'legal': 0.8, 'general': 0.2}
        elif any(word in text_lower for word in ['управлен', 'команд', 'персонал']):
            return 'management', {'management': 0.8, 'general': 0.2}
        elif any(word in text_lower for word in ['продаж', 'клиент', 'сделк']):
            return 'sales', {'sales': 0.8, 'general': 0.2}
        else:
            return 'general', {'general': 1.0}

    def is_ready(self):
        """Проверка готовности классификатора"""
        return self.classifier is not None