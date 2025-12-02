import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import re


class EnhancedBusinessClassifier:
    def __init__(self):
        self.classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=30,
            min_samples_split=3,
            min_samples_leaf=1,
            random_state=42
        )
        # Категории включая 'graphic'
        self.labels = ['marketing', 'finance', 'legal', 'management', 'sales', 'general', 'graphic']

        # Ключевые слова для категорий
        self.category_keywords = {
            'marketing': ['маркетинг', 'реклама', 'продвижение', 'бренд', 'smm', 'seo', 'таргетинг',
                          'контент', 'аудитория', 'трафик', 'конверсия', 'воронка'],
            'finance': ['финанс', 'бюджет', 'налог', 'инвестиц', 'кредит', 'деньги', 'отчетность',
                        'рентабельность', 'выручка', 'прибыль', 'расход', 'касса'],
            'legal': ['юридич', 'договор', 'правов', 'закон', 'лиценз', 'регистрац', 'суд',
                      'иск', 'адвокат', 'нотариус', 'патент', 'авторское'],
            'management': ['управлен', 'команда', 'персонал', 'процесс', 'оптимизац', 'kpi',
                           'мотивац', 'руководств', 'отдел', 'сотрудник', 'эффективность'],
            'sales': ['продаж', 'клиент', 'сделка', 'лид', 'crm', 'возражен', 'коммерческ',
                      'контракт', 'менеджер', 'запрос', 'предложение'],
            'general': ['бизнес', 'стартап', 'компания', 'развитие', 'стратегия', 'план',
                        'идея', 'проект', 'рынок', 'конкуренция', 'ниша'],
            'graphic': [
                'график', 'диаграмма', 'визуализац', 'chart', 'plot', 'визуализировать',
                'отобразить', 'построить', 'нарисовать', 'статистик', 'данные', 'таблиц',
                'анализ данных', 'гистограмм', 'круговая', 'столбчатая', 'линейный', 'scatter',
                'heatmap', 'тренд', 'динамика', 'распределение', 'доля', 'процент', 'гистограмма',
                'точечный', 'корреляция', 'зависимость', 'ящик с усами', 'box plot', 'violin',
                'bar chart', 'pie chart', 'line chart', 'area chart', 'графический', 'визуальный',
                'отчёт', 'отчет', 'визуализация', 'диаграм', 'построй', 'нарисуй', 'покажи',
                'создай', 'отобрази', 'представь в виде'
            ]
        }

    def preprocess_text(self, text):
        """Упрощенная предобработка"""
        text = str(text).lower()
        text = re.sub(r'[^\w\s#+]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def calculate_keyword_features(self, text):
        """Расширенные фичи ключевых слов"""
        text_lower = text.lower()
        features = []

        for category, keywords in self.category_keywords.items():
            presence = sum(1 for keyword in keywords if keyword in text_lower)
            tf_score = sum(text_lower.count(keyword) for keyword in keywords)
            normalized_score = tf_score / max(len(text.split()), 1)
            features.extend([presence, tf_score, normalized_score])

        return np.array(features)

    def get_text_embeddings(self, texts):
        """Получение семантических эмбеддингов (заглушка)"""
        if isinstance(texts, str):
            texts = [texts]

        embedding_dim = 384
        if len(texts) > 0:
            embeddings = np.zeros((len(texts), embedding_dim))
        else:
            embeddings = np.array([]).reshape(0, embedding_dim)

        return embeddings

    def extract_text_features(self, text):
        """Извлечение дополнительных текстовых фич"""
        words = text.split()
        sentences = text.split('.')

        features = [
            len(text),
            len(words),
            len(sentences),
            np.mean([len(word) for word in words]) if words else 0,
            len([w for w in words if len(w) > 6]) / max(len(words), 1),
        ]

        return np.array(features)

    def train(self, dataset):
        """Обучение модели"""
        df = pd.DataFrame(dataset)
        df['processed_text'] = df['text'].apply(self.preprocess_text)

        print("🔍 Извлечение признаков...")
        print(f"📊 Категории в датасете: {df['label'].unique()}")
        print(f"📈 Распределение: {df['label'].value_counts().to_dict()}")

        # 1. Семантические эмбеддинги (заглушка)
        embeddings = self.get_text_embeddings(df['processed_text'].tolist())

        # 2. Признаки ключевых слов (теперь 7 категорий × 3 фичи = 21 фича)
        keyword_features = np.array([self.calculate_keyword_features(text) for text in df['text']])

        # 3. Текстовые метрики
        text_metrics = np.array([self.extract_text_features(text) for text in df['processed_text']])

        # Объединяем все признаки
        X_combined = np.hstack([embeddings, keyword_features, text_metrics])
        y = df['label']

        print(f"📊 Размерность признаков: {X_combined.shape}")
        print(f"📊 Размерность эмбеддингов: {embeddings.shape}")
        print(f"📊 Размерность keyword_features: {keyword_features.shape}")
        print(f"📊 Размерность text_metrics: {text_metrics.shape}")

        # Разделение на train/test с учетом новой категории
        X_train, X_test, y_train, y_test = train_test_split(
            X_combined, y, test_size=0.15, random_state=42, stratify=y
        )

        # Обучение классификатора
        self.classifier.fit(X_train, y_train)

        # Оценка
        train_score = self.classifier.score(X_train, y_train)
        test_score = self.classifier.score(X_test, y_test)

        print(f"✅ Точность на обучающей выборке: {train_score:.3f}")
        print(f"✅ Точность на тестовой выборке: {test_score:.3f}")

        # Детальный отчет
        y_pred = self.classifier.predict(X_test)
        print("\n📋 Детальная метрика:")
        print(classification_report(y_test, y_pred, target_names=self.labels))

        return train_score, test_score

    def predict(self, text):
        """Предсказание с улучшенными признаками"""
        processed_text = self.preprocess_text(text)

        # 1. Эмбеддинги (заглушка)
        embedding = self.get_text_embeddings(processed_text)

        # 2. Ключевые слова
        keyword_feats = self.calculate_keyword_features(text).reshape(1, -1)

        # 3. Текстовые метрики
        text_feats = self.extract_text_features(processed_text).reshape(1, -1)

        # Объединяем
        combined_features = np.hstack([embedding, keyword_feats, text_feats])

        # Предсказание
        prediction = self.classifier.predict(combined_features)[0]
        probabilities = self.classifier.predict_proba(combined_features)[0]

        prob_dict = {
            label: round(prob, 3)
            for label, prob in zip(self.classifier.classes_, probabilities)
        }

        # Логирование для отладки
        print(f"🔍 Предсказание для '{text[:50]}...': {prediction}")
        print(f"📊 Вероятности: {prob_dict}")

        return prediction, prob_dict

    def save_model(self, path):
        """Сохранение модели"""
        model_data = {
            'classifier': self.classifier,
            'labels': self.labels,
            'category_keywords': self.category_keywords
        }
        joblib.dump(model_data, path)
        print(f"✅ Модель сохранена в {path}")

    def load_model(self, path):
        """Загрузка модели"""
        model_data = joblib.load(path)
        self.classifier = model_data['classifier']
        self.labels = model_data['labels']
        self.category_keywords = model_data['category_keywords']
        print(f"✅ Модель загружена из {path}")