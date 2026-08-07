@echo off
chcp 65001 >nul
title تشغيل نظام إدارة الرصيد

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     نظام إدارة الرصيد - بركات المناسك               ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ── التحقق من Node.js ──
echo [1/4] التحقق من Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    [!] Node.js غير مثبت
    echo    يرجى تثبيته من: https://nodejs.org
    pause
    exit /b 1
)
echo    ✓ Node.js موجود
echo.

:: ── تثبيت المتطلبات ──
echo [2/4] تثبيت المتطلبات...
call npm install
echo.

echo [3/4] تثبيت مكتبات Backend...
cd backend
call npm install
call npx prisma generate
call npx prisma db push
cd ..

echo.
echo [4/4] تثبيت مكتبات Frontend...
cd frontend
call npm install
cd ..

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║                تم التثبيت بنجاح!                    ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  جارٍ تشغيل النظام...
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:5173
echo.

call npm run dev
