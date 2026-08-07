import { useEffect, useState } from "react";
import { backupApi } from "../api";
import toast from "react-hot-toast";
import type { BackupFile } from "../types";

export default function Backup() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBackups = async () => {
    try {
      const data = await backupApi.list();
      setBackups(data);
    } catch {
      toast.error("خطأ في تحميل النسخ الاحتياطية");
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await backupApi.create();
      toast.success("تم إنشاء النسخة الاحتياطية بنجاح");
      loadBackups();
    } catch {
      toast.error("خطأ في إنشاء النسخة الاحتياطية");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!confirm("هل أنت متأكد من استعادة هذه النسخة؟\nسيتم استبدال جميع البيانات الحالية."))
      return;

    try {
      await backupApi.restore(filename);
      toast.success("تمت الاستعادة بنجاح. يرجى تحديث الصفحة.");
      window.location.reload();
    } catch {
      toast.error("خطأ في الاستعادة");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">النسخ الاحتياطي</h1>
        <p className="text-gray-400 mt-1">إنشاء واستعادة النسخ الاحتياطية</p>
      </div>

      {/* زر الإنشاء */}
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">📦</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          إنشاء نسخة احتياطية
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          حفظ نسخة كاملة من قاعدة البيانات
        </p>
        <button onClick={handleCreate} disabled={loading} className="btn-primary">
          {loading ? "جاري الإنشاء..." : "إنشاء نسخة احتياطية"}
        </button>
      </div>

      {/* قائمة النسخ */}
      <div className="card">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            النسخ الاحتياطية ({backups.length})
          </h2>
        </div>
        {backups.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            لا توجد نسخ احتياطية بعد
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-sm text-gray-800">{b.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(b.date)} — {formatSize(b.size)}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(b.name)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  استعادة
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
