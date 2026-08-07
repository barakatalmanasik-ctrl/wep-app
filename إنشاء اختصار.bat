@echo off
chcp 65001 >nul 2>&1
title Create Desktop Shortcut
echo.
echo Creating desktop shortcut...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0pure-app\create_shortcut.ps1"
echo.
timeout /t 3 >nul 2>&1
