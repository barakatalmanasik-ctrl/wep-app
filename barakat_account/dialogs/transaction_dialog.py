"""نافذة الحركة المالية - تعزيز أو قطع"""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QLineEdit, QDateEdit, QPushButton, QMessageBox,
    QFrame
)
from PySide6.QtCore import Qt, QDate, Signal
from PySide6.QtGui import QFont, QDoubleValidator

from barakat_account.services import TransactionService
from barakat_account.utils.helpers import get_today


class TransactionDialog(QDialog):
    """نافذة إضافة / تعديل حركة مالية"""

    transaction_added = Signal()

    def __init__(self, parent=None, trans_type: str = "تعزيز",
                 transaction: dict = None):
        super().__init__(parent)
        self.trans_type = trans_type
        self.transaction = transaction
        self.is_edit = transaction is not None

        self.setWindowTitle(
            "تعديل حركة" if self.is_edit
            else ("إضافة تعزيز" if trans_type == "تعزيز" else "إضافة قطع")
        )
        self.setMinimumWidth(450)
        self.setModal(True)
        self._build_ui()
        self._prefill()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(24, 24, 24, 24)

        # العنوان
        title = QLabel(
            "تعديل الحركة" if self.is_edit
            else ("إضافة تعزيز" if self.trans_type == "تعزيز" else "إضافة قطع")
        )
        title.setAlignment(Qt.AlignCenter)
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        color = "#2e7d32" if self.trans_type == "تعزيز" else "#c62828"
        title.setStyleSheet(f"color: {color}; margin-bottom: 8px;")
        layout.addWidget(title)

        # التاريخ
        date_label = QLabel("التاريخ:")
        date_label.setStyleSheet("font-weight: bold; color: #444;")
        layout.addWidget(date_label)

        self.date_edit = QDateEdit()
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDate(QDate.fromString(get_today(), "yyyy-MM-dd"))
        self.date_edit.setDisplayFormat("yyyy-MM-dd")
        self.date_edit.setMinimumHeight(40)
        layout.addWidget(self.date_edit)

        # المبلغ
        amount_label = QLabel("المبلغ:")
        amount_label.setStyleSheet("font-weight: bold; color: #444;")
        layout.addWidget(amount_label)

        self.amount_input = QLineEdit()
        self.amount_input.setPlaceholderText("أدخل المبلغ هنا...")
        self.amount_input.setMinimumHeight(40)
        self.amount_input.setValidator(QDoubleValidator(0, 999999999, 2))
        layout.addWidget(self.amount_input)

        # الملاحظات
        notes_label = QLabel("الملاحظات:")
        notes_label.setStyleSheet("font-weight: bold; color: #444;")
        layout.addWidget(notes_label)

        self.notes_input = QLineEdit()
        self.notes_input.setPlaceholderText("ملاحظات اختيارية...")
        self.notes_input.setMinimumHeight(40)
        layout.addWidget(self.notes_input)

        # أزرار الحفظ والإلغاء
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(12)

        cancel_btn = QPushButton("إلغاء")
        cancel_btn.setObjectName("cancelBtn")
        cancel_btn.setCursor(Qt.PointingHandCursor)
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        save_btn = QPushButton("حفظ")
        save_btn.setObjectName("saveBtn")
        save_btn.setCursor(Qt.PointingHandCursor)
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def _prefill(self):
        """تعبئة الحقول في حالة التعديل"""
        if self.transaction:
            self.date_edit.setDate(
                QDate.fromString(self.transaction["date"], "yyyy-MM-dd")
            )
            self.amount_input.setText(str(self.transaction["amount"]))
            self.notes_input.setText(self.transaction.get("notes", ""))

    def _save(self):
        """حفظ الحركة"""
        amount_text = self.amount_input.text().strip()
        if not amount_text:
            QMessageBox.warning(self, "تنبيه", "جميع الحقول مطلوبة")
            return

        try:
            amount = float(amount_text)
        except ValueError:
            QMessageBox.warning(self, "تنبيه", "يرجى إدخال مبلغ صحيح")
            return

        if amount <= 0:
            QMessageBox.warning(self, "تنبيه", "يرجى إدخال مبلغ صحيح")
            return

        trans_date = self.date_edit.date().toString("yyyy-MM-dd")
        notes = self.notes_input.text().strip()

        if self.is_edit:
            success, message = TransactionService.edit_transaction(
                self.transaction["id"], trans_date, self.trans_type,
                amount, notes
            )
        else:
            success, message = TransactionService.add_transaction(
                self.trans_type, amount, notes, trans_date
            )

        if success:
            QMessageBox.information(self, "نجاح", message)
            self.transaction_added.emit()
            self.accept()
        else:
            QMessageBox.warning(self, "تنبيه", message)
