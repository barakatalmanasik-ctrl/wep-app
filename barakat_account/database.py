"""إدارة قاعدة البيانات - Database Management"""

import sqlite3
import os
import sys
from typing import List, Tuple

DB_NAME = "account_data.db"


def _get_base_dir() -> str:
    """الحصول على المجلد الذي يحتوي على الملف التنفيذي
    يعمل سواء كان تشغيل من Python أو من ملف EXE مجمّع"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def get_db_path() -> str:
    """الحصول على مسار قاعدة البيانات"""
    return os.path.join(_get_base_dir(), DB_NAME)


def ensure_directories():
    """إنشاء المجلدات المطلوبة إذا لم تكن موجودة"""
    base = _get_base_dir()
    for folder in ("backups", "reports", "assets"):
        path = os.path.join(base, folder)
        if not os.path.exists(path):
            os.makedirs(path)


def get_connection() -> sqlite3.Connection:
    """الحصول على اتصال بقاعدة البيانات"""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def initialize_database():
    """إنشاء قاعدة البيانات والجداول عند أول تشغيل"""
    ensure_directories()

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('تعزيز', 'قطع')),
            amount REAL NOT NULL CHECK(amount > 0),
            balance_after REAL NOT NULL DEFAULT 0,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            company_name TEXT DEFAULT 'بركات المناسك للسفر والسياحة',
            currency TEXT DEFAULT 'IQD',
            theme_color TEXT DEFAULT '#1a73e8',
            reports_folder TEXT DEFAULT ''
        )
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO settings (id, company_name, currency, theme_color, reports_folder)
        VALUES (1, 'بركات المناسك للسفر والسياحة', 'IQD', '#1a73e8', '')
    """)

    conn.commit()
    conn.close()


# ── عمليات الحركات ──

def insert_transaction(transaction_data: Tuple) -> int:
    """إدراج حركة جديدة وإرجاع المعرف"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO transactions (date, type, amount, balance_after, notes) VALUES (?, ?, ?, ?, ?)",
        transaction_data
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_all_transactions() -> List[dict]:
    """جلب جميع الحركات مرتبة من الأحدث"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions ORDER BY date DESC, id DESC")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_filtered_transactions(
    filter_type: str = "الكل",
    search_text: str = "",
    search_date: str = ""
) -> List[dict]:
    """جلب الحركات مع فلترة"""
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM transactions WHERE 1=1"
    params: list = []

    if filter_type != "الكل":
        query += " AND type = ?"
        params.append(filter_type)

    if search_text:
        query += " AND notes LIKE ?"
        params.append(f"%{search_text}%")

    if search_date:
        query += " AND date = ?"
        params.append(search_date)

    query += " ORDER BY date DESC, id DESC"

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def update_transaction(transaction_id: int, transaction_data: Tuple):
    """تحديث حركة"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE transactions SET date=?, type=?, amount=?, balance_after=?, notes=? WHERE id=?",
        (*transaction_data, transaction_id)
    )
    conn.commit()
    conn.close()


def delete_transaction(transaction_id: int):
    """حذف حركة"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE id=?", (transaction_id,))
    conn.commit()
    conn.close()


def recalculate_balances():
    """إعادة حساب جميع الأرصدة بعد تعديل أو حذف"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, type, amount FROM transactions ORDER BY date ASC, id ASC")
    rows = cursor.fetchall()

    balance = 0.0
    for row in rows:
        if row["type"] == "تعزيز":
            balance += row["amount"]
        else:
            balance -= row["amount"]
        cursor.execute("UPDATE transactions SET balance_after=? WHERE id=?", (balance, row["id"]))

    conn.commit()
    conn.close()
    return balance


def get_current_balance() -> float:
    """الحصول على الرصيد الحالي"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT balance_after FROM transactions ORDER BY date DESC, id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return row["balance_after"] if row else 0.0


def get_summary() -> dict:
    """الحصول على ملخص الحسابات"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='تعزيز'")
    total_increase = cursor.fetchone()["total"]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='قطع'")
    total_decrease = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as count FROM transactions")
    total_count = cursor.fetchone()["count"]

    cursor.execute("SELECT balance_after FROM transactions ORDER BY date DESC, id DESC LIMIT 1")
    row = cursor.fetchone()
    current_balance = row["balance_after"] if row else 0.0

    conn.close()
    return {
        "current_balance": current_balance,
        "total_increase": total_increase,
        "total_decrease": total_decrease,
        "total_count": total_count
    }


# ── الإعدادات ──

def get_settings() -> dict:
    """جلب الإعدادات"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM settings WHERE id=1")
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {
        "company_name": "بركات المناسك للسفر والسياحة",
        "currency": "IQD",
        "theme_color": "#1a73e8",
        "reports_folder": ""
    }


def update_settings(settings_data: Tuple):
    """تحديث الإعدادات"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE settings SET company_name=?, currency=?, theme_color=?, reports_folder=? WHERE id=1",
        settings_data
    )
    conn.commit()
    conn.close()


# ── النسخ الاحتياطي ──

def backup_database(backup_path: str):
    """إنشاء نسخة احتياطية"""
    import shutil
    shutil.copy2(get_db_path(), backup_path)


def restore_database(backup_path: str):
    """استعادة نسخة احتياطية"""
    import shutil
    shutil.copy2(backup_path, get_db_path())
