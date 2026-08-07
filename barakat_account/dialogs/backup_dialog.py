"""نافذة النسخ الاحتياطي"""

import os
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QMessageBox, QFileDialog
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

from barakat_account import database as db
from barakat_account.utils.helpers import get_today, get_backups_dir, ensure_dir


class BackupDialog(QDialog):
    """نافذة النسخ الاحتياطي"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("النسخ الاحتياطي")
        self.setMinimumWidth(450)
        self.setModal(True)
        self._build_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(32, 32, 32, 32)

        title = QLabel("النسخ الاحتياطي")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet("color: #333; margin-bottom: 16px;")
        layout.addWidget(title)

        desc = QLabel(
            "قم بإنشاء نسخة احتياطية من قاعدة البيانات\n"
            "أو استعادة نسخة سابقة"
        )
        desc.setAlignment(Qt.AlignCenter)
        desc.setStyleSheet("color: #888; font-size: 13px;")
        layout.addWidget(desc)

        backup_btn = QPushButton("📦 إنشاء نسخة احتياطية")
        backup_btn.setObjectName("backupBtn")
        backup_btn.setCursor(Qt.PointingHandCursor)
        backup_btn.setMinimumHeight(50)
        backup_btn.clicked.connect(self._create_backup)
        layout.addWidget(backup_btn)

        restore_btn = QPushButton("🔄 استعادة نسخة احتياطية")
        restore_btn.setObjectName("exportBtn")
        restore_btn.setCursor(Qt.PointingHandCursor)
        restore_btn.setMinimumHeight(50)
        restore_btn.clicked.connect(self._restore_backup)
        layout.addWidget(restore_btn)

        close_btn = QPushButton("إغلاق")
        close_btn.setObjectName("cancelBtn")
        close_btn.setCursor(Qt.PointingHandCursor)
        close_btn.clicked.connect(self.accept)
        layout.addWidget(close_btn)

    def _create_backup(self):
        backups_dir = get_backups_dir()
        ensure_dir(backups_dir)

        default_path = os.path.join(
            backups_dir,
            f"backup_{get_today()}.db"
        )

        filepath, _ = QFileDialog.getSaveFileName(
            self, "إنشاء نسخة احتياطية",
            default_path,
            "Database Files (*.db)"
        )
        if not filepath:
            return

        try:
            db.backup_database(filepath)
            QMessageBox.information(
                self, "نجاح",
                f"تم إنشاء النسخة الاحتياطية بنجاح:\n{filepath}"
            )
        except Exception as e:
            QMessageBox.warning(self, "خطأ", f"فشل إنشاء النسخة الاحتياطية:\n{str(e)}")

    def _restore_backup(self):
        filepath, _ = QFileDialog.getOpenFileName(
            self, "استعادة نسخة احتياطية",
            get_backups_dir(),
            "Database Files (*.db)"
        )
        if not filepath:
            return

        reply = QMessageBox.question(
            self, "تأكيد الاستعادة",
            "هل أنت متأكد من استعادة النسخة الاحتياطية؟\n"
            "سيتم استبدال جميع البيانات الحالية.",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            try:
                db.restore_database(filepath)
                QMessageBox.information(
                    self, "نجاح",
                    "تم استعادة النسخة الاحتياطية بنجاح.\n"
                    "يرجى إعادة تشغيل البرنامج."
                )
            except Exception as e:
                QMessageBox.warning(self, "خطأ", f"فشل الاستعادة:\n{str(e)}")
