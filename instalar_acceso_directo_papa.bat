@echo off
chcp 65001 >nul
title Instalador de Acceso Directo - Sistema Gimnasio
set "TARGET_BAT=%~dp0iniciar_sistema.bat"
set "WORK_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $desktop = [Environment]::GetFolderPath('Desktop'); ^
   $s = $ws.CreateShortcut((Join-Path $desktop 'Sistema Gimnasio Artes Marciales.lnk')); ^
   $s.TargetPath = '%TARGET_BAT%'; ^
   $s.WorkingDirectory = '%WORK_DIR%'; ^
   $s.IconLocation = 'shell32.dll,43'; ^
   $s.Description = 'Abrir Sistema de Gimnasio de Artes Marciales'; ^
   $s.Save()"

echo.
echo =========================================================
echo   ACCESO DIRECTO CREADO EN EL ESCRITORIO CON EXITO!
echo   Nombre: "Sistema Gimnasio Artes Marciales"
echo =========================================================
echo.
pause
