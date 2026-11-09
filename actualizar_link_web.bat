@echo off
chcp 65001 >nul
title Publicar Actualizacion al Link Web del Gimnasio
echo =========================================================
echo   PUBLICANDO CAMBIOS AL LINK DE INTERNET...
echo =========================================================
echo.

git add .
git commit -m "Actualizacion del sistema de gimnasio"
git push

echo.
echo =========================================================
echo   LISTO! En 15 segundos el link web de tu papa y
echo   las recepcionistas estara actualizado automaticamente.
echo =========================================================
pause
