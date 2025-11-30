@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   TESTE DE URL DA VERCEL
echo ========================================
echo.
echo Este script testa se a URL está funcionando.
echo.

set /p URL="Cole a URL da Vercel aqui (sem barra no final): "

echo.
echo ========================================
echo Testando: %URL%/webhook-secreto-aleatorio
echo ========================================
echo.

curl "%URL%/webhook-secreto-aleatorio"

echo.
echo.
echo ========================================
echo RESULTADO:
echo ========================================
echo.
echo Se apareceu: {"error":"Method Not Allowed"}
echo   ✅ CORRETO! A URL está funcionando!
echo.
echo Se apareceu: 404 ou erro
echo   ❌ ERRADO! Essa não é a URL correta.
echo   Tente outra URL da Vercel.
echo.
echo ========================================
pause

