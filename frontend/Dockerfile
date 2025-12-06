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

# Устанавливаем openssl для создания самоподписанного сертификата
RUN apk add --no-cache openssl

# Создаем директорию для SSL сертификатов
RUN mkdir -p /etc/nginx/ssl

# Создаем самоподписанный SSL сертификат для localhost
# Сертификат будет работать для localhost, 127.0.0.1 и ::1
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/localhost.key \
    -out /etc/nginx/ssl/localhost.crt \
    -subj "/C=RU/ST=State/L=City/O=Organization/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:::1"

# Копируем собранные файлы из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем шаблон конфигурации nginx
# nginx:alpine автоматически обрабатывает шаблоны из /etc/nginx/templates/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Открываем порты 80 и 443
EXPOSE 80 443

# nginx:alpine автоматически запускает envsubst для шаблонов при старте

