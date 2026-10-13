@echo off
setlocal
cd /d "%~dp0"
title ForgeLabs BeatScope - Telepites sajat felhasznalonak
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-Windows.ps1" -Install
if errorlevel 1 (
  echo.
  echo A build vagy a telepites sikertelen.
  echo Ellenorizd, hogy a csomag a sajat Dokumentumok vagy Letoltesek mappadba lett-e kicsomagolva.
  pause
  exit /b 1
)
echo.
echo ForgeLabs BeatScope telepitese kesz - sajat felhasznaloi mappaba.
pause