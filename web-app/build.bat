@echo off
chcp 65001 >nul
title بناء الإصدار النهائي

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     بناء الإصدار النهائي                            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

echo [1/3] بناء Frontend...
cd frontend
call npm run build
cd ..

echo.
echo [2/3] نسخ الملفات...
if exist "Release" rmdir /s /q "Release"
mkdir "Release"
mkdir "Release\data"
mkdir "Release\backups"

copy /y "backend\prisma\schema.prisma" "Release\prisma\schema.prisma" >nul 2>&1
if not exist "Release\prisma" mkdir "Release\prisma"
copy /y "backend\prisma\schema.prisma" "Release\prisma\schema.prisma" >nul
copy /y "backend\package.json" "Release\package.json" >nul
copy /y "backend\tsconfig.json" "Release\tsconfig.json" >nul
xcopy /s /e /y "backend\src" "Release\src\" >nul
xcopy /s /e /y "frontend\dist" "Release\public\" >nul

echo.
echo [3/3] جاري التجهيز...
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  لتشغيل الإصدار النهائي:                            ║
echo  ║  cd Release                                         ║
echo  ║  npm install                                        ║
echo  ║  npx prisma generate                                ║
echo  ║  npx prisma db push                                 ║
echo  ║  npm start                                          ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

pause
