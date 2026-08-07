"""أنماط الواجهة - UI Styles"""


def _hex_to_rgb(hex_color: str) -> tuple:
    """تحويل لون hex إلى RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def get_stylesheet(theme_color: str = "#1a73e8") -> str:
    """الحصول على ورقة الأنماط"""
    # توليد ألوان مشتقة
    r, g, b = _hex_to_rgb(theme_color)
    light_color = f"rgba({r}, {g}, {b}, 21)"
    hover_color = f"rgba({r}, {g}, {b}, 221)"

    return f"""
    /* ═══════════════════════════════════════════════
       عام
    ═══════════════════════════════════════════════ */
    * {{
        font-family: 'Segoe UI', 'Cairo', sans-serif;
        font-size: 14px;
    }}

    QMainWindow {{
        background-color: #f0f2f5;
    }}

    QWidget {{
        background-color: transparent;
    }}

    /* ═══════════════════════════════════════════════
       البطاقات
    ═══════════════════════════════════════════════ */
    QFrame#balanceCard {{
        background-color: {theme_color};
        border-radius: 16px;
        padding: 24px;
    }}

    QFrame#statCard {{
        background-color: white;
        border-radius: 12px;
        border: 1px solid #e0e0e0;
        padding: 16px;
    }}

    /* ═══════════════════════════════════════════════
       النصوص
    ═══════════════════════════════════════════════ */
    QLabel#appTitle {{
        font-size: 20px;
        font-weight: bold;
        color: #333;
    }}

    QLabel#balanceLabel {{
        font-size: 16px;
        color: rgba(255,255,255,0.9);
    }}

    QLabel#balanceAmount {{
        font-size: 36px;
        font-weight: bold;
        color: white;
    }}

    QLabel#statTitle {{
        font-size: 13px;
        color: #888;
    }}

    QLabel#statValue {{
        font-size: 22px;
        font-weight: bold;
        color: #333;
    }}

    QLabel#statValueGreen {{
        font-size: 22px;
        font-weight: bold;
        color: #2e7d32;
    }}

    QLabel#statValueRed {{
        font-size: 22px;
        font-weight: bold;
        color: #c62828;
    }}

    /* ═══════════════════════════════════════════════
       الأزرار الرئيسية
    ═══════════════════════════════════════════════ */
    QPushButton#mainBtn {{
        background-color: white;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 20px 16px;
        font-size: 15px;
        font-weight: bold;
        color: #333;
        min-height: 40px;
    }}

    QPushButton#mainBtn:hover {{
        background-color: {light_color};
        border-color: {theme_color};
        color: {theme_color};
    }}

    QPushButton#mainBtn:pressed {{
        background-color: {theme_color};
        color: white;
    }}

    QPushButton#btnIncrease {{
        background-color: white;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 20px 16px;
        font-size: 15px;
        font-weight: bold;
        color: #2e7d32;
    }}

    QPushButton#btnIncrease:hover {{
        background-color: #e8f5e9;
        border-color: #2e7d32;
    }}

    QPushButton#btnDecrease {{
        background-color: white;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 20px 16px;
        font-size: 15px;
        font-weight: bold;
        color: #c62828;
    }}

    QPushButton#btnDecrease:hover {{
        background-color: #ffebee;
        border-color: #c62828;
    }}

    /* ═══════════════════════════════════════════════
       أزرار الحفظ والإلغاء
    ═══════════════════════════════════════════════ */
    QPushButton#saveBtn {{
        background-color: {theme_color};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 32px;
        font-size: 15px;
        font-weight: bold;
    }}

    QPushButton#saveBtn:hover {{
        background-color: {hover_color};
    }}

    QPushButton#cancelBtn {{
        background-color: #f5f5f5;
        color: #666;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px 32px;
        font-size: 15px;
        font-weight: bold;
    }}

    QPushButton#cancelBtn:hover {{
        background-color: #eee;
    }}

    /* ═══════════════════════════════════════════════
       حقول الإدخال
    ═══════════════════════════════════════════════ */
    QLineEdit, QDateEdit, QComboBox {{
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 14px;
        background-color: white;
        color: #333;
        min-height: 20px;
    }}

    QLineEdit:focus, QDateEdit:focus, QComboBox:focus {{
        border-color: {theme_color};
    }}

    QLineEdit::placeholder {{
        color: #aaa;
    }}

    /* ═══════════════════════════════════════════════
       جدول البيانات
    ═══════════════════════════════════════════════ */
    QTableView {{
        background-color: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        gridline-color: #f0f0f0;
        selection-background-color: {light_color};
        selection-color: #333;
        font-size: 13px;
    }}

    QTableView::item {{
        padding: 8px 12px;
        border-bottom: 1px solid #f0f0f0;
    }}

    QTableView::item:selected {{
        background-color: {light_color};
    }}

    QHeaderView::section {{
        background-color: #f8f9fa;
        border: none;
        border-bottom: 2px solid #e0e0e0;
        padding: 10px 12px;
        font-weight: bold;
        font-size: 13px;
        color: #555;
    }}

    /* ═══════════════════════════════════════════════
       أزرار الجدول
    ═══════════════════════════════════════════════ */
    QPushButton#editBtn {{
        background-color: #e3f2fd;
        color: {theme_color};
        border: none;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: bold;
    }}

    QPushButton#editBtn:hover {{
        background-color: {theme_color};
        color: white;
    }}

    QPushButton#deleteBtn {{
        background-color: #ffebee;
        color: #c62828;
        border: none;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: bold;
    }}

    QPushButton#deleteBtn:hover {{
        background-color: #c62828;
        color: white;
    }}

    /* ═══════════════════════════════════════════════
       أزرار التصدير والنسخ الاحتياطي
    ═══════════════════════════════════════════════ */
    QPushButton#exportBtn {{
        background-color: #f1f8e9;
        color: #33691e;
        border: 1px solid #c5e1a5;
        border-radius: 8px;
        padding: 10px 20px;
        font-size: 13px;
        font-weight: bold;
    }}

    QPushButton#exportBtn:hover {{
        background-color: #c5e1a5;
    }}

    QPushButton#backupBtn {{
        background-color: #fff3e0;
        color: #e65100;
        border: 1px solid #ffcc80;
        border-radius: 8px;
        padding: 10px 20px;
        font-size: 13px;
        font-weight: bold;
    }}

    QPushButton#backupBtn:hover {{
        background-color: #ffcc80;
    }}

    /* ═══════════════════════════════════════════════
       شريط البحث
    ═══════════════════════════════════════════════ */
    QFrame#searchBar {{
        background-color: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 8px;
    }}

    /* ═══════════════════════════════════════════════
       التبويبات
    ═══════════════════════════════════════════════ */
    QTabWidget::pane {{
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: white;
    }}

    QTabBar::tab {{
        background: #f0f2f5;
        border: 1px solid #e0e0e0;
        padding: 10px 24px;
        margin-right: 4px;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        font-weight: bold;
    }}

    QTabBar::tab:selected {{
        background: white;
        border-bottom: 2px solid {theme_color};
        color: {theme_color};
    }}

    /* ═══════════════════════════════════════════════
       النافذة
    ═══════════════════════════════════════════════ */
    QDialog {{
        background-color: #f0f2f5;
    }}

    /* ═══════════════════════════════════════════════
       شريط التمرير
    ═══════════════════════════════════════════════ */
    QScrollBar:vertical {{
        background: transparent;
        width: 8px;
        margin: 0;
    }}

    QScrollBar::handle:vertical {{
        background: #ccc;
        border-radius: 4px;
        min-height: 30px;
    }}

    QScrollBar::handle:vertical:hover {{
        background: #aaa;
    }}

    QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
        height: 0px;
    }}

    /* ═══════════════════════════════════════════════
       رسالة التنبيه
    ═══════════════════════════════════════════════ */
    QMessageBox {{
        background-color: #f0f2f5;
    }}

    QMessageBox QPushButton {{
        background-color: {theme_color};
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 24px;
        font-weight: bold;
        min-width: 80px;
    }}

    QMessageBox QPushButton:hover {{
        background-color: {hover_color};
    }}

    /* ═══════════════════════════════════════════════
       إعدادات
    ═══════════════════════════════════════════════ */
    QLabel#settingLabel {{
        font-size: 14px;
        font-weight: bold;
        color: #444;
    }}
    """
