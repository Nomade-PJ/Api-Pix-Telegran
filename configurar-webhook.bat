@echo off
echo.
echo ========================================
echo   CONFIGURAR WEBHOOK DO TELEGRAM
echo ========================================
echo.
echo Este script vai configurar o webhook do bot.
echo.

set /p TOKEN="Digite o TOKEN do bot (cole aqui): "
set /p URL="Digite a URL da Vercel (ex: https://api-pix-telegran.vercel.app): "

echo.
echo Configurando webhook...
echo URL: %URL%/webhook-secreto-aleatorio
echo.

curl -X POST "https://api.telegram.org/bot%TOKEN%/setWebhook?url=%URL%/webhook-secreto-aleatorio"

echo.
echo.
echo ========================================
echo   VERIFICANDO CONFIGURACAO
echo ========================================
echo.

curl "https://api.telegram.org/bot%TOKEN%/getWebhookInfo"

echo.
echo.
echo ========================================
echo Pronto! Teste enviando /start no Telegram
echo ========================================
echo.
pause

