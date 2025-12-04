"""
Сервис для локальной транскрибации аудио через Whisper
Использует faster-whisper для быстрой работы
"""
import os
import tempfile
import threading
from typing import Optional
from faster_whisper import WhisperModel


class LocalWhisperService:
    """Сервис для локальной транскрибации через Whisper"""
    
    def __init__(self, model_size: str = "base", device: str = "cpu", compute_type: str = "int8", download_root: Optional[str] = None):
        """
        Инициализация локального Whisper сервиса
        
        Args:
            model_size: Размер модели (tiny, base, small, medium, large-v2, large-v3)
            device: Устройство (cpu, cuda)
            compute_type: Тип вычислений (int8, int8_float16, float16, float32)
            download_root: Путь для сохранения моделей (опционально)
        """
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.download_root = download_root
        self.model: Optional[WhisperModel] = None
        self._model_loading_attempted = False
        self._loading_lock = threading.Lock()
        # Загружаем модель в фоновом потоке только если не указан локальный путь
        # Если указан download_root, модель будет загружена при первом использовании
        load_async = os.getenv("WHISPER_LOAD_ASYNC", "true").lower() == "true"
        if load_async:
            self._load_model_async()
    
    def _load_model_async(self):
        """Асинхронная загрузка модели Whisper в фоновом потоке"""
        if self._model_loading_attempted:
            return
        
        self._model_loading_attempted = True
        
        def load_in_background():
            """Загрузка модели в фоновом потоке"""
            try:
                print(f"🔄 Загрузка модели Whisper ({self.model_size}) в фоновом режиме...")
                print(f"⏳ Это может занять несколько минут при первом запуске...")
                
                model_kwargs = {
                    "device": self.device,
                    "compute_type": self.compute_type
                }
                
                if self.download_root:
                    model_kwargs["download_root"] = self.download_root
                
                # Загружаем модель (может занять время при первом запуске)
                with self._loading_lock:
                    self.model = WhisperModel(self.model_size, **model_kwargs)
                
                print(f"✅ Модель Whisper ({self.model_size}) загружена успешно и готова к использованию")
            except Exception as e:
                print(f"⚠️ Ошибка загрузки модели Whisper в фоне: {e}")
                print(f"💡 Модель попробует загрузиться при первом использовании...")
                import traceback
                traceback.print_exc()
                with self._loading_lock:
                    self.model = None
        
        # Запускаем загрузку в отдельном потоке
        thread = threading.Thread(target=load_in_background, daemon=True)
        thread.start()
    
    def _load_model(self):
        """Синхронная загрузка модели (используется при первом использовании если не загрузилась в фоне)"""
        if self.model is not None:
            return
        
        with self._loading_lock:
            if self.model is not None:
                return
            
            try:
                print(f"🔄 Загрузка модели Whisper ({self.model_size})...")
                print(f"⏳ Это может занять несколько минут при первом запуске...")
                
                model_kwargs = {
                    "device": self.device,
                    "compute_type": self.compute_type
                }
                
                if self.download_root:
                    model_kwargs["download_root"] = self.download_root
                
                self.model = WhisperModel(self.model_size, **model_kwargs)
                print(f"✅ Модель Whisper ({self.model_size}) загружена успешно")
            except Exception as e:
                print(f"❌ Ошибка загрузки модели Whisper: {e}")
                import traceback
                traceback.print_exc()
                raise
    
    def transcribe(self, audio_bytes: bytes, language: str = "ru") -> str:
        """
        Транскрибация аудио в текст
        
        Args:
            audio_bytes: Байты аудио файла
            language: Язык аудио (ru, en, etc.) или None для автоопределения
            
        Returns:
            Распознанный текст
        """
        # Пытаемся загрузить модель если еще не загружена (fallback)
        if not self.model:
            print("🔄 Попытка загрузки модели Whisper при первом использовании...")
            # Ждем немного, возможно модель загружается в фоне
            import time
            waited = 0
            max_wait = 30  # Увеличиваем до 30 секунд ожидания фоновой загрузки
            while waited < max_wait:
                time.sleep(1)
                waited += 1
                with self._loading_lock:
                    if self.model is not None:
                        print(f"✅ Модель загружена из фонового потока")
                        break
                if waited % 5 == 0:
                    print(f"⏳ Ожидание загрузки модели... ({waited}/{max_wait} сек)")
            
            # Если модель все еще не загружена, пытаемся загрузить синхронно с таймаутом
            with self._loading_lock:
                if not self.model:
                    try:
                        print("🔄 Синхронная загрузка модели Whisper...")
                        print("⏳ Это может занять несколько минут при первом запуске...")
                        
                        # Используем threading для таймаута загрузки
                        import threading
                        model_result = [None]
                        load_error = [None]
                        
                        def load_model():
                            try:
                                model_kwargs = {
                                    "device": self.device,
                                    "compute_type": self.compute_type
                                }
                                
                                if self.download_root:
                                    model_kwargs["download_root"] = self.download_root
                                
                                model_result[0] = WhisperModel(self.model_size, **model_kwargs)
                            except Exception as e:
                                load_error[0] = e
                        
                        load_thread = threading.Thread(target=load_model, daemon=True)
                        load_thread.start()
                        load_thread.join(timeout=120)  # Таймаут 2 минуты на загрузку
                        
                        if load_thread.is_alive():
                            print("⏱️ Загрузка модели превысила таймаут (120 сек)")
                            raise TimeoutError("Загрузка модели превысила таймаут")
                        
                        if load_error[0]:
                            raise load_error[0]
                        
                        if model_result[0] is None:
                            raise ValueError("Модель не была загружена")
                        
                        self.model = model_result[0]
                        print(f"✅ Модель Whisper загружена успешно")
                    except (TimeoutError, ValueError, Exception) as e:
                        print(f"❌ Не удалось загрузить модель: {e}")
                        import traceback
                        traceback.print_exc()
                        raise ValueError(
                            f"Модель Whisper не загружена. "
                            f"Проверьте подключение к интернету для загрузки модели из HuggingFace Hub. "
                            f"Ошибка: {str(e)}"
                        )
        
        if not self.model:
            raise ValueError(
                "Модель Whisper не загружена. "
                "Проверьте подключение к интернету для первой загрузки модели."
            )
        
        print(f"📊 Параметры транскрибации:")
        print(f"   - Размер аудио: {len(audio_bytes)} байт")
        print(f"   - Язык: {language}")
        print(f"   - Модель: {self.model_size}")
        
        # Сохраняем аудио во временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_path = tmp_file.name
        
        try:
            # Транскрибация
            print(f"🔄 Запуск транскрибации...")
            # Для коротких записей используем менее агрессивный VAD фильтр
            # Оцениваем длительность по размеру файла (примерно 1KB = 0.1 сек для webm)
            estimated_duration = len(audio_bytes) / 10000  # Примерная оценка
            use_vad = estimated_duration > 1.0  # Используем VAD только для записей > 1 сек
            
            transcribe_params = {
                "language": language if language != "auto" else None,
                "beam_size": 5,
            }
            
            if use_vad:
                transcribe_params["vad_filter"] = True
                transcribe_params["vad_parameters"] = dict(min_silence_duration_ms=300)  # Менее агрессивный
                print(f"   - Используется VAD фильтр (оценка длительности: {estimated_duration:.2f} сек)")
            else:
                print(f"   - VAD фильтр отключен для короткой записи (оценка: {estimated_duration:.2f} сек)")
            
            segments, info = self.model.transcribe(tmp_path, **transcribe_params)
            
            print(f"📝 Информация о транскрибации:")
            print(f"   - Язык: {info.language} (вероятность: {info.language_probability:.2f})")
            print(f"   - Длительность: {info.duration:.2f} сек")
            
            # Собираем текст из сегментов
            text_parts = []
            segment_count = 0
            for segment in segments:
                segment_count += 1
                text_parts.append(segment.text.strip())
                print(f"   - Сегмент {segment_count}: '{segment.text.strip()}' (время: {segment.start:.2f}-{segment.end:.2f} сек)")
            
            result_text = " ".join(text_parts).strip()
            
            print(f"📊 Результат: {len(text_parts)} сегментов, текст: '{result_text}'")
            
            if not result_text:
                print(f"❌ Пустой результат транскрибации:")
                print(f"   - Найдено сегментов: {segment_count}")
                print(f"   - Длительность аудио: {info.duration:.2f} сек")
                print(f"   - Язык: {info.language}")
                raise ValueError("Не удалось распознать речь в аудио. Возможно, запись слишком короткая или содержит только тишину.")
            
            return result_text
            
        except Exception as e:
            print(f"❌ Ошибка транскрибации: {e}")
            raise ValueError(f"Ошибка распознавания речи: {str(e)}")
        finally:
            # Удаляем временный файл
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    def is_ready(self) -> bool:
        """Проверка готовности сервиса"""
        return self.model is not None

