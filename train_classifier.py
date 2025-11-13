import sys
import os

# Добавляем пути для импортов
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.business_classifier import EnhancedBusinessClassifier
from datasets.dataset_generation import business_dataset


def train_classifier():
    """Обучение классификатора на датасете"""
    print("🚀 Начинаем обучение классификатора...")

    # Проверяем датасет
    print(f"📊 Размер датасета: {len(business_dataset)} примеров")

    # Считаем распределение по категориям
    from collections import Counter
    label_counts = Counter([item['label'] for item in business_dataset])
    print("📈 Распределение по категориям:")
    for label, count in label_counts.items():
        print(f"   {label}: {count} примеров")

    # Создаем и обучаем классификатор
    classifier = EnhancedBusinessClassifier()

    print("🧠 Обучаем модель...")
    train_score, test_score = classifier.train(business_dataset)

    # Сохраняем модель
    model_path = 'models/business_classifier.pkl'
    os.makedirs('models', exist_ok=True)
    classifier.save_model(model_path)

    print(f"✅ Обучение завершено!")
    print(f"📊 Точность на обучении: {train_score:.3f}")
    print(f"📊 Точность на тесте: {test_score:.3f}")
    print(f"💾 Модель сохранена в: {model_path}")

    # Тестируем на нескольких примерах
    print("\n🧪 Тестируем классификатор:")
    test_questions = [
        "Как продвигать бизнес в инстаграм",
        "Налоговое планирование для ИП",
        "Договор с поставщиками услуг",
        "Управление удаленной командой",
        "Увеличение среднего чека",
        "Как начать бизнес с нуля"
    ]

    for question in test_questions:
        category, probs = classifier.predict(question)
        print(f"   '{question}' -> {category} (вероятность: {probs[category]:.1%})")

    return classifier


if __name__ == "__main__":
    train_classifier()