"""نماذج البيانات - Data Models"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class Transaction:
    """نموذج الحركة المالية"""
    id: Optional[int] = None
    date: str = ""
    type: str = ""  # تعزيز أو قطع
    amount: float = 0.0
    balance_after: float = 0.0
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    def __post_init__(self):
        if not self.date:
            self.date = date.today().strftime("%Y-%m-%d")


@dataclass
class Settings:
    """نموذج الإعدادات"""
    id: int = 1
    company_name: str = "بركات المناسك للسفر والسياحة"
    currency: str = "IQD"
    theme_color: str = "#1a73e8"
    reports_folder: str = ""
