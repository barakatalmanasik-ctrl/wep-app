@echo off
chcp 65001 >nul 2>&1
title Building Barakat Al-Manasek
cd /d "%~dp0"

echo.
echo ========================================
echo   Building Barakat Al-Manasek Desktop
echo ========================================
echo.

set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\node;%PATH%"
set "CSC_IDENTITY_AUTO_DISCOVERY=false"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    call npx electron approve-scripts electron
)

echo.
echo [1/2] Building portable EXE...
call npx electron-builder --win portable
if %errorlevel% neq 0 (
    echo WARNING: Portable build failed
)

echo.
echo [2/2] Building installer...
call npx electron-builder --win nsis
if %errorlevel% neq 0 (
    echo WARNING: Installer build failed
)

echo.
echo ========================================
echo   Build complete!
echo   Output: electron-app\dist\
echo ========================================
echo.
pause
