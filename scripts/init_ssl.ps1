# Скрипт для получения SSL сертификата через Let's Encrypt с использованием nip.io
# Использование: .\scripts\init_ssl.ps1 <IP_ADDRESS>
# Пример: .\scripts\init_ssl.ps1 158.160.165.223

param(
    [Parameter(Mandatory=$true)]
    [string]$IP_ADDRESS
)

$DOMAIN = "${IP_ADDRESS}.nip.io"
$EMAIL = "admin@${DOMAIN}"  # Let's Encrypt требует email, но можно использовать любой

Write-Host "🔐 Настройка SSL для домена: ${DOMAIN}" -ForegroundColor Cyan
Write-Host "📧 Email для Let's Encrypt: ${EMAIL}" -ForegroundColor Cyan

# Проверяем, что контейнеры запущены
$frontendRunning = docker ps | Select-String "copilot_frontend"
if (-not $frontendRunning) {
    Write-Host "❌ Ошибка: Контейнер copilot_frontend не запущен" -ForegroundColor Red
    Write-Host "Запустите сначала: docker-compose up -d frontend" -ForegroundColor Yellow
    exit 1
}

# Создаем директорию для ACME challenge
docker exec copilot_frontend mkdir -p /var/www/certbot

# Получаем сертификат
Write-Host "📝 Запрос сертификата у Let's Encrypt..." -ForegroundColor Yellow
docker run --rm `
    -v copilot_app_certbot_certs:/etc/letsencrypt `
    -v copilot_app_certbot_www:/var/www/certbot `
    certbot/certbot certonly `
    --webroot `
    --webroot-path=/var/www/certbot `
    --email "${EMAIL}" `
    --agree-tos `
    --no-eff-email `
    --force-renewal `
    -d "${DOMAIN}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Сертификат успешно получен!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Следующие шаги:" -ForegroundColor Cyan
    Write-Host "1. Обновите .env файл:" -ForegroundColor Yellow
    Write-Host "   APP_DOMAIN=${DOMAIN}"
    Write-Host "   APP_URL=https://${DOMAIN}"
    Write-Host "   ENABLE_SSL=true"
    Write-Host ""
    Write-Host "2. Раскомментируйте HTTPS блок в frontend/nginx.conf.template"
    Write-Host ""
    Write-Host "3. Закомментируйте HTTP блок (кроме ACME challenge) в frontend/nginx.conf.template"
    Write-Host ""
    Write-Host "4. Пересоберите и перезапустите frontend:"
    Write-Host "   docker-compose up -d --build frontend"
    Write-Host ""
    Write-Host "5. Проверьте доступность: https://${DOMAIN}" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка при получении сертификата" -ForegroundColor Red
    exit 1
}

