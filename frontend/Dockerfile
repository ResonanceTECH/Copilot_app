# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение для продакшена
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine

# Копируем собранные файлы из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем шаблон конфигурации nginx
# nginx:alpine автоматически обрабатывает шаблоны из /etc/nginx/templates/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Открываем порт 80
EXPOSE 80

# nginx:alpine автоматически запускает envsubst для шаблонов при старте

