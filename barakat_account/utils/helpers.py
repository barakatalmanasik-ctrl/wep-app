"""المساعدات والأدوات المساعدة"""

import os
import sys
from datetime import date


def _get_base_dir() -> str:
    """الحصول على مجلد التطبيق الأساسي
    يعمل سواء كان تشغيل من Python أو من ملف EXE"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def format_currency(amount: float, currency: str = "IQD") -> str:
    """تنسيق المبلغ بالعملة"""
    if currency == "IQD":
        return f"{amount:,.0f} {currency}"
    return f"{amount:,.2f} {currency}"


def get_app_dir() -> str:
    """الحصول على مسار مجلد التطبيق"""
    return _get_base_dir()


def get_assets_dir() -> str:
    """الحصول على مسار مجلد الأصول"""
    return os.path.join(_get_base_dir(), "assets")


def get_reports_dir() -> str:
    """الحصول على مسار مجلد التقارير"""
    return os.path.join(_get_base_dir(), "reports")


def get_backups_dir() -> str:
    """الحصول على مسار مجلد النسخ الاحتياطي"""
    return os.path.join(_get_base_dir(), "backups")


def ensure_dir(path: str):
    """إنشاء المجلد إذا لم يكن موجوداً"""
    if not os.path.exists(path):
        os.makedirs(path)


def get_today() -> str:
    """الحصول على تاريخ اليوم"""
    return date.today().strftime("%Y-%m-%d")
