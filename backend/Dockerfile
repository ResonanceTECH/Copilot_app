# Многоступенчатая сборка для оптимизации размера
FROM python:3.12-slim as builder

# Установка системных зависимостей для сборки
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Рабочая директория
WORKDIR /app

# Копируем requirements.txt
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir --user -r requirements.txt

# Финальный образ
FROM python:3.12-slim

# Установка только runtime зависимостей (если нужны)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Копируем установленные пакеты из builder
COPY --from=builder /root/.local /root/.local

# Убеждаемся, что скрипты в PATH
ENV PATH=/root/.local/bin:$PATH

# Рабочая директория
WORKDIR /app

# Копируем весь проект, сохраняя структуру backend/
COPY . ./backend/

# Открываем порт
EXPOSE 8000

# Переменные окружения
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Команда запуска
# Файл main.py находится в backend/main.py
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

