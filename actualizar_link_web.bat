@echo off
chcp 65001 >nul
title Publicar Actualizacion al Link Web del Gimnasio
cd /d "%~dp0"
echo =========================================================
echo   SUBIENDO ACTUALIZACION A GITHUB PAGES...
echo =========================================================
echo.

powershell -NoProfile -Command "$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); (Get-Content index.html -Raw) -replace '\.js\?v=\d+', (\".js?v=\" + $ts) | Set-Content index.html -Encoding UTF8"

git add .
git commit -m "Actualizacion del sistema de gimnasio"
git push origin main

echo.
echo =========================================================
echo   LISTO! En ~30 segundos el link web estara actualizado
echo   sin problemas de cache:
echo   https://raulitol3.github.io/sistema-gimnasio/
echo =========================================================
pause
