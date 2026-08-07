"""شاشة كشف الحساب"""

import os
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QLineEdit, QDateEdit, QComboBox,
    QTableView, QFrame, QMessageBox, QHeaderView,
    QAbstractItemView
)
from PySide6.QtCore import Qt, QDate, Signal
from PySide6.QtGui import QFont, QStandardItemModel, QStandardItem

from barakat_account.services import TransactionService, SettingsService
from barakat_account.utils.helpers import format_currency, get_today, get_reports_dir, ensure_dir


class StatementView(QWidget):
    """عرض كشف الحساب"""

    transaction_modified = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build_ui()
        self._load_data()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(0, 0, 0, 0)

        # شريط البحث والفلترة
        search_frame = QFrame()
        search_frame.setObjectName("searchBar")
        search_layout = QHBoxLayout(search_frame)
        search_layout.setSpacing(8)

        # البحث بالكلمة
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("بحث في الملاحظات...")
        self.search_input.setMinimumHeight(38)
        self.search_input.textChanged.connect(self._apply_filters)
        search_layout.addWidget(self.search_input)

        # البحث بالتاريخ
        self.date_filter = QDateEdit()
        self.date_filter.setCalendarPopup(True)
        self.date_filter.setDate(QDate.fromString(get_today(), "yyyy-MM-dd"))
        self.date_filter.setDisplayFormat("yyyy-MM-dd")
        self.date_filter.setMinimumHeight(38)
        self.date_filter.setDateChanged.connect(self._apply_filters)
        search_layout.addWidget(self.date_filter)

        # زر مسح التاريخ
        clear_date_btn = QPushButton("×")
        clear_date_btn.setFixedSize(38, 38)
        clear_date_btn.setCursor(Qt.PointingHandCursor)
        clear_date_btn.setStyleSheet("font-size: 18px; font-weight: bold; border-radius: 19px;")
        clear_date_btn.clicked.connect(self._clear_date_filter)
        search_layout.addWidget(clear_date_btn)

        # الفلترة حسب النوع
        self.filter_combo = QComboBox()
        self.filter_combo.addItems(["الكل", "تعزيز", "قطع"])
        self.filter_combo.setMinimumHeight(38)
        self.filter_combo.currentTextChanged.connect(self._apply_filters)
        search_layout.addWidget(self.filter_combo)

        layout.addWidget(search_frame)

        # أزرار التصدير
        export_layout = QHBoxLayout()
        export_layout.setSpacing(8)

        export_excel_btn = QPushButton("📊 تصدير إلى Excel")
        export_excel_btn.setObjectName("exportBtn")
        export_excel_btn.setCursor(Qt.PointingHandCursor)
        export_excel_btn.clicked.connect(self._export_excel)
        export_layout.addWidget(export_excel_btn)

        export_pdf_btn = QPushButton("📄 تصدير إلى PDF")
        export_pdf_btn.setObjectName("exportBtn")
        export_pdf_btn.setCursor(Qt.PointingHandCursor)
        export_pdf_btn.clicked.connect(self._export_pdf)
        export_layout.addWidget(export_pdf_btn)

        export_layout.addStretch()
        layout.addLayout(export_layout)

        # جدول البيانات
        self.table = QTableView()
        self.table.setAlternatingRowColors(True)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setShowGrid(False)

        self.model = QStandardItemModel()
        self.model.setHorizontalHeaderLabels([
            "رقم", "التاريخ", "نوع الحركة", "المبلغ",
            "الرصيد بعد العملية", "الملاحظات", "إجراءات"
        ])
        self.table.setModel(self.model)
        layout.addWidget(self.table)

        # أزرار تعديل وحذف
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(8)

        edit_btn = QPushButton("تعديل المحدد")
        edit_btn.setObjectName("editBtn")
        edit_btn.setCursor(Qt.PointingHandCursor)
        edit_btn.clicked.connect(self._edit_selected)
        btn_layout.addWidget(edit_btn)

        delete_btn = QPushButton("حذف المحدد")
        delete_btn.setObjectName("deleteBtn")
        delete_btn.setCursor(Qt.PointingHandCursor)
        delete_btn.clicked.connect(self._delete_selected)
        btn_layout.addWidget(delete_btn)

        btn_layout.addStretch()
        layout.addLayout(btn_layout)

    def _load_data(self, transactions=None):
        """تحميل البيانات في الجدول"""
        if transactions is None:
            transactions = TransactionService.get_all()

        self.model.removeRows(0, self.model.rowCount())
        settings = SettingsService.get()
        currency = settings.get("currency", "IQD")

        for trans in transactions:
            row = []
            row.append(QStandardItem(str(trans.get("id", ""))))
            row.append(QStandardItem(trans.get("date", "")))

            type_item = QStandardItem(trans.get("type", ""))
            if trans.get("type") == "تعزيز":
                type_item.setForeground(Qt.darkGreen)
            else:
                type_item.setForeground(Qt.darkRed)
            row.append(type_item)

            amount_item = QStandardItem(format_currency(trans.get("amount", 0), currency))
            if trans.get("type") == "تعزيز":
                amount_item.setForeground(Qt.darkGreen)
            else:
                amount_item.setForeground(Qt.darkRed)
            row.append(amount_item)

            row.append(QStandardItem(format_currency(trans.get("balance_after", 0), currency)))
            row.append(QStandardItem(trans.get("notes", "")))

            # زر الإجراءات
            action_item = QStandardItem("تعديل | حذف")
            action_item.setTextAlignment(Qt.AlignCenter)
            row.append(action_item)

            for item in row:
                item.setEditable(False)

            self.model.appendRow(row)

        # عرض أعمدة
        self.table.setColumnWidth(0, 60)
        self.table.setColumnWidth(1, 110)
        self.table.setColumnWidth(2, 100)
        self.table.setColumnWidth(3, 140)
        self.table.setColumnWidth(4, 160)
        self.table.setColumnWidth(5, 200)

    def _apply_filters(self):
        """تطبيق الفلاتر"""
        search = self.search_input.text().strip()
        date_str = self.date_filter.date().toString("yyyy-MM-dd")
        filter_type = self.filter_combo.currentText()

        # إذا لم يكن هناك تاريخ محدد فارغ، لا نفلتر بالتاريخ
        has_date = self.date_filter.date() != QDate.currentDate()

        transactions = TransactionService.get_filtered(
            filter_type=filter_type,
            search_text=search,
            search_date=date_str if has_date else ""
        )
        self._load_data(transactions)

    def _clear_date_filter(self):
        """مسح فلتر التاريخ"""
        self.date_filter.setDate(QDate.currentDate())
        self._apply_filters()

    def _get_selected_id(self) -> int:
        """الحصول على معرف الحركة المحددة"""
        selected = self.table.selectionModel().selectedRows()
        if not selected:
            return -1
        row = selected[0].row()
        return int(self.model.item(row, 0).text())

    def _get_selected_row_data(self) -> dict:
        """الحصول على بيانات الحركة المحددة"""
        selected = self.table.selectionModel().selectedRows()
        if not selected:
            return {}
        row = selected[0].row()
        return {
            "id": int(self.model.item(row, 0).text()),
            "date": self.model.item(row, 1).text(),
            "type": self.model.item(row, 2).text(),
            "amount": float(self.model.item(row, 3).text().replace(",", "").split()[0]),
            "balance_after": float(self.model.item(row, 4).text().replace(",", "").split()[0]),
            "notes": self.model.item(row, 5).text()
        }

    def _edit_selected(self):
        """تعديل الحركة المحددة"""
        data = self._get_selected_row_data()
        if not data:
            QMessageBox.information(self, "تنبيه", "يرجى تحديد حركة للتعديل")
            return

        from barakat_account.dialogs.transaction_dialog import TransactionDialog
        dialog = TransactionDialog(
            self, trans_type=data["type"], transaction=data
        )
        dialog.transaction_added.connect(self._on_modified)
        dialog.exec()

    def _delete_selected(self):
        """حذف الحركة المحددة"""
        data = self._get_selected_row_data()
        if not data:
            QMessageBox.information(self, "تنبيه", "يرجى تحديد حركة للحذف")
            return

        reply = QMessageBox.question(
            self, "تأكيد الحذف",
            "هل أنت متأكد من حذف هذه الحركة؟\nلا يمكن التراجع عن هذا الإجراء.",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            success, message = TransactionService.delete_transaction(data["id"])
            if success:
                QMessageBox.information(self, "نجاح", message)
                self._on_modified()

    def _on_modified(self):
        """عند تعديل أو حذف حركة"""
        self._apply_filters()
        self.transaction_modified.emit()

    def _export_excel(self):
        """تصدير إلى Excel"""
        from PySide6.QtWidgets import QFileDialog
        from barakat_account.reports.export import export_to_excel
        from barakat_account.services import SettingsService

        reports_dir = get_reports_dir()
        ensure_dir(reports_dir)

        filepath, _ = QFileDialog.getSaveFileName(
            self, "تصدير إلى Excel",
            os.path.join(reports_dir, f"كشف_حساب_{get_today()}.xlsx"),
            "Excel Files (*.xlsx)"
        )
        if not filepath:
            return

        transactions = TransactionService.get_all()
        settings = SettingsService.get()

        success, message = export_to_excel(
            transactions, filepath,
            settings.get("company_name", ""),
            settings.get("currency", "IQD")
        )

        if success:
            QMessageBox.information(self, "نجاح", message)
        else:
            QMessageBox.warning(self, "خطأ", message)

    def _export_pdf(self):
        """تصدير إلى PDF"""
        from PySide6.QtWidgets import QFileDialog
        from barakat_account.reports.export import export_to_pdf
        from barakat_account.services import SettingsService

        reports_dir = get_reports_dir()
        ensure_dir(reports_dir)

        filepath, _ = QFileDialog.getSaveFileName(
            self, "تصدير إلى PDF",
            os.path.join(reports_dir, f"كشف_حساب_{get_today()}.pdf"),
            "PDF Files (*.pdf)"
        )
        if not filepath:
            return

        transactions = TransactionService.get_all()
        settings = SettingsService.get()

        success, message = export_to_pdf(
            transactions, filepath,
            settings.get("company_name", ""),
            settings.get("currency", "IQD")
        )

        if success:
            QMessageBox.information(self, "نجاح", message)
        else:
            QMessageBox.warning(self, "خطأ", message)

    def refresh(self):
        """تحديث البيانات"""
        self._apply_filters()
