FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Копирование файлов зависимостей backend
COPY backend/requirements.txt /app/requirements.txt

# Установка Python зависимостей
RUN pip install --no-cache-dir -r /app/requirements.txt

# Копирование кода приложения backend
COPY backend /app/backend

# Копирование .env файла (если есть)
COPY .env* /app/

# Переменные окружения
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Открываем порт
EXPOSE 8000

# Команда запуска
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
