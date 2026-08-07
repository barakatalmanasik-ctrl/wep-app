import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { Transaction } from "../types";
import { useSettings } from "../context/SettingsContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  transaction?: Transaction | null;
  defaultType?: "تعزيز" | "قطع";
}

export default function TransactionDialog({
  isOpen,
  onClose,
  onSubmit,
  transaction,
  defaultType = "تعزيز",
}: Props) {
  const { settings } = useSettings();
  const isEdit = !!transaction;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      type: defaultType,
      amount: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        transaction
          ? {
              date: transaction.date,
              type: transaction.type,
              amount: String(transaction.amount),
              notes: transaction.notes,
            }
          : {
              date: new Date().toISOString().split("T")[0],
              type: defaultType,
              amount: "",
              notes: "",
            }
      );
    }
  }, [isOpen, transaction, defaultType, reset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in">
        <h2
          className="text-xl font-bold text-center mb-6"
          style={{ color: settings.themeColor }}
        >
          {isEdit ? "تعديل الحركة" : "إضافة حركة"}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* التاريخ */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">
              التاريخ
            </label>
            <input
              type="date"
              className="input-field"
              {...register("date", { required: "التاريخ مطلوب" })}
            />
            {errors.date && (
              <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>
            )}
          </div>

          {/* النوع */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">
              نوع الحركة
            </label>
            <select className="input-field" {...register("type", { required: true })}>
              <option value="تعزيز"> تعزيز (+)</option>
              <option value="قطع">قطع (-)</option>
            </select>
          </div>

          {/* المبلغ */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">
              المبلغ ({settings.currency})
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              className="input-field"
              placeholder="0"
              {...register("amount", {
                required: "المبلغ مطلوب",
                min: { value: 0.01, message: "يجب أن يكون المبلغ أكبر من صفر" },
              })}
            />
            {errors.amount && (
              <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* الملاحظات */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">
              الملاحظات
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="ملاحظات اختيارية..."
              {...register("notes")}
            />
          </div>

          {/* الأزرار */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
