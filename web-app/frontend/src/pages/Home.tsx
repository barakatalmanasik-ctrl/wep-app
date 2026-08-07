import { useEffect, useState } from "react";
import { transactionsApi } from "../api";
import { useSettings } from "../context/SettingsContext";
import StatsCard from "../components/StatsCard";
import TransactionDialog from "../components/TransactionDialog";
import toast from "react-hot-toast";
import type { Summary, Transaction } from "../types";

export default function Home() {
  const { settings } = useSettings();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"تعزيز" | "قطع">("تعزيز");

  const loadData = async () => {
    try {
      const [s, t] = await Promise.all([
        transactionsApi.getSummary(),
        transactionsApi.getAll(),
      ]);
      setSummary(s);
      setRecentTransactions(t.slice(0, 5));
    } catch {
      toast.error("خطأ في تحميل البيانات");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      await transactionsApi.create({
        date: data.date,
        type: data.type,
        amount: parseFloat(data.amount),
        notes: data.notes,
      });
      toast.success("تم حفظ الحركة بنجاح");
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "خطأ في الحفظ");
    }
  };

  return (
    <div className="space-y-8">
      {/* العنوان */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">الرئيسية</h1>
        <p className="text-gray-400 mt-1">نظرة عامة على الحساب</p>
      </div>

      {/* بطاقة الرصيد */}
      <div
        className="rounded-2xl p-8 text-center text-white shadow-lg"
        style={{ backgroundColor: settings.themeColor }}
      >
        <p className="text-lg opacity-90 mb-2">الرصيد الحالي</p>
        <p className="text-5xl font-bold tracking-wide">
          {summary ? summary.currentBalance.toLocaleString("ar-IQ") : "0"}
          <span className="text-lg font-normal mr-2 opacity-80">
            {settings.currency}
          </span>
        </p>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          label="إجمالي التعزيز"
          value={summary?.totalIncrease || 0}
          color="#16a34a"
          icon="📈"
        />
        <StatsCard
          label="إجمالي القطع"
          value={summary?.totalDecrease || 0}
          color="#dc2626"
          icon="📉"
        />
        <StatsCard
          label="عدد الحركات"
          value={summary?.totalCount || 0}
          icon="📋"
        />
      </div>

      {/* أزرار الإجراءات */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setDialogType("تعزيز");
            setDialogOpen(true);
          }}
          className="btn-success text-lg py-4"
        >
          ➕ تعزيز
        </button>
        <button
          onClick={() => {
            setDialogType("قطع");
            setDialogOpen(true);
          }}
          className="btn-danger text-lg py-4"
        >
          ➖ قطع
        </button>
      </div>

      {/* آخر الحركات */}
      {recentTransactions.length > 0 && (
        <div className="card">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">آخر الحركات</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTransactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm ${
                      t.type === "تعزيز" ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  >
                    {t.type === "تعزيز" ? "+" : "-"}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {t.type === "تعزيز" ? "تعزيز" : "قطع"}
                    </p>
                    <p className="text-xs text-gray-400">{t.date}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p
                    className={`font-bold ${
                      t.type === "تعزيز" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "تعزيز" ? "+" : "-"}
                    {t.amount.toLocaleString("ar-IQ")} {settings.currency}
                  </p>
                  <p className="text-xs text-gray-400">
                    الرصيد: {t.balanceAfter.toLocaleString("ar-IQ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TransactionDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        defaultType={dialogType}
      />
    </div>
  );
}
