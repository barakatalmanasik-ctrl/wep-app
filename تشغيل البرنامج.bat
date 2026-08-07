@echo off
chcp 65001 >nul 2>&1
title Barakat Al-Manasek
powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%~dp0pure-app\launcher.ps1" -BaseDir "%~dp0pure-app"
