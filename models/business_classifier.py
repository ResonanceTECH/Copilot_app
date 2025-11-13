import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib
import re
import numpy as np
from scipy.sparse import hstack


class EnhancedBusinessClassifier:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=1500,
            min_df=2,
            max_df=0.85,
            ngram_range=(1, 3),
            stop_words=['как', 'для', 'что', 'это', 'так', 'в', 'на', 'с', 'по', 'о', 'и', 'или', 'а', 'но']
        )
        self.classifier = RandomForestClassifier(
            n_estimators=150,
            max_depth=25,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42
        )
        self.labels = ['marketing', 'finance', 'legal', 'management', 'sales', 'general']

        # Ключевые слова для каждой категории
        self.category_keywords = {
            'marketing': ['маркетинг', 'реклама', 'продвижение', 'бренд', 'smm', 'seo', 'конверсия', 'таргетинг'],
            'finance': ['финанс', 'бюджет', 'налог', 'инвестиц', 'кредит', 'деньги', 'отчетность', 'рентабельность'],
            'legal': ['юридич', 'договор', 'правов', 'закон', 'лиценз', 'регистрац', 'суд', 'иск'],
            'management': ['управлен', 'команда', 'персонал', 'процесс', 'оптимизац', 'kpi', 'мотивац', 'руководств'],
            'sales': ['продаж', 'клиент', 'сделка', 'лид', 'crm', 'возражен', 'коммерческ', 'контракт'],
            'general': ['бизнес', 'стартап', 'компания', 'развитие', 'стратегия', 'план', 'идея', 'проект']
        }

    def preprocess_text(self, text):
        text = text.lower()
        text = re.sub(r'[^\w\s#+]', ' ', text)
        text = re.sub(r'\d+', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def calculate_keyword_score(self, text):
        text_lower = text.lower()
        scores = {}
        for category, keywords in self.category_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            scores[category] = score
        return scores

    def train(self, dataset):
        df = pd.DataFrame(dataset)
        df['processed_text'] = df['text'].apply(self.preprocess_text)

        # Создаем признаки ключевых слов для ВСЕГО датасета
        keyword_features = []
        for text in df['text']:
            scores = self.calculate_keyword_score(text)
            keyword_features.append([scores.get(label, 0) for label in self.labels])

        # Преобразуем в numpy array
        keyword_features = np.array(keyword_features)

        # Разделение на обучающую и тестовую выборки
        X_train, X_test, y_train, y_test = train_test_split(
            df['processed_text'], df['label'], test_size=0.15, random_state=42, stratify=df['label']
        )

        # Векторизация текста
        X_train_vec = self.vectorizer.fit_transform(X_train)
        X_test_vec = self.vectorizer.transform(X_test)

        # Получаем индексы для train и test выборок
        train_indices = X_train.index
        test_indices = X_test.index

        # Берем соответствующие keyword_features для train и test
        keyword_features_train = keyword_features[train_indices]
        keyword_features_test = keyword_features[test_indices]

        # Объединяем TF-IDF и keyword features
        X_train_combined = hstack([X_train_vec, keyword_features_train])
        X_test_combined = hstack([X_test_vec, keyword_features_test])

        # Обучение классификатора
        self.classifier.fit(X_train_combined, y_train)

        # Оценка точности
        train_score = self.classifier.score(X_train_combined, y_train)
        test_score = self.classifier.score(X_test_combined, y_test)

        print(f"✅ Точность на обучающей выборке: {train_score:.3f}")
        print(f"✅ Точность на тестовой выборке: {test_score:.3f}")

        return train_score, test_score

    def predict(self, text):
        processed_text = self.preprocess_text(text)

        # Векторизация текста
        text_vec = self.vectorizer.transform([processed_text])

        # Оценка ключевых слов
        keyword_scores = self.calculate_keyword_score(text)
        keyword_features = np.array([[keyword_scores.get(label, 0) for label in self.labels]])

        # Объединяем признаки
        combined_features = hstack([text_vec, keyword_features])

        # Предсказание
        prediction = self.classifier.predict(combined_features)[0]
        probabilities = self.classifier.predict_proba(combined_features)[0]

        prob_dict = {
            label: round(prob, 3)
            for label, prob in zip(self.classifier.classes_, probabilities)
        }

        return prediction, prob_dict

    def save_model(self, path):
        model_data = {
            'vectorizer': self.vectorizer,
            'classifier': self.classifier,
            'labels': self.labels,
            'category_keywords': self.category_keywords
        }
        joblib.dump(model_data, path)
        print(f"✅ Модель сохранена в {path}")

    def load_model(self, path):
        model_data = joblib.load(path)
        self.vectorizer = model_data['vectorizer']
        self.classifier = model_data['classifier']
        self.labels = model_data['labels']
        self.category_keywords = model_data['category_keywords']
        print(f"✅ Модель загружена из {path}")