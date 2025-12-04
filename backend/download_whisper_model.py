"""
Скрипт для загрузки модели Whisper локально
Запустите этот скрипт один раз для загрузки модели
"""
from faster_whisper import WhisperModel
import os
from pathlib import Path

def download_model(model_size: str = "base", download_root: str = None):
    """
    Загружает модель Whisper локально
    
    Args:
        model_size: Размер модели (tiny, base, small, medium, large-v2, large-v3)
        download_root: Путь для сохранения модели (по умолчанию ~/.cache/huggingface/hub/)
    """
    print(f"🔄 Начинаем загрузку модели Whisper '{model_size}'...")
    print(f"⏳ Это может занять несколько минут...")
    
    try:
        model_kwargs = {
            "device": "cpu",
            "compute_type": "int8"
        }
        
        if download_root:
            model_kwargs["download_root"] = download_root
            print(f"📁 Модель будет сохранена в: {download_root}")
        else:
            # Путь по умолчанию для HuggingFace
            default_path = Path.home() / ".cache" / "huggingface" / "hub"
            print(f"📁 Модель будет сохранена в: {default_path}")
        
        # Загружаем модель (это скачает её с HuggingFace Hub)
        model = WhisperModel(model_size, **model_kwargs)
        
        print(f"✅ Модель Whisper '{model_size}' успешно загружена!")
        print(f"💡 Теперь модель будет использоваться локально без повторной загрузки")
        
        return True
    except Exception as e:
        print(f"❌ Ошибка загрузки модели: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    
    # Размер модели из аргументов или по умолчанию
    model_size = sys.argv[1] if len(sys.argv) > 1 else "base"
    
    # Путь для сохранения из аргументов или переменной окружения
    download_root = os.getenv("WHISPER_DOWNLOAD_ROOT")
    if len(sys.argv) > 2:
        download_root = sys.argv[2]
    
    print("=" * 60)
    print("Загрузка модели Whisper для локального использования")
    print("=" * 60)
    print(f"Модель: {model_size}")
    if download_root:
        print(f"Путь сохранения: {download_root}")
    print("=" * 60)
    print()
    
    success = download_model(model_size, download_root)
    
    if success:
        print()
        print("=" * 60)
        print("✅ Готово! Модель загружена и готова к использованию")
        print("=" * 60)
    else:
        print()
        print("=" * 60)
        print("❌ Не удалось загрузить модель")
        print("Проверьте подключение к интернету и попробуйте снова")
        print("=" * 60)
        sys.exit(1)

