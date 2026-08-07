"""نافذة الإعدادات"""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QLineEdit, QPushButton, QMessageBox, QFrame,
    QColorDialog, QFileDialog
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QColor

from barakat_account.services import SettingsService


class SettingsDialog(QDialog):
    """نافذة الإعدادات"""

    settings_updated = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("الإعدادات")
        self.setMinimumWidth(500)
        self.setModal(True)
        self._build_ui()
        self._load_settings()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(24, 24, 24, 24)

        # العنوان
        title = QLabel("الإعدادات")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet("color: #333; margin-bottom: 8px;")
        layout.addWidget(title)

        # اسم الشركة
        name_label = QLabel("اسم الشركة:")
        name_label.setObjectName("settingLabel")
        layout.addWidget(name_label)

        self.company_input = QLineEdit()
        self.company_input.setMinimumHeight(40)
        layout.addWidget(self.company_input)

        # العملة
        currency_label = QLabel("عملة العرض:")
        currency_label.setObjectName("settingLabel")
        layout.addWidget(currency_label)

        self.currency_input = QLineEdit()
        self.currency_input.setMinimumHeight(40)
        layout.addWidget(self.currency_input)

        # لون الواجهة
        color_label = QLabel("لون الواجهة:")
        color_label.setObjectName("settingLabel")
        layout.addWidget(color_label)

        color_row = QHBoxLayout()
        self.color_input = QLineEdit()
        self.color_input.setMinimumHeight(40)
        self.color_input.setReadOnly(True)
        color_row.addWidget(self.color_input)

        self.color_btn = QPushButton("اختيار اللون")
        self.color_btn.setCursor(Qt.PointingHandCursor)
        self.color_btn.setMinimumHeight(40)
        self.color_btn.clicked.connect(self._pick_color)
        color_row.addWidget(self.color_btn)

        self.color_preview = QFrame()
        self.color_preview.setFixedSize(40, 40)
        self.color_preview.setStyleSheet(
            f"background-color: #1a73e8; border-radius: 8px; border: 1px solid #ddd;"
        )
        color_row.addWidget(self.color_preview)

        layout.addLayout(color_row)

        # مجلد التقارير
        folder_label = QLabel("المجلد الافتراضي للتقارير:")
        folder_label.setObjectName("settingLabel")
        layout.addWidget(folder_label)

        folder_row = QHBoxLayout()
        self.folder_input = QLineEdit()
        self.folder_input.setMinimumHeight(40)
        folder_row.addWidget(self.folder_input)

        self.folder_btn = QPushButton("تصفح")
        self.folder_btn.setCursor(Qt.PointingHandCursor)
        self.folder_btn.setMinimumHeight(40)
        self.folder_btn.clicked.connect(self._pick_folder)
        folder_row.addWidget(self.folder_btn)

        layout.addLayout(folder_row)

        # أزرار الحفظ والإلغاء
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(12)

        cancel_btn = QPushButton("إلغاء")
        cancel_btn.setObjectName("cancelBtn")
        cancel_btn.setCursor(Qt.PointingHandCursor)
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        save_btn = QPushButton("حفظ الإعدادات")
        save_btn.setObjectName("saveBtn")
        save_btn.setCursor(Qt.PointingHandCursor)
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def _load_settings(self):
        settings = SettingsService.get()
        self.company_input.setText(settings.get("company_name", ""))
        self.currency_input.setText(settings.get("currency", "IQD"))

        color = settings.get("theme_color", "#1a73e8")
        self.color_input.setText(color)
        self.color_preview.setStyleSheet(
            f"background-color: {color}; border-radius: 8px; border: 1px solid #ddd;"
        )

        self.folder_input.setText(settings.get("reports_folder", ""))

    def _pick_color(self):
        color = QColorDialog.getColor(
            QColor(self.color_input.text()), self, "اختر لون الواجهة"
        )
        if color.isValid():
            hex_color = color.name()
            self.color_input.setText(hex_color)
            self.color_preview.setStyleSheet(
                f"background-color: {hex_color}; border-radius: 8px; border: 1px solid #ddd;"
            )

    def _pick_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "اختر مجلد التقارير")
        if folder:
            self.folder_input.setText(folder)

    def _save(self):
        company = self.company_input.text().strip()
        currency = self.currency_input.text().strip()
        color = self.color_input.text().strip()
        folder = self.folder_input.text().strip()

        if not company or not currency:
            QMessageBox.warning(self, "تنبيه", "جميع الحقول مطلوبة")
            return

        SettingsService.update(company, currency, color, folder)
        QMessageBox.information(self, "نجاح", "تم حفظ الإعدادات بنجاح")
        self.settings_updated.emit()
        self.accept()
