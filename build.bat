@echo off
chcp 65001 >nul
title بناء نظام إدارة الرصيد - بركات المناسك

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     بناء ملف تنفيذي - نظام إدارة الرصيد           ║
echo  ║     بركات المناسك للسفر والسياحة                   ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ── التحقق من Python ──
echo [1/5] التحقق من Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo    [!] Python غير مثبت أو غير موجود في PATH
    echo    يرجى تثبيت Python 3.10+ من: https://www.python.org
    echo.
    pause
    exit /b 1
)
echo    ✓ Python موجود
echo.

:: ── تثبيت المتطلبات ──
echo [2/5] تثبيت المتطلبات...
pip install -r requirements.txt
pip install pyinstaller
if %errorlevel% neq 0 (
    echo.
    echo    [!] فشل تثبيت المتطلبات
    echo.
    pause
    exit /b 1
)
echo    ✓ تم تثبيت المتطلبات
echo.

:: ── تنظيف ملفات البناء السابقة ──
echo [3/5] تنظيف ملفات البناء السابقة...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
echo    ✓ تم التنظيف
echo.

:: ── بناء الملف التنفيذي ──
echo [4/5] بناء الملف التنفيذي (قد يستغرق 2-5 دقائق)...
echo.
pyinstaller --noconfirm --clean AccountManager.spec
if %errorlevel% neq 0 (
    echo.
    echo    [!] فشل البناء. تحقق من الأخطاء أعلاه.
    echo.
    pause
    exit /b 1
)
echo.
echo    ✓ تم بناء الملف التنفيذي بنجاح
echo.

:: ── إنشاء مجلد Release ──
echo [5/5] إنشاء مجلد Release...
if exist "Release" rmdir /s /q "Release"
mkdir "Release"
mkdir "Release\backups"
mkdir "Release\reports"
mkdir "Release\assets"

:: نسخ الملف التنفيذي
copy /y "dist\AccountManager.exe" "Release\AccountManager.exe" >nul

:: إنشاء ملف تشغيل بسيط
(
    echo @echo off
    echo chcp 65001 ^>nul
    echo title نظام إدارة الرصيد - بركات المناسك
    echo.
    echo echo  جارٍ تشغيل البرنامج...
    echo start "" "%%~dp0AccountManager.exe"
) > "Release\تشغيل البرنامج.bat"

:: تنظيف ملفات البناء المؤقتة
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"

echo    ✓ تم إنشاء مجلد Release
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║                تم البناء بنجاح!                     ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  المجلد:       Release\                             ║
echo  ║  الملف:        AccountManager.exe                   ║
echo  ║  المجلدات:     backups\  reports\  assets\          ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  يمكنك نسخ مجلد Release بالكامل إلى أي جهاز وتشغيله مباشرة.
echo.

:: فتح مجلد Release
explorer "Release"

pause
