FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    libgl1 \
    libglib2.0-0 \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Копирование файлов зависимостей backend
COPY backend/requirements.txt /app/requirements.txt

# Установка Python зависимостей с увеличенным таймаутом и ретраями
RUN pip install --no-cache-dir \
    --default-timeout=300 \
    --retries=5 \
    --timeout=300 \
    -r /app/requirements.txt

# Копирование кода приложения backend
COPY backend /app/backend

# Копирование .env файла (если есть)
COPY .env* /app/

# Переменные окружения
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Открываем порт
EXPOSE 8000

# Делаем скрипт запуска исполняемым
RUN chmod +x /app/backend/run.sh

# Команда запуска через скрипт с отладкой
CMD ["/bin/bash", "/app/backend/run.sh"]
