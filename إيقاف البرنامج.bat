@echo off
chcp 65001 >nul 2>&1
title Stop Application
set "APP_DIR=%~dp0pure-app"

echo.
echo Stopping application...

:: Kill all PowerShell processes running server.ps1
taskkill /F /FI "WINDOWTITLE eq *" /FI "IMAGENAME eq powershell.exe" >nul 2>&1

:: Also kill by PID file
if exist "%APP_DIR%\server.pid" (
    set /p PID=<"%APP_DIR%\server.pid"
    if defined PID (
        taskkill /F /PID !PID! >nul 2>&1
    )
)

:: Kill any remaining server PowerShell processes
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq powershell.exe" /FO LIST 2^>nul ^| findstr "PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr "server.ps1" >nul 2>&1
    if not errorlevel 1 (
        taskkill /F /PID %%a >nul 2>&1
    )
)

:: Clean up
del "%APP_DIR%\server.port" >nul 2>&1
del "%APP_DIR%\server.pid" >nul 2>&1

echo Application stopped successfully.
echo.
timeout /t 2 >nul 2>&1
