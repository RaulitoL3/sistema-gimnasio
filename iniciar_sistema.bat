@echo off
title Sistema de Gimnasio de Artes Marciales
set "APP_PATH=%~dp0index.html"

if exist "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" "%APP_PATH%"
) else (
    start "" "%APP_PATH%"
)
exit
