#!/bin/bash

# Скрипт для включения HTTPS после получения сертификата
# Использование: ./scripts/enable_ssl.sh

set -e

NGINX_CONF="frontend/nginx.conf.template"

if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Ошибка: Файл $NGINX_CONF не найден"
    exit 1
fi

echo "🔐 Включение HTTPS в конфигурации Nginx..."

# Раскомментируем HTTPS блок
sed -i.bak 's/^# server {$/server {/g' "$NGINX_CONF"
sed -i.bak 's/^#     listen 443 ssl http2;$/    listen 443 ssl http2;/g' "$NGINX_CONF"
sed -i.bak 's/^#     server_name ${APP_DOMAIN};$/    server_name ${APP_DOMAIN};/g' "$NGINX_CONF"
sed -i.bak 's/^#     root \/usr\/share\/nginx\/html;$/    root \/usr\/share\/nginx\/html;/g' "$NGINX_CONF"
sed -i.bak 's/^#     index index.html;$/    index index.html;/g' "$NGINX_CONF"
sed -i.bak 's/^# $/ /g' "$NGINX_CONF"
sed -i.bak 's/^#     # SSL сертификаты$/    # SSL сертификаты/g' "$NGINX_CONF"
sed -i.bak 's/^#     ssl_certificate/    ssl_certificate/g' "$NGINX_CONF"
sed -i.bak 's/^#     ssl_certificate_key/    ssl_certificate_key/g' "$NGINX_CONF"
sed -i.bak 's/^#     $/ /g' "$NGINX_CONF"
sed -i.bak 's/^#     # SSL настройки$/    # SSL настройки/g' "$NGINX_CONF"
sed -i.bak 's/^#     ssl_protocols/    ssl_protocols/g' "$NGINX_CONF"
sed -i.bak 's/^#     ssl_ciphers/    ssl_ciphers/g' "$NGINX_CONF"
sed -i.bak 's/^#     ssl_prefer_server_ciphers/    ssl_prefer_server_ciphers/g' "$NGINX_CONF"
sed -i.bak 's/^#     ssl_session_cache/    ssl_session_cache/g' "$NGINX_CONF"
sed -i.bak 's/^#     ssl_session_timeout/    ssl_session_timeout/g' "$NGINX_CONF"
sed -i.bak 's/^#     # Gzip compression$/    # Gzip compression/g' "$NGINX_CONF"
sed -i.bak 's/^#     gzip on;$/    gzip on;/g' "$NGINX_CONF"
sed -i.bak 's/^#     gzip_vary on;$/    gzip_vary on;/g' "$NGINX_CONF"
sed -i.bak 's/^#     gzip_min_length/    gzip_min_length/g' "$NGINX_CONF"
sed -i.bak 's/^#     gzip_types/    gzip_types/g' "$NGINX_CONF"
sed -i.bak 's/^#     # Security headers$/    # Security headers/g' "$NGINX_CONF"
sed -i.bak 's/^#     add_header X-Frame-Options/    add_header X-Frame-Options/g' "$NGINX_CONF"
sed -i.bak 's/^#     add_header X-Content-Type-Options/    add_header X-Content-Type-Options/g' "$NGINX_CONF"
sed -i.bak 's/^#     add_header X-XSS-Protection/    add_header X-XSS-Protection/g' "$NGINX_CONF"
sed -i.bak 's/^#     add_header Strict-Transport-Security/    add_header Strict-Transport-Security/g' "$NGINX_CONF"
sed -i.bak 's/^#     # Проксирование API запросов к backend$/    # Проксирование API запросов к backend/g' "$NGINX_CONF"
sed -i.bak 's/^#     location \/api {$/    location \/api {/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_pass/        proxy_pass/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_http_version/        proxy_http_version/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_set_header/        proxy_set_header/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_cache_bypass/        proxy_cache_bypass/g' "$NGINX_CONF"
sed -i.bak 's/^#         $/ /g' "$NGINX_CONF"
sed -i.bak 's/^#         # Увеличиваем таймауты для долгих запросов$/        # Увеличиваем таймауты для долгих запросов/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_connect_timeout/        proxy_connect_timeout/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_send_timeout/        proxy_send_timeout/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_read_timeout/        proxy_read_timeout/g' "$NGINX_CONF"
sed -i.bak 's/^#     }$/    }/g' "$NGINX_CONF"
sed -i.bak 's/^#     # Статические файлы frontend (включая assets)$/    # Статические файлы frontend (включая assets)/g' "$NGINX_CONF"
sed -i.bak 's/^#     location \/assets {$/    location \/assets {/g' "$NGINX_CONF"
sed -i.bak 's/^#         try_files/        try_files/g' "$NGINX_CONF"
sed -i.bak 's/^#     }$/    }/g' "$NGINX_CONF"
sed -i.bak 's/^#     # Проксирование статических файлов backend$/    # Проксирование статических файлов backend/g' "$NGINX_CONF"
sed -i.bak 's/^#     location @backend_assets {$/    location @backend_assets {/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_pass/        proxy_pass/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_http_version/        proxy_http_version/g' "$NGINX_CONF"
sed -i.bak 's/^#         proxy_set_header/        proxy_set_header/g' "$NGINX_CONF"
sed -i.bak 's/^#     }$/    }/g' "$NGINX_CONF"
sed -i.bak 's/^#     # Статические файлы frontend$/    # Статические файлы frontend/g' "$NGINX_CONF"
sed -i.bak 's/^#     location \/ {$/    location \/ {/g' "$NGINX_CONF"
sed -i.bak 's/^#         try_files/        try_files/g' "$NGINX_CONF"
sed -i.bak 's/^#         $/ /g' "$NGINX_CONF"
sed -i.bak 's/^#         # Кэширование статических ресурсов$/        # Кэширование статических ресурсов/g' "$NGINX_CONF"
sed -i.bak 's/^#         location ~\*/        location ~\*/g' "$NGINX_CONF"
sed -i.bak 's/^#             expires/            expires/g' "$NGINX_CONF"
sed -i.bak 's/^#             add_header Cache-Control/            add_header Cache-Control/g' "$NGINX_CONF"
sed -i.bak 's/^#         }$/        }/g' "$NGINX_CONF"
sed -i.bak 's/^#     }$/    }/g' "$NGINX_CONF"
sed -i.bak 's/^#     # Health check endpoint$/    # Health check endpoint/g' "$NGINX_CONF"
sed -i.bak 's/^#     location \/health {$/    location \/health {/g' "$NGINX_CONF"
sed -i.bak 's/^#         access_log off;$/        access_log off;/g' "$NGINX_CONF"
sed -i.bak 's/^#         return 200/        return 200/g' "$NGINX_CONF"
sed -i.bak 's/^#         add_header Content-Type/        add_header Content-Type/g' "$NGINX_CONF"
sed -i.bak 's/^#     }$/    }/g' "$NGINX_CONF"
sed -i.bak 's/^# }$/}/g' "$NGINX_CONF"

# Включаем редирект с HTTP на HTTPS
sed -i.bak 's/^    # Редирект на HTTPS (раскомментируйте, если SSL настроен)$/    # Редирект на HTTPS/g' "$NGINX_CONF"
sed -i.bak 's/^    # location \/ {$/    location \/ {/g' "$NGINX_CONF"
sed -i.bak 's/^    #     return 301 https:\/\/\$host\$request_uri;$/        return 301 https:\/\/$host$request_uri;/g' "$NGINX_CONF"
sed -i.bak 's/^    # }$/    }/g' "$NGINX_CONF"

# Закомментируем временную HTTP конфигурацию (кроме ACME challenge)
# Это нужно сделать вручную, так как sed не очень хорошо работает с многострочными блоками

rm -f "$NGINX_CONF.bak"

echo "✅ HTTPS включен в конфигурации Nginx"
echo ""
echo "⚠️  ВАЖНО: Проверьте файл $NGINX_CONF вручную"
echo "   Закомментируйте блоки с 'Временная конфигурация для работы без SSL'"
echo "   Оставьте только ACME challenge и редирект на HTTPS"
echo ""
echo "📋 Следующие шаги:"
echo "1. Проверьте и отредактируйте $NGINX_CONF"
echo "2. Обновите .env: ENABLE_SSL=true"
echo "3. Пересоберите frontend: docker-compose up -d --build frontend"

