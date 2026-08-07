"""البرنامج الرئيسي - نظام إدارة الرصيد
بركات المناسك للسفر والسياحة"""

import sys
import os

# إضافة مسار المشروع إلى sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout,
    QHBoxLayout, QLabel, QPushButton, QFrame,
    QStackedWidget, QMessageBox, QSpacerItem, QSizePolicy
)
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QFont, QIcon, QPixmap, QPainter, QColor

from barakat_account import database as db
from barakat_account.services import TransactionService, SettingsService
from barakat_account.ui.styles import get_stylesheet
from barakat_account.ui.statement_view import StatementView
from barakat_account.dialogs.transaction_dialog import TransactionDialog
from barakat_account.dialogs.settings_dialog import SettingsDialog
from barakat_account.dialogs.backup_dialog import BackupDialog
from barakat_account.utils.helpers import format_currency


def create_icon(emoji_text: str, bg_color: str) -> QIcon:
    """إنشاء أيقونة بسيطة"""
    pixmap = QPixmap(64, 64)
    pixmap.fill(Qt.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.Antialiasing)

    painter.setBrush(QColor(bg_color))
    painter.setPen(Qt.NoPen)
    painter.drawRoundedRect(2, 2, 60, 60, 12, 12)

    painter.setPen(QColor("white"))
    font = QFont("Segoe UI Emoji", 28)
    painter.setFont(font)
    painter.drawText(pixmap.rect(), Qt.AlignCenter, emoji_text)
    painter.end()

    return QIcon(pixmap)


class MainWindow(QMainWindow):
    """النافذة الرئيسية"""

    def __init__(self):
        super().__init__()
        self._load_settings_and_style()
        self._build_ui()
        self._update_summary()
        self._connect_signals()

    def _load_settings_and_style(self):
        """تحميل الإعدادات وتطبيق الأنماط"""
        db.initialize_database()
        self.settings = SettingsService.get()
        self.theme_color = self.settings.get("theme_color", "#1a73e8")

        self.setWindowTitle(f"نظام إدارة الرصيد - {self.settings.get('company_name', '')}")
        self.setMinimumSize(1100, 750)
        self.resize(1200, 800)

        self.setStyleSheet(get_stylesheet(self.theme_color))

    def _build_ui(self):
        """بناء الواجهة"""
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)
        main_layout.setSpacing(16)
        main_layout.setContentsMargins(24, 16, 24, 16)

        # ═══════════════ العنوان ═══════════════
        header_layout = QHBoxLayout()

        title = QLabel("نظام إدارة الرصيد")
        title.setObjectName("appTitle")
        title.setFont(QFont("Segoe UI", 22, QFont.Bold))
        header_layout.addWidget(title)

        header_layout.addStretch()

        settings_btn = QPushButton("⚙ الإعدادات")
        settings_btn.setObjectName("mainBtn")
        settings_btn.setCursor(Qt.PointingHandCursor)
        settings_btn.setFixedSize(160, 45)
        settings_btn.clicked.connect(self._open_settings)
        header_layout.addWidget(settings_btn)

        backup_btn = QPushButton("📦 نسخ احتياطي")
        backup_btn.setObjectName("mainBtn")
        backup_btn.setCursor(Qt.PointingHandCursor)
        backup_btn.setFixedSize(160, 45)
        backup_btn.clicked.connect(self._open_backup)
        header_layout.addWidget(backup_btn)

        main_layout.addLayout(header_layout)

        # ═══════════════ بطاقة الرصيد ═══════════════
        self.balance_card = QFrame()
        self.balance_card.setObjectName("balanceCard")
        self.balance_card.setMinimumHeight(130)
        balance_layout = QVBoxLayout(self.balance_card)
        balance_layout.setContentsMargins(32, 20, 32, 20)

        balance_label = QLabel("الرصيد الحالي")
        balance_label.setObjectName("balanceLabel")
        balance_label.setAlignment(Qt.AlignCenter)
        balance_layout.addWidget(balance_label)

        self.balance_amount = QLabel("0 IQD")
        self.balance_amount.setObjectName("balanceAmount")
        self.balance_amount.setAlignment(Qt.AlignCenter)
        balance_layout.addWidget(self.balance_amount)

        main_layout.addWidget(self.balance_card)

        # ═══════════════ بطاقات الملخص ═══════════════
        stats_layout = QHBoxLayout()
        stats_layout.setSpacing(12)

        # إجمالي التعزيز
        self.increase_card = QFrame()
        self.increase_card.setObjectName("statCard")
        inc_layout = QVBoxLayout(self.increase_card)
        inc_title = QLabel("إجمالي التعزيز")
        inc_title.setObjectName("statTitle")
        inc_title.setAlignment(Qt.AlignCenter)
        inc_layout.addWidget(inc_title)
        self.increase_value = QLabel("0")
        self.increase_value.setObjectName("statValueGreen")
        self.increase_value.setAlignment(Qt.AlignCenter)
        inc_layout.addWidget(self.increase_value)
        stats_layout.addWidget(self.increase_card)

        # إجمالي القطع
        self.decrease_card = QFrame()
        self.decrease_card.setObjectName("statCard")
        dec_layout = QVBoxLayout(self.decrease_card)
        dec_title = QLabel("إجمالي القطع")
        dec_title.setObjectName("statTitle")
        dec_title.setAlignment(Qt.AlignCenter)
        dec_layout.addWidget(dec_title)
        self.decrease_value = QLabel("0")
        self.decrease_value.setObjectName("statValueRed")
        self.decrease_value.setAlignment(Qt.AlignCenter)
        dec_layout.addWidget(self.decrease_value)
        stats_layout.addWidget(self.decrease_card)

        # عدد الحركات
        self.count_card = QFrame()
        self.count_card.setObjectName("statCard")
        cnt_layout = QVBoxLayout(self.count_card)
        cnt_title = QLabel("عدد الحركات")
        cnt_title.setObjectName("statTitle")
        cnt_title.setAlignment(Qt.AlignCenter)
        cnt_layout.addWidget(cnt_title)
        self.count_value = QLabel("0")
        self.count_value.setObjectName("statValue")
        self.count_value.setAlignment(Qt.AlignCenter)
        cnt_layout.addWidget(self.count_value)
        stats_layout.addWidget(self.count_card)

        main_layout.addLayout(stats_layout)

        # ═══════════════ الأزرار الرئيسية ═══════════════
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)

        self.btn_increase = QPushButton("➕ تعزيز")
        self.btn_increase.setObjectName("btnIncrease")
        self.btn_increase.setCursor(Qt.PointingHandCursor)
        self.btn_increase.setMinimumHeight(65)
        self.btn_increase.setFont(QFont("Segoe UI", 15, QFont.Bold))
        self.btn_increase.clicked.connect(self._open_increase)
        buttons_layout.addWidget(self.btn_increase)

        self.btn_decrease = QPushButton("➖ قطع")
        self.btn_decrease.setObjectName("btnDecrease")
        self.btn_decrease.setCursor(Qt.PointingHandCursor)
        self.btn_decrease.setMinimumHeight(65)
        self.btn_decrease.setFont(QFont("Segoe UI", 15, QFont.Bold))
        self.btn_decrease.clicked.connect(self._open_decrease)
        buttons_layout.addWidget(self.btn_decrease)

        self.btn_statement = QPushButton("📄 كشف الحساب")
        self.btn_statement.setObjectName("mainBtn")
        self.btn_statement.setCursor(Qt.PointingHandCursor)
        self.btn_statement.setMinimumHeight(65)
        self.btn_statement.setFont(QFont("Segoe UI", 15, QFont.Bold))
        self.btn_statement.clicked.connect(self._open_statement)
        buttons_layout.addWidget(self.btn_statement)

        main_layout.addLayout(buttons_layout)

        # ═══════════════ محتوى الشاشة الرئيسية ═══════════════
        self.stack = QStackedWidget()

        # صفحة الترحيب (الرئيسية)
        welcome_page = QWidget()
        welcome_layout = QVBoxLayout(welcome_page)
        welcome_layout.setAlignment(Qt.AlignCenter)

        welcome_text = QLabel("مرحباً بك في نظام إدارة الرصيد\n\n"
                              "اختر إجراءً من الأزرار أعلاه للبدء")
        welcome_text.setAlignment(Qt.AlignCenter)
        welcome_text.setFont(QFont("Segoe UI", 16))
        welcome_text.setStyleSheet("color: #999;")
        welcome_layout.addWidget(welcome_text)

        self.stack.addWidget(welcome_page)  # index 0

        # صفحة كشف الحساب
        self.statement_view = StatementView()
        self.statement_view.transaction_modified.connect(self._update_summary)
        self.stack.addWidget(self.statement_view)  # index 1

        main_layout.addWidget(self.stack, 1)

    def _connect_signals(self):
        """ربط الإشارات"""
        pass

    def _update_summary(self):
        """تحديث ملخص الحسابات"""
        summary = TransactionService.get_summary()
        currency = self.settings.get("currency", "IQD")

        self.balance_amount.setText(
            format_currency(summary["current_balance"], currency)
        )
        self.increase_value.setText(
            format_currency(summary["total_increase"], currency)
        )
        self.decrease_value.setText(
            format_currency(summary["total_decrease"], currency)
        )
        self.count_value.setText(str(summary["total_count"]))

        # تحديث لون بطاقة الرصيد حسب الرصيد
        balance = summary["current_balance"]
        if balance > 0:
            self.balance_card.setStyleSheet(
                f"background-color: {self.theme_color}; border-radius: 16px; padding: 24px;"
            )
        elif balance < 0:
            self.balance_card.setStyleSheet(
                "background-color: #c62828; border-radius: 16px; padding: 24px;"
            )
        else:
            self.balance_card.setStyleSheet(
                "background-color: #757575; border-radius: 16px; padding: 24px;"
            )

    def _open_increase(self):
        """فتح نافذة التعزيز"""
        dialog = TransactionDialog(self, trans_type="تعزيز")
        dialog.transaction_added.connect(self._update_summary)
        dialog.exec()

    def _open_decrease(self):
        """فتح نافذة القطع"""
        dialog = TransactionDialog(self, trans_type="قطع")
        dialog.transaction_added.connect(self._update_summary)
        dialog.exec()

    def _open_statement(self):
        """فتح كشف الحساب"""
        self.stack.setCurrentIndex(1)
        self.statement_view.refresh()

    def _open_settings(self):
        """فتح الإعدادات"""
        dialog = SettingsDialog(self)
        dialog.settings_updated.connect(self._on_settings_updated)
        dialog.exec()

    def _open_backup(self):
        """فتح النسخ الاحتياطي"""
        dialog = BackupDialog(self)
        dialog.exec()

    def _on_settings_updated(self):
        """عند تحديث الإعدادات"""
        self.settings = SettingsService.get()
        self.theme_color = self.settings.get("theme_color", "#1a73e8")
        self.setStyleSheet(get_stylesheet(self.theme_color))
        self.setWindowTitle(
            f"نظام إدارة الرصيد - {self.settings.get('company_name', '')}"
        )
        self._update_summary()


def main():
    """نقطة الدخول الرئيسية"""
    app = QApplication(sys.argv)
    app.setLayoutDirection(Qt.RightToLeft)
    app.setFont(QFont("Segoe UI", 12))

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
