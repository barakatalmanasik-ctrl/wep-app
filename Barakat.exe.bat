@echo off
chcp 65001 >nul 2>&1
title Barakat Al-Manasek
cd /d "%~dp0electron-app"

:: Refresh PATH
set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\node;%PATH%"

:: Check for packaged EXE first
if exist "dist\win-unpacked\Barakat Al-Manasek.exe" (
    start "" "dist\win-unpacked\Barakat Al-Manasek.exe"
    exit /b 0
)
if exist "dist\Barakat.exe" (
    start "" "dist\Barakat.exe"
    exit /b 0
)

:: Fallback: run in dev mode
where electron >nul 2>&1
if %errorlevel% neq 0 (
    where npx >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: Neither packaged app nor Node.js found.
        pause
        exit /b 1
    )
    npx electron .
) else (
    electron .
)
