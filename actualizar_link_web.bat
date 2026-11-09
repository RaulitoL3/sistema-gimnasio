@echo off
chcp 65001 >nul
title Publicar Actualizacion al Link Web del Gimnasio
cd /d "%~dp0"
echo =========================================================
echo   SUBIENDO SISTEMA A GITHUB (RaulitoL3/sistema-gimnasio)
echo =========================================================
echo.

git add .
git commit -m "Actualizacion del sistema de gimnasio" 2>nul
git branch -M main
git push -u origin main

echo.
echo =========================================================
echo   PROCESO COMPLETADO!
echo   Ahora activa GitHub Pages en:
echo   https://github.com/RaulitoL3/sistema-gimnasio/settings/pages
echo =========================================================
pause
