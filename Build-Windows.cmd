@echo off
setlocal
cd /d "%~dp0"
title ForgeLabs BeatScope - Windows app keszito
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-Windows.ps1"
if errorlevel 1 (
  echo.
  echo A build sikertelen. A hibauzenetet nezd meg fent.
  pause
  exit /b 1
)
echo.
echo Az alkalmazas a dist mappaban talalhato.
start "" explorer.exe "%~dp0dist"
pause