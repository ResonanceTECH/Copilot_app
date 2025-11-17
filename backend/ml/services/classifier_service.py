import os
import joblib
import numpy as np
import re
from typing import Dict, Any, Tuple


class BusinessClassifierService:
    def __init__(self, model_path: str = None):
        if model_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            ml_dir = os.path.dirname(current_dir)
            model_path = os.path.join(ml_dir, "models", "business_classifier.pkl")

        self.model_path = model_path
        self.model_data = None
        self.classifier = None
        self.labels = ['marketing', 'finance', 'legal', 'management', 'sales', 'general']
        self.category_keywords = {}
        self.load_model()

    def load_model(self):
        """Загрузка обученной модели из PKL файла"""
        try:
            if os.path.exists(self.model_path):
                self.model_data = joblib.load(self.model_path)
                print("✅ Модель загружена успешно из PKL")

                # Извлекаем компоненты модели
                self.classifier = self.model_data.get('classifier')
                self.labels = self.model_data.get('labels', self.labels)
                self.category_keywords = self.model_data.get('category_keywords', {})

                self._print_model_info()

            else:
                print(f"⚠️  Файл модели не найден: {self.model_path}")
                self.model_data = None

        except Exception as e:
            print(f"❌ Ошибка загрузки модели: {e}")
            import traceback
            traceback.print_exc()
            self.model_data = None

    def _print_model_info(self):
        """Вывод информации о загруженной модели"""
        if not self.model_data:
            return

        print("📊 Информация о модели:")
        print(f"   🎯 Классификатор: {self.classifier.__class__.__name__}")
        print(f"   🏷  Категории: {self.labels}")
        print(f"   🔑 Ключевые слова: {len(self.category_keywords)} категорий")

        if hasattr(self.classifier, 'n_features_in_'):
            print(f"   📏 Ожидает признаков: {self.classifier.n_features_in_}")
        if hasattr(self.classifier, 'n_estimators'):
            print(f"   🌳 Деревья: {self.classifier.n_estimators}")

    def _calculate_keyword_features(self, text: str) -> np.ndarray:
        """Фичи ключевых слов (ТОЧНО как при обучении)"""
        text_lower = text.lower()
        features = []

        for category, keywords in self.category_keywords.items():
            # 1. Простое наличие
            presence = sum(1 for keyword in keywords if keyword in text_lower)

            # 2. Взвешенное по TF (частоте в тексте)
            tf_score = sum(text_lower.count(keyword) for keyword in keywords)

            # 3. Нормализованный счет
            normalized_score = tf_score / max(len(text.split()), 1)

            features.extend([presence, tf_score, normalized_score])

        return np.array(features)

    def _extract_text_features(self, text: str) -> np.ndarray:
        """Текстовые метрики (ТОЧНО как при обучении)"""
        words = text.split()
        sentences = text.split('.')

        features = [
            len(text),  # длина текста
            len(words),  # количество слов
            len(sentences),  # количество предложений
            np.mean([len(word) for word in words]) if words else 0,  # средняя длина слова
            len([w for w in words if len(w) > 6]) / max(len(words), 1),  # доля длинных слов
        ]

        return np.array(features)

    def _create_zero_embeddings(self) -> np.ndarray:
        """Создаем нулевые эмбеддинги (384 размерности для MiniLM-L12-v2)"""
        return np.zeros(384)

    def _prepare_features(self, text: str) -> np.ndarray:
        """Подготовка признаков для предсказания"""
        # 1. НУЛЕВЫЕ эмбеддинги (так как embedder не сохранен)
        embeddings = self._create_zero_embeddings()

        # 2. Признаки ключевых слов
        keyword_features = self._calculate_keyword_features(text)

        # 3. Текстовые метрики
        text_features = self._extract_text_features(text)

        # Объединяем все признаки
        combined_features = np.hstack([embeddings, keyword_features, text_features])

        print(f"📊 Признаки: эмбеддинги=384, ключи={len(keyword_features)}, метрики={len(text_features)}")

        return combined_features.reshape(1, -1)

    def predict_category(self, text: str) -> Tuple[str, Dict[str, float]]:
        """Предсказание категории вопроса"""
        if not self.model_data or not self.classifier:
            print("⚠️  Модель не загружена, используем фиктивное предсказание")
            return self._dummy_prediction(text)

        try:
            # Подготавливаем признаки
            features = self._prepare_features(text)

            # Проверяем размерность
            expected_features = self.classifier.n_features_in_
            actual_features = features.shape[1]

            if actual_features != expected_features:
                print(f"⚠️  Несоответствие размерности: ожидалось {expected_features}, получили {actual_features}")
                return self._dummy_prediction(text)

            # Предсказание
            prediction = self.classifier.predict(features)[0]
            probabilities = self.classifier.predict_proba(features)[0]

            # Форматируем вероятности
            prob_dict = {
                label: round(prob, 3)
                for label, prob in zip(self.classifier.classes_, probabilities)
            }

            print(f"🎯 Предсказание: '{text[:50]}...' -> {prediction} (вероятность: {prob_dict[prediction]:.1%})")
            return prediction, prob_dict

        except Exception as e:
            print(f"❌ Ошибка предсказания: {e}")
            import traceback
            traceback.print_exc()
            return self._keyword_based_prediction(text)

    def _keyword_based_prediction(self, text: str) -> Tuple[str, Dict[str, float]]:
        """Предсказание на основе только ключевых слов"""
        keyword_features = self._calculate_keyword_features(text)

        # Берем только presence фичи (первые 6 значений)
        presence_scores = keyword_features[::3][:6]

        max_score = max(presence_scores)
        if max_score > 0:
            best_category_idx = np.argmax(presence_scores)
            best_category = self.labels[best_category_idx]

            # Создаем искусственные вероятности
            probs = {category: 0.05 for category in self.labels}
            probs[best_category] = 0.7
            return best_category, probs
        else:
            return 'general', {'general': 1.0}

    def _dummy_prediction(self, text: str) -> Tuple[str, Dict[str, float]]:
        """Фиктивное предсказание если модель не загружена"""
        text_lower = text.lower()

        keyword_mapping = {
            'marketing': ['маркетинг', 'реклама', 'продвижен', 'бренд', 'smm', 'seo'],
            'finance': ['финанс', 'бюджет', 'налог', 'деньг', 'отчетность', 'рентабельность'],
            'legal': ['юридич', 'договор', 'закон', 'прав', 'лиценз', 'регистрац'],
            'management': ['управлен', 'команд', 'персонал', 'процесс', 'kpi', 'мотивац'],
            'sales': ['продаж', 'клиент', 'сделк', 'лид', 'crm', 'возражен']
        }

        for category, keywords in keyword_mapping.items():
            if any(keyword in text_lower for keyword in keywords):
                probs = {category: 0.8, 'general': 0.2}
                return category, probs

        return 'general', {'general': 1.0}

    def is_ready(self) -> bool:
        """Проверка готовности классификатора"""
        return self.model_data is not None and self.classifier is not None

    def get_model_info(self) -> Dict[str, Any]:
        """Информация о загруженной модели"""
        if not self.model_data:
            return {"status": "not_loaded"}

        info = {
            "status": "loaded",
            "classifier": self.classifier.__class__.__name__,
            "categories": self.labels,
            "keyword_categories": len(self.category_keywords)
        }

        if hasattr(self.classifier, 'n_features_in_'):
            info["expected_features"] = self.classifier.n_features_in_

        return info
