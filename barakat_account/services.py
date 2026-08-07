"""خدمات الأعمال - Business Logic Services"""

from typing import List, Optional
from datetime import date

from barakat_account import database as db
from barakat_account.models import Transaction, Settings


class TransactionService:
    """خدمة إدارة الحركات المالية"""

    @staticmethod
    def add_transaction(trans_type: str, amount: float, notes: str = "",
                        trans_date: str = "") -> tuple:
        """إضافة حركة جديدة - (نجاح, رسالة)"""
        if amount <= 0:
            return False, "يرجى إدخال مبلغ صحيح"

        if not trans_date:
            trans_date = date.today().strftime("%Y-%m-%d")

        # حساب الرصيد بعد العملية
        current_balance = db.get_current_balance()

        if trans_type == "قطع":
            if amount > current_balance:
                return False, "الرصيد غير كافٍ"
            new_balance = current_balance - amount
        else:
            new_balance = current_balance + amount

        transaction = (trans_date, trans_type, amount, new_balance, notes)
        db.insert_transaction(transaction)

        return True, "تم حفظ الحركة بنجاح"

    @staticmethod
    def edit_transaction(trans_id: int, trans_date: str, trans_type: str,
                         amount: float, notes: str) -> tuple:
        """تعديل حركة - (نجاح, رسالة)"""
        if amount <= 0:
            return False, "يرجى إدخال مبلغ صحيح"

        transaction = (trans_date, trans_type, amount, 0, notes)
        db.update_transaction(trans_id, transaction)
        db.recalculate_balances()

        return True, "تم تعديل الحركة بنجاح"

    @staticmethod
    def delete_transaction(trans_id: int) -> tuple:
        """حذف حركة - (نجاح, رسالة)"""
        db.delete_transaction(trans_id)
        db.recalculate_balances()
        return True, "تم حذف الحركة بنجاح"

    @staticmethod
    def get_all() -> List[dict]:
        """جلب جميع الحركات"""
        return db.get_all_transactions()

    @staticmethod
    def get_filtered(filter_type: str = "الكل", search_text: str = "",
                     search_date: str = "") -> List[dict]:
        """جلب الحركات مع فلترة"""
        return db.get_filtered_transactions(filter_type, search_text, search_date)

    @staticmethod
    def get_summary() -> dict:
        """الحصول على ملخص"""
        return db.get_summary()


class SettingsService:
    """خدمة الإعدادات"""

    @staticmethod
    def get() -> dict:
        return db.get_settings()

    @staticmethod
    def update(company_name: str, currency: str, theme_color: str,
               reports_folder: str):
        db.update_settings((company_name, currency, theme_color, reports_folder))
