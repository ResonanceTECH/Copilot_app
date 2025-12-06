#!/bin/bash

# Скрипт для получения SSL сертификата через Let's Encrypt с использованием nip.io
# Использование: ./scripts/init_ssl.sh <IP_ADDRESS>
# Пример: ./scripts/init_ssl.sh 158.160.165.223

set -e

if [ -z "$1" ]; then
    echo "Ошибка: Укажите IP адрес"
    echo "Использование: $0 <IP_ADDRESS>"
    echo "Пример: $0 158.160.165.223"
    exit 1
fi

IP_ADDRESS=$1
DOMAIN="${IP_ADDRESS}.nip.io"
EMAIL="admin@${DOMAIN}"  # Let's Encrypt требует email, но можно использовать любой

echo "🔐 Настройка SSL для домена: ${DOMAIN}"
echo "📧 Email для Let's Encrypt: ${EMAIL}"

# Проверяем, что контейнеры запущены
if ! docker ps | grep -q copilot_frontend; then
    echo "❌ Ошибка: Контейнер copilot_frontend не запущен"
    echo "Запустите сначала: docker-compose up -d frontend"
    exit 1
fi

# Создаем директорию для ACME challenge
docker exec copilot_frontend mkdir -p /var/www/certbot

# Получаем сертификат
echo "📝 Запрос сертификата у Let's Encrypt..."
docker run --rm \
    -v copilot_app_certbot_certs:/etc/letsencrypt \
    -v copilot_app_certbot_www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "${DOMAIN}"

if [ $? -eq 0 ]; then
    echo "✅ Сертификат успешно получен!"
    echo ""
    echo "📋 Следующие шаги:"
    echo "1. Обновите .env файл:"
    echo "   APP_DOMAIN=${DOMAIN}"
    echo "   APP_URL=https://${DOMAIN}"
    echo "   ENABLE_SSL=true"
    echo ""
    echo "2. Раскомментируйте HTTPS блок в frontend/nginx.conf.template"
    echo ""
    echo "3. Закомментируйте HTTP блок (кроме ACME challenge) в frontend/nginx.conf.template"
    echo ""
    echo "4. Пересоберите и перезапустите frontend:"
    echo "   docker-compose up -d --build frontend"
    echo ""
    echo "5. Проверьте доступность: https://${DOMAIN}"
else
    echo "❌ Ошибка при получении сертификата"
    exit 1
fi

