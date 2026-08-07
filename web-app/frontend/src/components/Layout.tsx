import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { useState } from "react";

const navItems = [
  { to: "/", label: "الرئيسية", icon: "🏠" },
  { to: "/statement", label: "كشف الحساب", icon: "📄" },
  { to: "/reports", label: "التقارير", icon: "📊" },
  { to: "/backup", label: "النسخ الاحتياطي", icon: "📦" },
  { to: "/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function Layout() {
  const { settings } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* ── القائمة الجانبية ── */}
      <aside
        className={`
          fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-gray-200
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-100">
            <h1
              className="text-lg font-bold text-center leading-relaxed"
              style={{ color: settings.themeColor }}
            >
              {settings.companyName}
            </h1>
            <p className="text-xs text-gray-400 text-center mt-1">
              نظام إدارة الرصيد
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white shadow-md"
                      : "text-gray-600 hover:bg-gray-50"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: settings.themeColor }
                    : {}
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              v1.0.0 — بركات المناسك
            </p>
          </div>
        </div>
      </aside>

      {/* ── Overlay للهاتف ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── المحتوى الرئيسي ── */}
      <main className="flex-1 min-h-screen lg:mr-0">
        {/* Header للهاتف */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100 lg:hidden">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-bold" style={{ color: settings.themeColor }}>
              نظام إدارة الرصيد
            </h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
