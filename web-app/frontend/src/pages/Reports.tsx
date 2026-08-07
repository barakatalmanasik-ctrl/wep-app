import { useEffect, useState } from "react";
import { reportsApi } from "../api";
import { useSettings } from "../context/SettingsContext";
import type { ReportData } from "../types";
import toast from "react-hot-toast";

export default function Reports() {
  const { settings } = useSettings();
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    reportsApi.get().then(setReport).catch(() => toast.error("خطأ في تحميل التقرير"));
  }, []);

  const exportExcel = async () => {
    if (!report) return;

    // تصدير بسيط إلى CSV
    const headers = ["التاريخ", "نوع الحركة", "المبلغ", "الرصيد بعد العملية", "الملاحظات"];
    const rows = report.transactions.map((t) => [
      t.date,
      t.type,
      String(t.amount),
      String(t.balanceAfter),
      t.notes,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم التصدير بنجاح");
  };

  const exportPDF = async () => {
    toast("يمكنك استخدام طباعة الصفحة للحصول على PDF", { icon: "🖨️" });
    window.print();
  };

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">التقارير</h1>
        <p className="text-gray-400 mt-1">ملخص الحسابات والتصدير</p>
      </div>

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="rounded-2xl p-6 text-center text-white"
          style={{ backgroundColor: settings.themeColor }}
        >
          <p className="text-sm opacity-80 mb-1">الرصيد الحالي</p>
          <p className="text-3xl font-bold">
            {report.currentBalance.toLocaleString("ar-IQ")}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-gray-400 mb-1">إجمالي التعزيز</p>
          <p className="text-2xl font-bold text-emerald-600">
            {report.totalIncrease.toLocaleString("ar-IQ")}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-gray-400 mb-1">إجمالي القطع</p>
          <p className="text-2xl font-bold text-red-600">
            {report.totalDecrease.toLocaleString("ar-IQ")}
          </p>
        </div>

        <div className="stat-card">
          <p className="text-sm text-gray-400 mb-1">عدد العمليات</p>
          <p className="text-2xl font-bold text-gray-700">{report.totalCount}</p>
        </div>
      </div>

      {/* أزرار التصدير */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">تصدير التقارير</h2>
        <div className="flex gap-4">
          <button onClick={exportExcel} className="btn-success">
            📊 تصدير إلى Excel (CSV)
          </button>
          <button onClick={exportPDF} className="btn-secondary">
            📄 تصدير إلى PDF
          </button>
        </div>
      </div>

      {/* جدول التقرير */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">تفاصيل العمليات</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right font-bold text-gray-600">التاريخ</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">النوع</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">المبلغ</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">الرصيد</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">الملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{t.date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        t.type === "تعزيز"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 font-bold ${
                      t.type === "تعزيز" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "تعزيز" ? "+" : "-"}
                    {t.amount.toLocaleString("ar-IQ")}
                  </td>
                  <td className="px-4 py-3">
                    {t.balanceAfter.toLocaleString("ar-IQ")}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
