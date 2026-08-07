import { useEffect, useState } from "react";
import { transactionsApi } from "../api";
import { useSettings } from "../context/SettingsContext";
import TransactionDialog from "../components/TransactionDialog";
import toast from "react-hot-toast";
import type { Transaction } from "../types";

export default function Statement() {
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("الكل");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const loadData = async () => {
    try {
      const data = await transactionsApi.getFiltered({
        type: filterType,
        search: searchText,
      });
      setTransactions(data);
    } catch {
      toast.error("خطأ في تحميل البيانات");
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType, searchText]);

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    if (!editingTransaction) return;
    try {
      await transactionsApi.update(editingTransaction.id, {
        date: data.date,
        type: data.type,
        amount: parseFloat(data.amount),
        notes: data.notes,
      });
      toast.success("تم تعديل الحركة بنجاح");
      setDialogOpen(false);
      setEditingTransaction(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "خطأ في التعديل");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الحركة؟")) return;
    try {
      await transactionsApi.delete(id);
      toast.success("تم حذف الحركة بنجاح");
      loadData();
    } catch {
      toast.error("خطأ في الحذف");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">كشف الحساب</h1>
        <p className="text-gray-400 mt-1">عرض وتعديل جميع الحركات</p>
      </div>

      {/* شريط البحث والفلترة */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="بحث في الملاحظات..."
            className="input-field flex-1"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select
            className="input-field sm:w-40"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="الكل">الكل</option>
            <option value="تعزيز"> تعزيز</option>
            <option value="قطع">قطع</option>
          </select>
        </div>
      </div>

      {/* الجدول */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right font-bold text-gray-600">التاريخ</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">النوع</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">المبلغ</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">الرصيد</th>
                <th className="px-4 py-3 text-right font-bold text-gray-600">الملاحظات</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
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
                    {t.amount.toLocaleString("ar-IQ")} {settings.currency}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {t.balanceAfter.toLocaleString("ar-IQ")} {settings.currency}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.notes || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(t)}
                        className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="px-3 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    لا توجد حركات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingTransaction(null);
        }}
        onSubmit={handleSubmit}
        transaction={editingTransaction}
      />
    </div>
  );
}
