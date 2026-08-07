import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { Settings } from "../types";
import { settingsApi } from "../api";

interface SettingsContextType {
  settings: Settings;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
  id: 1,
  companyName: "بركات المناسك للسفر والسياحة",
  currency: "IQD",
  themeColor: "#1a73e8",
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  refreshSettings: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const refreshSettings = async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
    } catch {
      //使用 الافتراضي
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", settings.themeColor);
  }, [settings.themeColor]);

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
