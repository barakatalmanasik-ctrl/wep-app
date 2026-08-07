"""بركات المناسك للسفر والسياحة - نظام إدارة الرصيد
نقطة الدخول الرئيسية"""

import sys
import os

# ── مسار التطبيق الأساسي ──
# في وضع التطوير: مجلد المشروع
# في وضع EXE: المجلد الذي يحتوي على AccountManager.exe
if getattr(sys, 'frozen', False):
    APP_DIR = os.path.dirname(sys.executable)
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))

# ضمان وجود المجلدات المطلوبة
for _folder in ("backups", "reports", "assets"):
    _path = os.path.join(APP_DIR, _folder)
    if not os.path.exists(_path):
        os.makedirs(_path)

from barakat_account.main import main

if __name__ == "__main__":
    main()
