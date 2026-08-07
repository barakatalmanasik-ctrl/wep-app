import { useEffect, useState } from "react";
import { settingsApi } from "../api";
import { useSettings } from "../context/SettingsContext";
import toast from "react-hot-toast";

export default function Settings() {
  const { settings, refreshSettings } = useSettings();
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setCurrency(settings.currency);
    setThemeColor(settings.themeColor);
  }, [settings]);

  const handleSave = async () => {
    if (!companyName.trim() || !currency.trim()) {
      toast.error("جميع الحقول مطلوبة");
      return;
    }

    setSaving(true);
    try {
      await settingsApi.update({
        companyName: companyName.trim(),
        currency: currency.trim(),
        themeColor,
      });
      await refreshSettings();
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch {
      toast.error("خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">الإعدادات</h1>
        <p className="text-gray-400 mt-1">تخصيص النظام</p>
      </div>

      <div className="card p-8 max-w-2xl space-y-6">
        {/* اسم الشركة */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-2">
            اسم الشركة
          </label>
          <input
            type="text"
            className="input-field"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        {/* العملة */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-2">
            عملة العرض
          </label>
          <input
            type="text"
            className="input-field"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="IQD"
          />
        </div>

        {/* لون الواجهة */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-2">
            لون النظام
          </label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="w-16 h-12 rounded-xl border-2 border-gray-200 cursor-pointer"
            />
            <div className="flex gap-2">
              {["#1a73e8", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#be185d"].map(
                (color) => (
                  <button
                    key={color}
                    onClick={() => setThemeColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      themeColor === color
                        ? "border-gray-800 scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                )
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </button>
      </div>
    </div>
  );
}
